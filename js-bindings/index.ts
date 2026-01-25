/**
 * dhi - Ultra-Fast Data Validation for JavaScript/TypeScript
 * Full Zod 4 API compatibility with SIMD-powered WASM backend
 *
 * Usage:
 *   import { z } from 'dhi';
 *   const schema = z.object({ name: z.string(), age: z.number() });
 *   type User = z.infer<typeof schema>;
 */

// Re-export the full Zod-compatible API from schema
export {
  z,
  d,
  type infer,
  type input,
  type output,
  ZodError,
  DhiType,
} from "./schema.js";

// Re-export z as default for compatibility
export { default } from "./schema.js";

// ============================================================================
// Low-level WASM validators (for advanced use cases)
// ============================================================================

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load WASM module
const __dir = typeof import.meta.dir === "string"
  ? import.meta.dir
  : dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dir, "dhi.wasm");
const wasmBytes = readFileSync(wasmPath);
const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
const wasm = wasmModule.instance.exports as any;

const encoder = new TextEncoder();

function passString(str: string): { ptr: number; len: number } {
  const bytes = encoder.encode(str);
  const ptr = wasm.alloc(bytes.length);
  const memory = new Uint8Array(wasm.memory.buffer);
  memory.set(bytes, ptr);
  return { ptr, len: bytes.length };
}

function freeString(ptr: number, len: number) {
  wasm.dealloc(ptr, len);
}

/**
 * Low-level WASM validators for direct access to validation primitives.
 * For most use cases, prefer using the `z` API instead.
 */
export const validators = {
  email: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_email(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  url: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_url(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  uuid: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_uuid(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  ipv4: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_ipv4(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  string: (value: string, min: number, max: number): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_string_length(ptr, len, min, max);
    freeString(ptr, len);
    return Boolean(result);
  },

  isoDate: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_iso_date(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  isoDatetime: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_iso_datetime(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  base64: (value: string): boolean => {
    const { ptr, len } = passString(value);
    const result = wasm.validate_base64(ptr, len);
    freeString(ptr, len);
    return Boolean(result);
  },

  positive: (value: number): boolean => {
    return Boolean(wasm.validate_int_positive_i32(value | 0));
  },

  negative: (value: number): boolean => {
    return Boolean(wasm.validate_int_negative_i32(value | 0));
  },

  intRange: (value: number, min: number, max: number): boolean => {
    return Boolean(wasm.validate_int_i32(value | 0, min | 0, max | 0));
  },

  intGt: (value: number, min: number): boolean => {
    return Boolean(wasm.validate_int_gt_i32(value | 0, min | 0));
  },

  intGte: (value: number, min: number): boolean => {
    return Boolean(wasm.validate_int_gte_i32(value | 0, min | 0));
  },

  intLt: (value: number, max: number): boolean => {
    return Boolean(wasm.validate_int_lt_i32(value | 0, max | 0));
  },

  intLte: (value: number, max: number): boolean => {
    return Boolean(wasm.validate_int_lte_i32(value | 0, max | 0));
  },

  intMultipleOf: (value: number, divisor: number): boolean => {
    return Boolean(wasm.validate_int_multiple_of_i32(value | 0, divisor | 0));
  },
};
