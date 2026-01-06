/**
 * dhi - Ultra-Fast Data Validation for JavaScript/TypeScript
 * Optimized with Python's techniques: batch processing, enum dispatch, cached lookups
 * Universal WASM implementation - works everywhere!
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load WASM module
const wasmPath = join(import.meta.dir || __dirname, "dhi.wasm");
const wasmBytes = readFileSync(wasmPath);
const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
const wasm = wasmModule.instance.exports as any;

// Text encoder/decoder
const encoder = new TextEncoder();

// Validator type enum (matches WASM)
const ValidatorType = {
  email: 0,
  url: 1,
  uuid: 2,
  ipv4: 3,
  isoDate: 4,
  isoDatetime: 5,
  base64: 6,
  string: 7,
} as const;

// Cached field specs for batch validation
const schemaCache = new WeakMap<Schema, CachedSchema>();

interface CachedSchema {
  fields: Array<{
    name: string;
    type: number;
    param1: number;
    param2: number;
  }>;
  specBuffer: Uint8Array;
}

function cacheSchema(schema: Schema): CachedSchema {
  const cached = schemaCache.get(schema);
  if (cached) return cached;

  const fields = Object.entries(schema).map(([name, validator]) => {
    let type = 0;
    let param1 = 0;
    let param2 = 0;

    switch (validator.type) {
      case "email":
        type = ValidatorType.email;
        break;
      case "url":
        type = ValidatorType.url;
        break;
      case "uuid":
        type = ValidatorType.uuid;
        break;
      case "ipv4":
        type = ValidatorType.ipv4;
        break;
      case "isoDate":
        type = ValidatorType.isoDate;
        break;
      case "isoDatetime":
        type = ValidatorType.isoDatetime;
        break;
      case "base64":
        type = ValidatorType.base64;
        break;
      case "string":
        type = ValidatorType.string;
        param1 = validator.min;
        param2 = validator.max;
        break;
    }

    return { name, type, param1, param2 };
  });

  // Build spec buffer: [num_fields][type][param1][param2]...
  const specBuffer = new Uint8Array(1 + fields.length * 9);
  specBuffer[0] = fields.length;
  let offset = 1;

  for (const field of fields) {
    specBuffer[offset++] = field.type;
    // param1 (4 bytes)
    new DataView(specBuffer.buffer).setInt32(offset, field.param1, true);
    offset += 4;
    // param2 (4 bytes)
    new DataView(specBuffer.buffer).setInt32(offset, field.param2, true);
    offset += 4;
  }

  const result = { fields, specBuffer };
  schemaCache.set(schema, result);
  return result;
}

// Helper functions
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

// Individual validators (for single-item validation)
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

  // 🚀 NEW i32 validators (no BigInt needed!)
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

// Type definitions
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface Schema {
  [key: string]: Validator;
}

export type Validator =
  | { type: "email" }
  | { type: "url" }
  | { type: "uuid" }
  | { type: "ipv4" }
  | { type: "isoDate" }
  | { type: "isoDatetime" }
  | { type: "base64" }
  | { type: "string"; min: number; max: number }
  | { type: "positive" };

// Single item validation
export function validate(data: any, schema: Schema): ValidationResult {
  const errors: string[] = [];
  const cached = cacheSchema(schema);

  for (const field of cached.fields) {
    const value = data[field.name];

    if (value === undefined) {
      errors.push(`Missing field: ${field.name}`);
      continue;
    }

    let valid = false;

    switch (field.type) {
      case ValidatorType.email:
        valid = validators.email(value);
        if (!valid) errors.push(`${field.name}: Invalid email`);
        break;
      case ValidatorType.url:
        valid = validators.url(value);
        if (!valid) errors.push(`${field.name}: Invalid URL`);
        break;
      case ValidatorType.uuid:
        valid = validators.uuid(value);
        if (!valid) errors.push(`${field.name}: Invalid UUID`);
        break;
      case ValidatorType.ipv4:
        valid = validators.ipv4(value);
        if (!valid) errors.push(`${field.name}: Invalid IPv4`);
        break;
      case ValidatorType.isoDate:
        valid = validators.isoDate(value);
        if (!valid) errors.push(`${field.name}: Invalid ISO date`);
        break;
      case ValidatorType.isoDatetime:
        valid = validators.isoDatetime(value);
        if (!valid) errors.push(`${field.name}: Invalid ISO datetime`);
        break;
      case ValidatorType.base64:
        valid = validators.base64(value);
        if (!valid) errors.push(`${field.name}: Invalid base64`);
        break;
      case ValidatorType.string:
        valid = validators.string(value, field.param1, field.param2);
        if (!valid)
          errors.push(`${field.name}: String length must be ${field.param1}-${field.param2}`);
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// OPTIMIZED: Batch validation with single WASM call
export function validateBatch(items: any[], schema: Schema): ValidationResult[] {
  const cached = cacheSchema(schema);

  // Build items buffer: [count][field1_len][field1_data][field2_len][field2_data]...
  let totalSize = 4; // item count
  const itemBuffers: Uint8Array[] = [];

  for (const item of items) {
    for (const field of cached.fields) {
      const value = String(item[field.name] || "");
      const bytes = encoder.encode(value);
      totalSize += 4 + bytes.length; // length + data
      itemBuffers.push(bytes);
    }
  }

  const itemsBuffer = new Uint8Array(totalSize);
  const view = new DataView(itemsBuffer.buffer);
  view.setUint32(0, items.length, true);

  let offset = 4;
  let bufferIdx = 0;
  for (let i = 0; i < items.length; i++) {
    for (let f = 0; f < cached.fields.length; f++) {
      const bytes = itemBuffers[bufferIdx++];
      view.setUint32(offset, bytes.length, true);
      offset += 4;
      itemsBuffer.set(bytes, offset);
      offset += bytes.length;
    }
  }

  // Allocate WASM memory
  const specPtr = wasm.alloc(cached.specBuffer.length);
  const itemsPtr = wasm.alloc(itemsBuffer.length);

  const memory = new Uint8Array(wasm.memory.buffer);
  memory.set(cached.specBuffer, specPtr);
  memory.set(itemsBuffer, itemsPtr);

  // Call optimized batch validation
  const resultsPtr = wasm.validate_batch_optimized(
    specPtr,
    cached.specBuffer.length,
    itemsPtr,
    itemsBuffer.length
  );

  // Read results
  const results: ValidationResult[] = [];
  const resultsMemory = new Uint8Array(wasm.memory.buffer);

  for (let i = 0; i < items.length; i++) {
    const valid = resultsMemory[resultsPtr + i] === 1;
    results.push({ valid, errors: valid ? undefined : ["Validation failed"] });
  }

  // Cleanup
  wasm.dealloc(specPtr, cached.specBuffer.length);
  wasm.dealloc(itemsPtr, itemsBuffer.length);
  wasm.dealloc(resultsPtr, items.length);

  return results;
}

// Zod-like API
export const z = {
  string: (min?: number, max?: number) => ({
    type: "string" as const,
    min: min ?? 0,
    max: max ?? 1000000,
  }),

  email: () => ({ type: "email" as const }),
  url: () => ({ type: "url" as const }),
  uuid: () => ({ type: "uuid" as const }),
  ipv4: () => ({ type: "ipv4" as const }),
  isoDate: () => ({ type: "isoDate" as const }),
  isoDatetime: () => ({ type: "isoDatetime" as const }),
  base64: () => ({ type: "base64" as const }),

  positive: () => ({ type: "positive" as const }),
};

// Export for convenience
export default { validate, validateBatch, validators, z };
