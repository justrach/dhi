#!/usr/bin/env node
/**
 * dhi-sdk CLI
 *
 * Generate TypeScript SDKs from Hono + dhi apps
 *
 * Usage:
 *   dhi-sdk generate ./src/api.ts --output ./sdk
 *   dhi-sdk generate ./src/api.ts --output ./sdk --openapi
 */

import { Command } from 'commander';
import { resolve, dirname, join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { RouteExtractor } from './extractor.js';
import { SDKGenerator } from './generator.js';
import { generateEnvoyFromOpenApi, parseOpenApiDocument, type EnvoyGenerateOptions } from './envoy.js';
import type { GenerateOptions } from './types.js';

const program = new Command();

program
  .name('dhi-sdk')
  .description('Generate TypeScript SDKs from Hono + dhi apps')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate SDK from a Hono app file')
  .argument('<input>', 'Path to Hono app file (e.g., ./src/api.ts)')
  .option('-o, --output <dir>', 'Output directory', './sdk')
  .option('-n, --name <name>', 'SDK name', 'api')
  .option('--openapi', 'Generate OpenAPI spec', false)
  .option('--base-url <url>', 'Base URL for the client')
  .action(async (input: string, opts) => {
    try {
      await generateSDK({
        input: resolve(input),
        output: resolve(opts.output),
        name: opts.name,
        openapi: opts.openapi,
        baseUrl: opts.baseUrl,
      });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('envoy')
  .description('Generate Envoy WASM validation config from an OpenAPI spec')
  .argument('<openapi>', 'Path to OpenAPI JSON or YAML file')
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .option('--mode <mode>', 'Output mode: rules, filter, or full', 'filter')
  .option('--wasm-path <path>', 'Path to dhi-envoy.wasm inside Envoy', '/etc/envoy/dhi-envoy.wasm')
  .option('--cluster-name <name>', 'Upstream cluster name for --mode full', 'api_service')
  .option('--upstream-host <host>', 'Upstream host for --mode full', 'api')
  .option('--upstream-port <port>', 'Upstream port for --mode full', '8080')
  .option('--listen-port <port>', 'Listener port for --mode full', '8000')
  .option('--dns-lookup-family <family>', 'Envoy STRICT_DNS lookup family: AUTO, V4_ONLY, or V6_ONLY', 'V4_ONLY')
  .option('--fail-open', 'Let Envoy continue traffic if the Proxy-Wasm plugin fails')
  .action(async (input: string, opts) => {
    try {
      await generateEnvoyConfig(resolve(input), {
        output: opts.output ? resolve(opts.output) : undefined,
        mode: parseEnvoyMode(opts.mode),
        wasmPath: opts.wasmPath,
        clusterName: opts.clusterName,
        upstreamHost: opts.upstreamHost,
        upstreamPort: parsePort(opts.upstreamPort, 'upstream-port'),
        listenPort: parsePort(opts.listenPort, 'listen-port'),
        dnsLookupFamily: parseDnsLookupFamily(opts.dnsLookupFamily),
        failOpen: opts.failOpen === true,
      });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

interface EnvoyCliOptions extends EnvoyGenerateOptions {
  output?: string;
}

async function generateSDK(options: GenerateOptions) {
  console.log('');
  console.log('  dhi-sdk - Generate TypeScript SDK from Hono + dhi');
  console.log('  ─'.repeat(25));
  console.log('');

  // Check input file exists
  if (!existsSync(options.input)) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  console.log(`  Input:  ${options.input}`);
  console.log(`  Output: ${options.output}`);
  console.log('');

  // Extract routes
  console.log('  [1/3] Extracting routes from Hono app...');
  const extractor = new RouteExtractor();
  const api = await extractor.extract(options.input);

  console.log(`        Found ${api.routes.length} routes`);
  for (const route of api.routes) {
    console.log(`        - ${route.method.padEnd(6)} ${route.path}`);
  }
  console.log('');

  // Generate SDK
  console.log('  [2/3] Generating SDK...');
  const generator = new SDKGenerator(api, options);
  const sdk = generator.generate();
  console.log('');

  // Write files
  console.log('  [3/3] Writing files...');

  // Create output directory
  await mkdir(options.output, { recursive: true });

  // Write types.ts
  const typesPath = join(options.output, 'types.ts');
  await writeFile(typesPath, sdk.types);
  console.log(`        ✓ ${typesPath}`);

  // Write client.ts
  const clientPath = join(options.output, 'client.ts');
  await writeFile(clientPath, sdk.client);
  console.log(`        ✓ ${clientPath}`);

  // Write index.ts
  const indexPath = join(options.output, 'index.ts');
  await writeFile(indexPath, sdk.index);
  console.log(`        ✓ ${indexPath}`);

  // Write OpenAPI spec if requested
  if (sdk.openapi) {
    const openapiPath = join(options.output, 'openapi.json');
    await writeFile(openapiPath, JSON.stringify(sdk.openapi, null, 2));
    console.log(`        ✓ ${openapiPath}`);
  }

  console.log('');
  console.log('  ✅ SDK generated successfully!');
  console.log('');
  console.log('  Usage:');
  console.log('');
  console.log('    import { createClient } from \'' + options.output + '\';');
  console.log('');
  console.log('    const api = createClient({');
  console.log('      baseUrl: \'https://api.example.com\',');
  console.log('    });');
  console.log('');
  console.log('    // Fully typed!');
  console.log('    const result = await api.users.create({ name: \'Alice\' });');
  console.log('');
}

async function generateEnvoyConfig(input: string, options: EnvoyCliOptions) {
  if (!existsSync(input)) {
    throw new Error(`OpenAPI file not found: ${input}`);
  }

  const source = await readFile(input, 'utf8');
  const spec = parseOpenApiDocument(source, input);
  const result = generateEnvoyFromOpenApi(spec, options);

  if (result.routeCount === 0) {
    throw new Error('No JSON request body schemas were found in the OpenAPI spec');
  }

  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, result.output);
    console.log(`Generated Envoy ${options.mode ?? 'filter'} config for ${result.routeCount} routes: ${options.output}`);
  } else {
    console.log(result.output);
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }
}

function parseEnvoyMode(mode: string): EnvoyGenerateOptions['mode'] {
  if (mode === 'rules' || mode === 'filter' || mode === 'full') return mode;
  throw new Error(`Invalid --mode '${mode}'. Expected one of: rules, filter, full`);
}

function parsePort(value: string, name: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid --${name} '${value}'`);
  }
  return port;
}

function parseDnsLookupFamily(value: string): EnvoyGenerateOptions['dnsLookupFamily'] {
  if (value === 'AUTO' || value === 'V4_ONLY' || value === 'V6_ONLY') return value;
  throw new Error(`Invalid --dns-lookup-family '${value}'. Expected one of: AUTO, V4_ONLY, V6_ONLY`);
}

// Run CLI
program.parse();
