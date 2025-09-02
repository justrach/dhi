// Legacy WASM-based API
export { dhi, createType } from './core';

// TypeScript-first API with compile-time type checking (RECOMMENDED)
export {
  object,
  string,
  number,
  boolean,
  array,
  record,
  model,
  union,
  discriminatedUnion,
  optional,
  nullable,
  type Schema,
  type ObjectSchema
} from './typed';

// Rename the Infer type to avoid conflicts
export { type Infer as TypedInfer } from './typed';

// 🚨 TEMPORARY: Zod compatibility layer (will be removed in future versions)
// For migration purposes only - use native DHI API above for best performance
export { z, ZodError } from './zod-compat';

// Optional hybrid validator that auto-picks typed vs WASM for batches
export { createHybridValidator } from './hybrid';
