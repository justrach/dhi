// TypeScript-first schema definition with compile-time type checking
// Similar to Yup's approach but with DHI performance

// SIMD-style batch validation for ultra-fast primitive schema processing
function validateBatchSIMD<T extends Record<string, unknown>>(
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
function validateBatch1Field<T extends Record<string, unknown>>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: ObjectSchemaShape<T>
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
function validateBatch2Fields<T extends Record<string, unknown>>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: ObjectSchemaShape<T>
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
function validateBatch3Fields<T extends Record<string, unknown>>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: ObjectSchemaShape<T>
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
function validateBatch4Fields<T extends Record<string, unknown>>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: ObjectSchemaShape<T>
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
function validateBatchNFields<T extends Record<string, unknown>>(
  values: unknown[], results: boolean[], start: number, end: number,
  keys: string[], shape: ObjectSchemaShape<T>
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

// Schema analysis for optimization decisions
function analyzeSchema<T extends Record<string, unknown>>(shape: ObjectSchemaShape<T>): {
  isSimplePrimitive: boolean;
  isNestedObject: boolean;
  maxDepth: number;
  fieldCount: number;
} {
  const keys = Object.keys(shape);
  const fieldCount = keys.length;
  let maxDepth = 1;
  let hasNestedObjects = false;
  let allPrimitive = true;
  
  for (const key of keys) {
    const schema = shape[key];
    if (schema && typeof schema === 'object' && 'shape' in schema) {
      // This is a nested object schema
      hasNestedObjects = true;
      allPrimitive = false;
      const nestedAnalysis = analyzeSchema((schema as ObjectSchema<any>).shape);
      maxDepth = Math.max(maxDepth, nestedAnalysis.maxDepth + 1);
    } else if (schema && typeof schema === 'object' && schema.toString().includes('Array')) {
      // This is an array schema
      allPrimitive = false;
    }
  }
  
  return {
    isSimplePrimitive: allPrimitive && fieldCount <= 4,
    isNestedObject: hasNestedObjects,
    maxDepth,
    fieldCount
  };
}

// Optimized nested object batch validation with aggressive optimizations
function validateNestedObjectsBatch<T extends Record<string, unknown>>(
  values: unknown[],
  keys: string[],
  shape: ObjectSchemaShape<T>,
  maxDepth: number
): boolean[] {
  const len = values.length;
  const results = new Array(len);
  const BATCH_SIZE = 32; // Optimized batch size for cache efficiency
  
  // Pre-compile validation paths and create optimized validator
  const optimizedValidator = createOptimizedNestedValidator(keys, shape);
  
  // Use SIMD-style processing with unrolled loops for common cases
  for (let batchStart = 0; batchStart < len; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, len);
    
    // Unrolled validation for better CPU pipeline utilization
    let i = batchStart;
    while (i < batchEnd - 3) {
      // Process 4 items at once for better instruction-level parallelism
      const v1 = values[i];
      const v2 = values[i + 1];
      const v3 = values[i + 2];
      const v4 = values[i + 3];
      
      results[i] = optimizedValidator(v1);
      results[i + 1] = optimizedValidator(v2);
      results[i + 2] = optimizedValidator(v3);
      results[i + 3] = optimizedValidator(v4);
      
      i += 4;
    }
    
    // Handle remaining items
    while (i < batchEnd) {
      results[i] = optimizedValidator(values[i]);
      i++;
    }
  }
  
  return results;
}

// Create optimized nested validator using general schema-based approach
function createOptimizedNestedValidator<T extends Record<string, unknown>>(keys: string[], shape: ObjectSchemaShape<T>): (obj: unknown) => boolean {
  // Pre-compile validation paths for better performance
  const validationPaths = compileValidationPaths(keys, shape);
  
  // Return a specialized validator function that uses the general approach
  return function(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const target = obj as Record<string, unknown>;
    
    // General validation using schema definitions instead of hardcoded checks
    try {
      return validateObjectWithPaths(target, validationPaths);
    } catch {
      return false;
    }
  };
}

// Generate optimized validation code (placeholder for future JIT compilation)
function generateValidationCode<T extends Record<string, unknown>>(keys: string[], shape: ObjectSchemaShape<T>): string {
  // This could be extended to generate actual optimized code
  return 'optimized';
}

// Compile validation paths for efficient nested validation (legacy fallback)
function compileValidationPaths<T extends Record<string, unknown>>(keys: string[], shape: ObjectSchemaShape<T>): ValidationPath[] {
  const paths: ValidationPath[] = [];
  
  for (const key of keys) {
    const schema = shape[key];
    if (schema && typeof schema === 'object' && 'shape' in schema) {
      // Nested object - flatten the validation path
      const objectSchema = schema as ObjectSchema<any>;
      const nestedPaths = compileValidationPaths(Object.keys(objectSchema.shape), objectSchema.shape);
      for (const nestedPath of nestedPaths) {
        paths.push({
          path: [key, ...nestedPath.path],
          validator: nestedPath.validator
        });
      }
    } else {
      // Direct field
      paths.push({
        path: [key],
        validator: schema
      });
    }
  }
  
  return paths;
}

interface ValidationPath {
  path: string[];
  validator: Schema<unknown>;
}

// Fast nested object validation using pre-compiled paths (legacy fallback)
function validateObjectWithPaths(obj: unknown, paths: ValidationPath[]): boolean {
  const target = obj as Record<string, unknown>;
  
  for (const { path, validator } of paths) {
    let current: any = target;
    
    // Navigate to the nested value
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
      if (typeof current !== 'object' || current === null) {
        return false;
      }
    }
    
    // Validate the final value
    const finalKey = path[path.length - 1];
    const value = current[finalKey];
    
    if (!validator.validateBatch([value])[0]) {
      return false;
    }
  }
  
  return true;
}

export interface Schema<T> {
  validate(value: unknown): T;
  validateBatch(values: unknown[]): boolean[];
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: string };
}

export interface ArraySchema<T> extends Schema<T[]> {
  item: Schema<T>;
}

export interface UnionSchema<T> extends Schema<T> {
  options: Schema<T>[];
}

export interface ObjectSchema<T> extends Schema<T> {
  shape: { [K in keyof T]: Schema<T[K]> };
}

// ... (rest of the code remains the same)

export function array<T>(itemSchema: Schema<T>): ArraySchema<T> {
  return {
    item: itemSchema,
    validate(value: unknown): T[] {
      if (!Array.isArray(value)) {
        throw new Error('Expected array');
      }
      return value.map(item => itemSchema.validate(item));
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => {
        if (!Array.isArray(value)) return false;
        
        // Use optimized validation for primitive arrays
        const itemTypeStr = itemSchema.toString();
        if (itemTypeStr.includes('string')) {
          return isArrayOfPrimitives(value, 'string');
        } else if (itemTypeStr.includes('number')) {
          return isArrayOfPrimitives(value, 'number');
        } else if (itemTypeStr.includes('boolean')) {
          return isArrayOfPrimitives(value, 'boolean');
        }
        
        // Fallback to individual validation
        try {
          value.forEach(item => itemSchema.validate(item));
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
export function object<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> {
  const keys = Object.keys(shape);
  const schemas = Object.values(shape);
  
  // Enhanced schema analysis for better optimization decisions
  const schemaAnalysis = analyzeSchema(shape);
  const isSimplePrimitive = schemaAnalysis.isSimplePrimitive;
  const isNestedObject = schemaAnalysis.isNestedObject;
  const maxDepth = schemaAnalysis.maxDepth;

  return {
    shape,
    validate(value: unknown): T {
      if (typeof value !== 'object' || value === null) {
        throw new Error('Expected object');
      }
      
      const obj = value as Record<string, unknown>;
      const result = {} as T;
      
      for (const key of keys) {
        (result as Record<string, unknown>)[key] = shape[key as keyof T].validate(obj[key]);
      }
      
      return result;
    },
    
    validateBatch(values: unknown[]): boolean[] {
      if (isSimplePrimitive && keys.length <= 4) {
        // ULTRA-FAST PATH: SIMD-style batch processing for primitives
        return validateBatchSIMD(values, keys, shape);
      } else if (isNestedObject && maxDepth <= 4) {
        // OPTIMIZED PATH: Specialized nested object validation
        return validateNestedObjectsBatch(values, keys, shape, maxDepth);
      }
      
      // Fallback to individual validation for very complex schemas
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
export type Infer<T extends Schema<unknown>> = T extends Schema<infer U> ? U : never;

// Basic primitive schemas
export function string(): Schema<string> {
  return {
    validate(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('Expected string');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => typeof value === 'string');
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

export function number(): Schema<number> {
  return {
    validate(value: unknown): number {
      if (typeof value !== 'number') {
        throw new Error('Expected number');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => typeof value === 'number');
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

export function boolean(): Schema<boolean> {
  return {
    validate(value: unknown): boolean {
      if (typeof value !== 'boolean') {
        throw new Error('Expected boolean');
      }
      return value;
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => typeof value === 'boolean');
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

// Union schema for multiple type validation
export function union<T extends readonly Schema<any>[]>(
  schemas: T
): UnionSchema<T[number] extends Schema<infer U> ? U : never> {
  return {
    options: [...schemas] as Schema<T[number] extends Schema<infer U> ? U : never>[],
    validate(value: unknown): T[number] extends Schema<infer U> ? U : never {
      for (const schema of schemas) {
        try {
          return schema.validate(value) as T[number] extends Schema<infer U> ? U : never;
        } catch {
          // Try the next schema
        }
      }
      throw new Error('No matching schema found');
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => {
        for (const schema of schemas) {
          if (schema.validateBatch([value])[0]) {
            return true;
          }
        }
        return false;
      });
    },
    safeParse(value: unknown) {
      for (const schema of schemas) {
        const result = schema.safeParse(value);
        if (result.success) {
          return result as { success: true; data: T[number] extends Schema<infer U> ? U : never };
        }
      }
      return { success: false as const, error: 'No matching schema found' };
    }
  };
}

// User-defined model creation API
export function model<T extends Record<string, unknown>>(
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
