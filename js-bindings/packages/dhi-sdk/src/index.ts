/**
 * dhi-sdk - Generate TypeScript SDKs from Hono + dhi apps
 *
 * Like Stainless/Fern, but code-first. No separate API spec to maintain.
 *
 * Usage:
 *   npx dhi-sdk generate ./src/api.ts --output ./sdk
 *
 * Or programmatically:
 *   import { RouteExtractor, SDKGenerator } from 'dhi-sdk';
 *
 *   const extractor = new RouteExtractor();
 *   const api = await extractor.extract('./src/api.ts');
 *
 *   const generator = new SDKGenerator(api, { output: './sdk' });
 *   const sdk = generator.generate();
 */

export { RouteExtractor } from './extractor.js';
export { SDKGenerator } from './generator.js';
export { generateEnvoyFromOpenApi, parseOpenApiDocument } from './envoy.js';
export type { EnvoyGenerateOptions, EnvoyGenerationResult } from './envoy.js';
export * from './types.js';
