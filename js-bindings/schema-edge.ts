/**
 * dhi - Edge Runtime entry (Vercel Edge, Deno, ...)
 *
 * Re-exports the runtime-agnostic core from `schema-core.ts`: no top-level
 * await, no Node built-ins, no WASM instantiation. Identical API and
 * behaviour to the default `dhi` entry.
 *
 * Usage:
 *   import { z } from 'dhi/edge';
 */

export * from './schema-core.js';
export { default } from './schema-core.js';
