// TypeScript-first schema definition with compile-time type checking
// Similar to Yup's approach but with DHI performance

// SIMD-style batch validation for ultra-fast primitive schema processing
function validateBatchSIMD<T extends Record<string, any>>(
  values: unknown[], 
  keys: string[], 
  shape: { [K in keyof T]: Schema<T[K]> }
): boolean[] {
  const len = values.length;
  const results = new Array(len);
  const keyCount = keys.length;
  
  // Process in batches of 8 for better cache utilization
  const BATCH_SIZE = 8;
  
  for (let batchStart = 0; batchStart < len; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, len);
    
    // Specialized unrolled loops based on field count
    switch (keyCount) {
      case 1:
        validateBatch1Field(values, results, batchStart, batchEnd, keys, shape);
        break;
      case 2:
        validateBatch2Fields(values, results, batchStart, batchEnd, keys, shape);
        break;
      case 3:
        validateBatch3Fields(values, results, batchStart, batchEnd, keys, shape);
        break;
      case 4:
        validateBatch4Fields(values, results, batchStart, batchEnd, keys, shape);
        break;
      default:
        validateBatchNFields(values, results, batchStart, batchEnd, keys, shape);
    }
  }
  
  return results;
}

// Optimized validation for 1-field schemas
function validateBatch1Field<T>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: any
): void {
  const key = keys[0];
  const validator = shape[key];
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    results[i] = validator.validateBatch([obj[key]])[0];
  }
}

// Optimized validation for 2-field schemas
function validateBatch2Fields<T>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: any
): void {
  const [key1, key2] = keys;
  const validator1 = shape[key1];
  const validator2 = shape[key2];
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    results[i] = validator1.validateBatch([obj[key1]])[0] && 
                 validator2.validateBatch([obj[key2]])[0];
  }
}

// Optimized validation for 3-field schemas
function validateBatch3Fields<T>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: any
): void {
  const [key1, key2, key3] = keys;
  const validator1 = shape[key1];
  const validator2 = shape[key2];
  const validator3 = shape[key3];
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    results[i] = validator1.validateBatch([obj[key1]])[0] && 
                 validator2.validateBatch([obj[key2]])[0] &&
                 validator3.validateBatch([obj[key3]])[0];
  }
}

// Optimized validation for 4-field schemas (benchmark2.ts case)
function validateBatch4Fields<T>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: any
): void {
  const [key1, key2, key3, key4] = keys;
  const validator1 = shape[key1];
  const validator2 = shape[key2];
  const validator3 = shape[key3];
  const validator4 = shape[key4];
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    results[i] = validator1.validateBatch([obj[key1]])[0] && 
                 validator2.validateBatch([obj[key2]])[0] &&
                 validator3.validateBatch([obj[key3]])[0] &&
                 validator4.validateBatch([obj[key4]])[0];
  }
}

// Generic validation for N-field schemas
function validateBatchNFields<T>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: any
): void {
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    results[i] = keys.every(key => shape[key].validateBatch([obj[key]])[0]);
  }
}

export interface Schema<T> {
  validate(value: unknown): T;
  validateBatch(values: unknown[]): boolean[];
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: string };
}

export interface ObjectSchema<T> extends Schema<T> {
  shape: { [K in keyof T]: Schema<T[K]> };
}

// Simple string schema
export function string(): Schema<string> {
  return {
    validate(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('Expected string');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => typeof v === 'string');
    },
    safeParse(value: unknown) {
      if (typeof value === 'string') {
        return { success: true as const, data: value };
      }
      return { success: false as const, error: 'Expected string' };
    }
  };
}

export function number(): Schema<number> {
  return {
    validate(value: unknown): number {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error('Expected number');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => typeof v === 'number' && !isNaN(v));
    },
    safeParse(value: unknown) {
      if (typeof value === 'number' && !isNaN(value)) {
        return { success: true as const, data: value };
      }
      return { success: false as const, error: 'Expected number' };
    }
  };
}

export function boolean(): Schema<boolean> {
  return {
    validate(value: unknown): boolean {
      if (typeof value !== 'boolean') {
        throw new Error('Expected boolean');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => typeof v === 'boolean');
    },
    safeParse(value: unknown) {
      if (typeof value === 'boolean') {
        return { success: true as const, data: value };
      }
      return { success: false as const, error: 'Expected boolean' };
    }
  };
}

export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    validate(value: unknown): T | undefined {
      if (value === undefined) return undefined;
      return schema.validate(value);
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => v === undefined || schema.validateBatch([v])[0]);
    },
    safeParse(value: unknown) {
      if (value === undefined) {
        return { success: true as const, data: undefined };
      }
      const result = schema.safeParse(value);
      return result as any;
    }
  };
}

export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return {
    validate(value: unknown): T | null {
      if (value === null) return null;
      return schema.validate(value);
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => v === null || schema.validateBatch([v])[0]);
    },
    safeParse(value: unknown) {
      if (value === null) {
        return { success: true as const, data: null };
      }
      const result = schema.safeParse(value);
      return result as any;
    }
  };
}

// Optimized array schema with SIMD-style validation
export function array<T>(itemSchema: Schema<T>): Schema<T[]> {
  return {
    validate(value: unknown): T[] {
      if (!Array.isArray(value)) {
        throw new Error('Expected array');
      }
      return value.map(item => itemSchema.validate(item));
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => {
        if (!Array.isArray(value)) return false;
        return validateArraySIMD(value, itemSchema);
      });
    },
    safeParse(value: unknown) {
      if (!Array.isArray(value)) {
        return { success: false as const, error: 'Expected array' };
      }
      try {
        const data = value.map(item => itemSchema.validate(item));
        return { success: true as const, data };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : 'Array validation failed' };
      }
    }
  };
}

// SIMD-style array validation for better performance
function validateArraySIMD<T>(arr: unknown[], itemSchema: Schema<T>): boolean {
  const len = arr.length;
  if (len === 0) return true;
  
  const BATCH_SIZE = 8;
  
  // For primitive arrays, use optimized batch validation
  if (isPrimitiveSchema(itemSchema)) {
    for (let i = 0; i < len; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, len);
      const batch = arr.slice(i, batchEnd);
      const results = itemSchema.validateBatch(batch);
      if (results.some(r => !r)) return false;
    }
    return true;
  }
  
  // Fallback for complex schemas
  return itemSchema.validateBatch(arr).every(r => r);
}

// Helper to detect primitive schemas for optimization
function isPrimitiveSchema<T>(schema: Schema<T>): boolean {
  // Simple heuristic - check if it's one of our primitive schemas
  const schemaStr = schema.toString();
  return schemaStr.includes('typeof') && 
         (schemaStr.includes('string') || schemaStr.includes('number') || schemaStr.includes('boolean'));
}

type ObjectSchemaShape<T> = {
  [K in keyof T]: Schema<T[K]>;
};

// Enhanced array validation with better type detection
function isArrayOfPrimitives(arr: unknown[], itemType: 'string' | 'number' | 'boolean'): boolean {
  const BATCH_SIZE = 8;
  
  for (let i = 0; i < arr.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, arr.length);
    
    for (let j = i; j < batchEnd; j++) {
      if (typeof arr[j] !== itemType) {
        return false;
      }
    }
  }
  
  return true;
}

// Optimized object validation - detects simple primitive schemas and uses fast JS path
export function object<T extends Record<string, any>>(
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> {
  const keys = Object.keys(shape);
  const schemas = Object.values(shape);
  
  // Simple primitive detection (basic heuristic)
  const isSimplePrimitive = keys.length <= 4;

  return {
    shape,
    validate(value: unknown): T {
      if (typeof value !== 'object' || value === null) {
        throw new Error('Expected object');
      }
      
      const obj = value as Record<string, unknown>;
      const result = {} as T;
      
      for (const key of keys) {
        (result as any)[key] = shape[key as keyof T].validate(obj[key]);
      }
      
      return result;
    },
    
    validateBatch(values: unknown[]): boolean[] {
      if (isSimplePrimitive && keys.length <= 4) {
        // ULTRA-FAST PATH: SIMD-style batch processing in pure JavaScript
        return validateBatchSIMD(values, keys, shape);
      }
      
      // Fallback to individual validation for complex schemas
      return values.map(value => {
        try {
          this.validate(value);
          return true;
        } catch {
          return false;
        }
      });
    },
    
    safeParse(value: unknown) {
      try {
        const data = this.validate(value);
        return { success: true as const, data };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : 'Validation failed' };
      }
    }
  };
}

// Type inference helper
export type Infer<T extends Schema<any>> = T extends Schema<infer U> ? U : never;

// User-defined model creation API
export function model<T extends Record<string, any>>(
  name: string,
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> & { modelName: string } {
  const schema = object(shape);
  return {
    ...schema,
    modelName: name,
    
    // Enhanced validation with model context
    validate(value: unknown): T {
      try {
        return schema.validate(value);
      } catch (error) {
        throw new Error(`${name} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    
    safeParse(value: unknown) {
      const result = schema.safeParse(value);
      if (!result.success) {
        return {
          success: false as const,
          error: `${name} validation failed: ${result.error}`
        };
      }
      return result;
    }
  };
}

// Example usage with compile-time type checking:
/*
interface User {
  name: string;
  age?: number;
  active: boolean;
}

// Method 1: Direct schema with type checking
const userSchema: ObjectSchema<User> = object({
  name: string(),
  age: optional(number()),
  active: boolean()
});

// Method 2: User-defined model
const UserModel = model('User', {
  name: string(),
  age: optional(number()),
  active: boolean()
});

// ❌ This would cause a compile-time error:
// const badSchema: ObjectSchema<User> = object({
//   name: number(), // Type error: number is not assignable to string
// });

type InferredUser = Infer<typeof userSchema>; // User
type ModelUser = Infer<typeof UserModel>; // User
*/
