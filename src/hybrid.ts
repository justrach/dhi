import type { ObjectSchema } from './typed';
import type { DhiType } from './core';

export type HybridOptions = {
  threshold?: number; // invalid-rate threshold to switch to WASM (0..1)
  sample?: number;    // number of items to sample for rate estimate
};

export type HybridValidator<T> = {
  validate(value: unknown): T;                     // delegates to typed
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
  validateBatch(values: unknown[]): boolean[];     // auto-picks engine
};

export function createHybridValidator<T>(
  typedSchema: ObjectSchema<T>,
  wasmSchema: DhiType<T>,
  opts: HybridOptions = {}
): HybridValidator<T> {
  const threshold = opts.threshold ?? 0.3;
  const sampleN = opts.sample ?? 200;

  function validateBatchAuto(values: unknown[]): boolean[] {
    const n = values.length;
    if (n === 0) return [];
    const sample = Math.min(sampleN, n);
    let invalid = 0;
    // Cheap estimation using typed fast-path
    for (let i = 0; i < sample; i++) {
      if (!typedSchema.validateBatch([values[i]])[0]) invalid++;
    }
    const rate = invalid / sample;
    if (rate > threshold) {
      // WASM returns ValidationResult[]; map to booleans
      const res = wasmSchema.validate_batch(values as any);
      const out = new Array<boolean>(n);
      for (let i = 0; i < n; i++) out[i] = !!res[i]?.success;
      return out;
    }
    return typedSchema.validateBatch(values);
  }

  return {
    validate(value: unknown): T { return typedSchema.validate(value); },
    safeParse(value: unknown) { return typedSchema.safeParse(value); },
    validateBatch: validateBatchAuto,
  };
}

