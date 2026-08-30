/**
 * dhi - Ultra-fast Zod 4 drop-in replacement (default entry: Node, Bun)
 *
 * The implementation lives in `schema-core.ts`. Every package entry point
 * (`dhi`, `dhi/edge`, `dhi/cloudflare`, `dhi/nextjs`) re-exports that same
 * runtime-agnostic core, so behaviour and types are identical everywhere and
 * no entry point needs top-level await, Node built-ins or WASM instantiation.
 *
 * Usage:
 *   import { z } from 'dhi';
 *   const schema = z.object({ name: z.string(), age: z.number() });
 *   type User = z.infer<typeof schema>;
 */

export * from './schema-core.js';
export { default } from './schema-core.js';
