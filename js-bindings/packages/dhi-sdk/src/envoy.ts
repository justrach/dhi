/**
 * OpenAPI -> Envoy WASM configuration generator
 *
 * Converts OpenAPI requestBody schemas into the compact route-aware
 * configuration string consumed by the dhi Envoy WASM filter.
 */

import { parse as parseYaml } from 'yaml';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type JsonObject = Record<string, unknown>;

type EnvoyOutputMode = 'rules' | 'filter' | 'full';

export interface EnvoyGenerateOptions {
  /** Output mode: raw rules, Envoy WASM filter snippet, or complete Envoy config */
  mode?: EnvoyOutputMode;
  /** Path to dhi-envoy.wasm inside the Envoy container */
  wasmPath?: string;
  /** Upstream cluster name for complete Envoy config output */
  clusterName?: string;
  /** Hostname for the upstream service in complete Envoy config output */
  upstreamHost?: string;
  /** Port for the upstream service in complete Envoy config output */
  upstreamPort?: number;
  /** Listener port for complete Envoy config output */
  listenPort?: number;
  /** Envoy DNS lookup family for STRICT_DNS upstream clusters */
  dnsLookupFamily?: 'AUTO' | 'V4_ONLY' | 'V6_ONLY';
  /** Whether Envoy should fail open if the Proxy-Wasm plugin fails */
  failOpen?: boolean;
}

export interface EnvoyGenerationResult {
  /** Route-aware dhi rules string passed to the WASM filter */
  rules: string;
  /** Rendered output selected by EnvoyGenerateOptions.mode */
  output: string;
  /** Non-fatal mapping notes for OpenAPI features the MVP cannot enforce yet */
  warnings: string[];
  /** Number of OpenAPI operations with generated request validation rules */
  routeCount: number;
}

interface Rule {
  field: string;
  validator: string;
  min?: string | number;
  max?: string | number;
  optional?: boolean;
}

interface RequestBodySchema {
  schema: JsonObject;
  required: boolean;
}

interface RouteRule {
  method: string;
  path: string;
  bodyRequired: boolean;
  rules: Rule[];
}

export function parseOpenApiDocument(source: string, fileName = 'openapi'): JsonObject {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error(`${fileName} is empty`);
  }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as JsonObject;
  }

  const parsed = parseYaml(source) as unknown;
  if (!isObject(parsed)) {
    throw new Error(`${fileName} did not parse to an OpenAPI object`);
  }

  return parsed;
}

export function generateEnvoyFromOpenApi(
  spec: JsonObject,
  options: EnvoyGenerateOptions = {},
): EnvoyGenerationResult {
  const warnings: string[] = [];
  const routes = sortRoutes(extractRouteRules(spec, warnings));
  const rules = renderRules(routes);
  const mode = options.mode ?? 'filter';

  warnForEnvoyLimits(routes, rules, warnings);

  return {
    rules,
    warnings,
    routeCount: routes.length,
    output: renderOutput(rules, mode, options),
  };
}

function extractRouteRules(spec: JsonObject, warnings: string[]): RouteRule[] {
  const paths = asObject(spec.paths, 'paths');
  const routes: RouteRule[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation)) continue;

      const requestBody = getJsonRequestBodySchema(operation, spec);
      if (!requestBody) continue;

      const resolved = resolveSchema(requestBody.schema, spec);
      const rules = schemaToRules(resolved, spec, warnings, `${method.toUpperCase()} ${path}`);
      if (rules.length > 0) {
        routes.push({ method: method.toUpperCase(), path, bodyRequired: requestBody.required, rules });
      }
    }
  }

  return routes;
}

function getJsonRequestBodySchema(operation: JsonObject, spec: JsonObject): RequestBodySchema | null {
  const requestBody = resolveMaybeRef(operation.requestBody, spec);
  if (!isObject(requestBody)) return null;

  const content = requestBody.content;
  if (!isObject(content)) return null;

  const media = content['application/json'] ?? content['application/*+json'];
  if (!isObject(media)) return null;

  const schema = media.schema;
  return isObject(schema) ? { schema, required: requestBody.required === true } : null;
}

function schemaToRules(schema: JsonObject, spec: JsonObject, warnings: string[], context: string): Rule[] {
  const resolved = resolveSchema(schema, spec);
  const merged = mergeComposedSchema(resolved, spec);

  if (merged.type !== 'object' && !isObject(merged.properties)) {
    warnings.push(`${context}: only object JSON request bodies are supported for Envoy generation`);
    return [];
  }

  const properties = isObject(merged.properties) ? merged.properties : {};
  const required = new Set(Array.isArray(merged.required) ? merged.required.filter(isString) : []);
  const rules: Rule[] = [];

  for (const [field, rawPropertySchema] of Object.entries(properties)) {
    if (!isObject(rawPropertySchema)) continue;

    const propertySchema = mergeComposedSchema(resolveSchema(rawPropertySchema, spec), spec);
    const fieldRequired = required.has(field);
    const fieldRules = propertyToRules(field, propertySchema, fieldRequired, warnings, context);
    rules.push(...fieldRules);
  }

  return rules;
}

function propertyToRules(
  field: string,
  schema: JsonObject,
  required: boolean,
  warnings: string[],
  context: string,
): Rule[] {
  const rules: Rule[] = [];
  const type = schema.type;
  const optional = !required;

  if (Array.isArray(schema.enum)) {
    warnings.push(`${context}.${field}: enum validation is not supported by the Envoy filter yet`);
  }

  if (type === 'string' || schema.format || schema.minLength !== undefined || schema.maxLength !== undefined) {
    const formatRule = formatToValidator(schema.format);
    if (formatRule) {
      rules.push({ field, validator: formatRule, optional });
    } else if (schema.format !== undefined) {
      warnings.push(`${context}.${field}: string format '${String(schema.format)}' is not supported by the Envoy filter yet`);
    }

    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      rules.push({
        field,
        validator: 'str_len',
        min: integerOrDefault(schema.minLength, 0),
        max: integerOrDefault(schema.maxLength, 2147483647),
        optional,
      });
    }
  } else if (type === 'integer' || type === 'number' || schema.minimum !== undefined || schema.maximum !== undefined) {
    const hasFloatRange =
      (typeof schema.minimum === 'number' && !Number.isInteger(schema.minimum)) ||
      (typeof schema.maximum === 'number' && !Number.isInteger(schema.maximum));

    if (type === 'number' && hasFloatRange) {
      warnings.push(`${context}.${field}: floating-point ranges are not supported by the Envoy filter yet; using integer range validation`);
    }

    if (schema.minimum !== undefined || schema.maximum !== undefined || type === 'integer') {
      rules.push({
        field,
        validator: 'int',
        min: integerOrDefault(schema.minimum, '-9223372036854775808'),
        max: integerOrDefault(schema.maximum, '9223372036854775807'),
        optional,
      });
    }
  } else if (type === 'boolean') {
    // The current WASM filter can check presence, not boolean value shape.
  } else if (type === 'array' || type === 'object') {
    warnings.push(`${context}.${field}: nested object/array validation is not supported by the Envoy filter yet`);
  }

  if (required && rules.length === 0) {
    rules.push({ field, validator: 'required' });
  }

  return rules;
}

function formatToValidator(format: unknown): string | null {
  if (!isString(format)) return null;

  switch (format.toLowerCase()) {
    case 'email':
      return 'email';
    case 'uuid':
      return 'uuid';
    case 'ipv4':
      return 'ipv4';
    case 'uri':
    case 'url':
      return 'url';
    default:
      return null;
  }
}

function renderRules(routes: RouteRule[]): string {
  return routes
    .map(route => `${route.method}${route.bodyRequired ? '' : '?'} ${route.path}=${route.rules.map(renderRule).join(',')}`)
    .join(';');
}

function renderRule(rule: Rule): string {
  const validator = `${rule.optional ? '?' : ''}${rule.validator}`;
  if (rule.min !== undefined || rule.max !== undefined) {
    return `${rule.field}:${validator}:${rule.min ?? 0}:${rule.max ?? 0}`;
  }
  return `${rule.field}:${validator}`;
}

function sortRoutes(routes: RouteRule[]): RouteRule[] {
  return [...routes].sort((a, b) => {
    const specificity = routeSpecificity(b) - routeSpecificity(a);
    if (specificity !== 0) return specificity;
    return b.path.length - a.path.length;
  });
}

function routeSpecificity(route: RouteRule): number {
  return route.path
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => {
      const isParameter = segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}'));
      return score + (isParameter ? 1 : 10);
    }, 0);
}

function warnForEnvoyLimits(routes: RouteRule[], rules: string, warnings: string[]): void {
  const totalRules = routes.reduce((sum, route) => sum + route.rules.length, 0);

  if (rules.length > 16 * 1024) {
    warnings.push('generated Envoy rules exceed the WASM filter 16 KiB config limit and may be truncated');
  }
  if (routes.length > 64) {
    warnings.push('generated Envoy route count exceeds the WASM filter limit of 64 routes');
  }
  if (totalRules > 512) {
    warnings.push('generated Envoy validation rule count exceeds the WASM filter limit of 512 rules');
  }
}

function renderOutput(rules: string, mode: EnvoyOutputMode, options: EnvoyGenerateOptions): string {
  switch (mode) {
    case 'rules':
      return `${rules}\n`;
    case 'full':
      return renderFullEnvoyConfig(rules, options);
    case 'filter':
    default:
      return renderFilterSnippet(rules, options);
  }
}

function renderFilterSnippet(rules: string, options: EnvoyGenerateOptions): string {
  const wasmPath = options.wasmPath ?? '/etc/envoy/dhi-envoy.wasm';
  const failOpen = options.failOpen === true ? 'true' : 'false';
  return [
    '- name: envoy.filters.http.wasm',
    '  typed_config:',
    '    "@type": type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm',
    '    config:',
    '      name: dhi_validation',
    '      root_id: dhi_validator',
    '      vm_config:',
    '        vm_id: dhi_vm',
    '        runtime: envoy.wasm.runtime.v8',
    '        code:',
    '          local:',
    `            filename: ${wasmPath}`,
    '      configuration:',
    '        "@type": type.googleapis.com/google.protobuf.StringValue',
    `        value: ${quoteYamlString(rules)}`,
    `      fail_open: ${failOpen}`,
    '- name: envoy.filters.http.router',
    '  typed_config:',
    '    "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router',
    '',
  ].join('\n');
}

function renderFullEnvoyConfig(rules: string, options: EnvoyGenerateOptions): string {
  const wasmPath = options.wasmPath ?? '/etc/envoy/dhi-envoy.wasm';
  const clusterName = options.clusterName ?? 'api_service';
  const upstreamHost = options.upstreamHost ?? 'api';
  const upstreamPort = options.upstreamPort ?? 8080;
  const listenPort = options.listenPort ?? 8000;
  const dnsLookupFamily = options.dnsLookupFamily ?? 'V4_ONLY';

  return [
    'static_resources:',
    '  listeners:',
    '  - name: main',
    '    address:',
    '      socket_address:',
    '        address: 0.0.0.0',
    `        port_value: ${listenPort}`,
    '    filter_chains:',
    '    - filters:',
    '      - name: envoy.filters.network.http_connection_manager',
    '        typed_config:',
    '          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager',
    '          codec_type: AUTO',
    '          stat_prefix: ingress_http',
    '          access_log:',
    '          - name: envoy.access_loggers.stdout',
    '            typed_config:',
    '              "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog',
    '          route_config:',
    '            name: local_route',
    '            virtual_hosts:',
    '            - name: backend',
    '              domains:',
    '              - "*"',
    '              routes:',
    '              - match:',
    '                  prefix: "/"',
    '                route:',
    `                  cluster: ${clusterName}`,
    '          http_filters:',
    indent(renderFilterSnippet(rules, { ...options, wasmPath }), 10),
    '  clusters:',
    `  - name: ${clusterName}`,
    '    type: STRICT_DNS',
    `    dns_lookup_family: ${dnsLookupFamily}`,
    '    lb_policy: ROUND_ROBIN',
    '    load_assignment:',
    `      cluster_name: ${clusterName}`,
    '      endpoints:',
    '      - lb_endpoints:',
    '        - endpoint:',
    '            address:',
    '              socket_address:',
    `                address: ${upstreamHost}`,
    `                port_value: ${upstreamPort}`,
    '',
  ].join('\n');
}

function resolveMaybeRef(value: unknown, spec: JsonObject): unknown {
  if (!isObject(value) || !isString(value.$ref)) return value;
  return resolveRef(value.$ref, spec) ?? value;
}

function resolveSchema(schema: JsonObject, spec: JsonObject): JsonObject {
  const resolved = resolveMaybeRef(schema, spec);
  return isObject(resolved) ? resolved : schema;
}

function resolveRef(ref: string, spec: JsonObject): unknown {
  if (!ref.startsWith('#/')) return undefined;

  return ref
    .slice(2)
    .split('/')
    .map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, part) => (isObject(current) ? current[part] : undefined), spec);
}

function mergeComposedSchema(schema: JsonObject, spec: JsonObject): JsonObject {
  if (!Array.isArray(schema.allOf)) return schema;

  const merged: JsonObject = { ...schema, allOf: undefined };
  const properties: JsonObject = {};
  const required = new Set<string>();

  for (const item of schema.allOf) {
    if (!isObject(item)) continue;
    const resolved = mergeComposedSchema(resolveSchema(item, spec), spec);
    Object.assign(merged, resolved);
    if (isObject(resolved.properties)) Object.assign(properties, resolved.properties);
    if (Array.isArray(resolved.required)) {
      for (const key of resolved.required) {
        if (isString(key)) required.add(key);
      }
    }
  }

  if (isObject(schema.properties)) Object.assign(properties, schema.properties);
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (isString(key)) required.add(key);
    }
  }

  if (Object.keys(properties).length > 0) merged.properties = properties;
  if (required.size > 0) merged.required = [...required];
  return merged;
}

function integerOrDefault(value: unknown, fallback: string | number): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return value;
  return fallback;
}

function asObject(value: unknown, name: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`OpenAPI document is missing an object '${name}' field`);
  }
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}

function indent(value: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return value
    .trimEnd()
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}
