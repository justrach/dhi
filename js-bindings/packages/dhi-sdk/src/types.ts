/**
 * Core types for dhi-sdk generator
 */

/** HTTP methods supported */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Extracted route information */
export interface ExtractedRoute {
  /** HTTP method */
  method: HttpMethod;
  /** Route path (e.g., '/users/:id') */
  path: string;
  /** Path parameters (e.g., ['id']) */
  pathParams: string[];
  /** Query parameter schema (if any) */
  querySchema?: ExtractedSchema;
  /** Request body schema (if any) */
  bodySchema?: ExtractedSchema;
  /** Response schema (if any) */
  responseSchema?: ExtractedSchema;
  /** Route description/summary */
  description?: string;
  /** Handler function name */
  handlerName?: string;
}

/** Extracted schema from dhi/zod */
export interface ExtractedSchema {
  /** Original schema code/AST */
  code: string;
  /** Schema type (object, string, number, etc.) */
  type: SchemaType;
  /** For object schemas, the properties */
  properties?: Record<string, ExtractedSchemaProperty>;
  /** Required properties */
  required?: string[];
  /** For enum schemas, the values */
  enumValues?: string[];
  /** For array schemas, the item type */
  itemSchema?: ExtractedSchema;
  /** For union schemas, the variants */
  variants?: ExtractedSchema[];
  /** Discriminator key for discriminated unions */
  discriminator?: string;
  /** Generated TypeScript type */
  tsType?: string;
  /** Generated JSON Schema */
  jsonSchema?: object;
}

export interface ExtractedSchemaProperty {
  type: SchemaType;
  optional: boolean;
  description?: string;
  schema?: ExtractedSchema;
}

export type SchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'enum'
  | 'union'
  | 'discriminatedUnion'
  | 'literal'
  | 'unknown';

/** API definition extracted from Hono app */
export interface ExtractedAPI {
  /** Base path/prefix */
  basePath: string;
  /** All extracted routes */
  routes: ExtractedRoute[];
  /** Shared schemas (for reuse) */
  schemas: Map<string, ExtractedSchema>;
}

/** SDK generation options */
export interface GenerateOptions {
  /** Input file path (Hono app) */
  input: string;
  /** Output directory */
  output: string;
  /** SDK name (defaults to 'api') */
  name?: string;
  /** Generate OpenAPI spec */
  openapi?: boolean;
  /** Base URL for the client */
  baseUrl?: string;
}

/** Generated SDK files */
export interface GeneratedSDK {
  /** client.ts - The API client */
  client: string;
  /** types.ts - TypeScript types */
  types: string;
  /** index.ts - Exports */
  index: string;
  /** openapi.json - OpenAPI spec (optional) */
  openapi?: object;
}
