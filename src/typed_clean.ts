// DHI TypeScript-first schema validation with performance optimizations
// This is a clean version with optimized union validation

export interface Schema<T> {
  validate(value: unknown): T;
  validateBatch(values: unknown[]): boolean[];
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: string };
}

export interface ObjectSchema<T> extends Schema<T> {
  shape: ObjectSchemaShape<T>;
}

export interface ArraySchema<T> extends Schema<T[]> {
  element: Schema<T>;
}

export interface UnionSchema<T> extends Schema<T> {
  options: Schema<T>[];
}

export type ObjectSchemaShape<T> = {
  [K in keyof T]: Schema<T[K]>;
};

export type Infer<T extends Schema<any>> = T extends Schema<infer U> ? U : never;

// String schema
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

// Number schema
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

// Boolean schema
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

// Array schema with optimized batch validation
export function array<T>(element: Schema<T>): ArraySchema<T> {
  return {
    element,
    validate(value: unknown): T[] {
      if (!Array.isArray(value)) {
        throw new Error('Expected array');
      }
      return value.map(item => element.validate(item));
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(value => {
        if (!Array.isArray(value)) return false;
        
        // Fast path for primitive arrays
        const elementStr = element.toString();
        if (elementStr.includes('string')) {
          return value.every(item => typeof item === 'string');
        }
        if (elementStr.includes('number')) {
          return value.every(item => typeof item === 'number');
        }
        if (elementStr.includes('boolean')) {
          return value.every(item => typeof item === 'boolean');
        }
        
        // Fallback to element validation
        return element.validateBatch(value).every(Boolean);
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

// Optimized union schema with fast type discrimination
export function union<T extends readonly Schema<any>[]>(
  schemas: T
): UnionSchema<T[number] extends Schema<infer U> ? U : never> {
  // Pre-compile union for fast discrimination
  const compiledUnion = compileUnionForPerformance(schemas);
  
  return {
    options: [...schemas] as Schema<T[number] extends Schema<infer U> ? U : never>[],
    validate(value: unknown): T[number] extends Schema<infer U> ? U : never {
      const matchingSchema = compiledUnion.discriminate(value);
      if (matchingSchema) {
        return matchingSchema.validate(value) as T[number] extends Schema<infer U> ? U : never;
      }
      throw new Error('No matching schema found');
    },
    validateBatch(values: unknown[]): boolean[] {
      return validateUnionBatchOptimized(values, compiledUnion);
    },
    safeParse(value: unknown) {
      const matchingSchema = compiledUnion.discriminate(value);
      if (matchingSchema) {
        return matchingSchema.safeParse(value) as { success: true; data: T[number] extends Schema<infer U> ? U : never };
      }
      return { success: false as const, error: 'No matching schema found' };
    }
  };
}

// Fast union compiler for performance
interface FastCompiledUnion {
  stringSchema?: Schema<any>;
  numberSchema?: Schema<any>;
  booleanSchema?: Schema<any>;
  arraySchemas: Schema<any>[];
  objectSchemas: Schema<any>[];
  discriminate(value: unknown): Schema<any> | null;
}

function compileUnionForPerformance<T extends readonly Schema<any>[]>(schemas: T): FastCompiledUnion {
  let stringSchema: Schema<any> | undefined;
  let numberSchema: Schema<any> | undefined;
  let booleanSchema: Schema<any> | undefined;
  const arraySchemas: Schema<any>[] = [];
  const objectSchemas: Schema<any>[] = [];
  
  // Categorize schemas by testing with sample values
  for (const schema of schemas) {
    try {
      if (schema.validateBatch(['__test__'])[0]) {
        stringSchema = schema;
        continue;
      }
    } catch {}
    
    try {
      if (schema.validateBatch([42])[0]) {
        numberSchema = schema;
        continue;
      }
    } catch {}
    
    try {
      if (schema.validateBatch([true])[0]) {
        booleanSchema = schema;
        continue;
      }
    } catch {}
    
    try {
      if (schema.validateBatch([[]])[0]) {
        arraySchemas.push(schema);
        continue;
      }
    } catch {}
    
    objectSchemas.push(schema);
  }
  
  return {
    stringSchema,
    numberSchema,
    booleanSchema,
    arraySchemas,
    objectSchemas,
    discriminate(value: unknown): Schema<any> | null {
      const valueType = typeof value;
      
      // Fast primitive discrimination
      if (valueType === 'string' && stringSchema) return stringSchema;
      if (valueType === 'number' && numberSchema) return numberSchema;
      if (valueType === 'boolean' && booleanSchema) return booleanSchema;
      
      // Array discrimination
      if (Array.isArray(value)) {
        for (const schema of arraySchemas) {
          if (schema.validateBatch([value])[0]) return schema;
        }
      }
      
      // Object discrimination
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const schema of objectSchemas) {
          if (schema.validateBatch([value])[0]) return schema;
        }
      }
      
      return null;
    }
  };
}

// Optimized batch union validation
function validateUnionBatchOptimized(values: unknown[], compiledUnion: FastCompiledUnion): boolean[] {
  const results = new Array(values.length);
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const valueType = typeof value;
    
    // Fast primitive discrimination
    if (valueType === 'string' && compiledUnion.stringSchema) {
      results[i] = true;
      continue;
    }
    if (valueType === 'number' && compiledUnion.numberSchema) {
      results[i] = true;
      continue;
    }
    if (valueType === 'boolean' && compiledUnion.booleanSchema) {
      results[i] = true;
      continue;
    }
    
    // Array discrimination
    if (Array.isArray(value) && compiledUnion.arraySchemas.length > 0) {
      let found = false;
      for (const schema of compiledUnion.arraySchemas) {
        if (schema.validateBatch([value])[0]) {
          found = true;
          break;
        }
      }
      results[i] = found;
      continue;
    }
    
    // Object discrimination
    if (value && typeof value === 'object' && !Array.isArray(value) && compiledUnion.objectSchemas.length > 0) {
      let found = false;
      for (const schema of compiledUnion.objectSchemas) {
        if (schema.validateBatch([value])[0]) {
          found = true;
          break;
        }
      }
      results[i] = found;
      continue;
    }
    
    results[i] = false;
  }
  
  return results;
}

// Schema analysis for optimization decisions
function analyzeSchema<T extends Record<string, unknown>>(shape: ObjectSchemaShape<T>): {
  isSimplePrimitive: boolean;
  isNestedObject: boolean;
  maxDepth: number;
  fieldCount: number;
  hasAsymmetricStructure: boolean;
  primitiveFields: string[];
  complexFields: string[];
} {
  const keys = Object.keys(shape);
  const fieldCount = keys.length;
  let maxDepth = 1;
  let hasNestedObjects = false;
  let allPrimitive = true;
  let hasPrimitiveFields = false;
  let hasComplexFields = false;
  const primitiveFields: string[] = [];
  const complexFields: string[] = [];

  for (const key of keys) {
    const schema = shape[key];
    const schemaStr = schema.toString();

    if (schemaStr.includes('typeof')) {
      hasPrimitiveFields = true;
      primitiveFields.push(key);
    } else {
      hasComplexFields = true;
      complexFields.push(key);
      allPrimitive = false;

      if (schema && typeof schema === 'object' && 'shape' in schema) {
        hasNestedObjects = true;
        const nestedAnalysis = analyzeSchema((schema as ObjectSchema<any>).shape);
        maxDepth = Math.max(maxDepth, nestedAnalysis.maxDepth + 1);
      } else if (schemaStr.includes('Array')) {
        maxDepth = Math.max(maxDepth, 2);
      }
    }
  }

  return {
    isSimplePrimitive: allPrimitive && fieldCount <= 4,
    isNestedObject: hasNestedObjects,
    maxDepth,
    fieldCount,
    hasAsymmetricStructure: hasPrimitiveFields && hasComplexFields,
    primitiveFields,
    complexFields
  };
}

// Optimized asymmetric batch validation
function validateAsymmetricBatch<T extends Record<string, unknown>>(
  values: unknown[],
  keys: string[],
  shape: ObjectSchemaShape<T>,
  analysis: { primitiveFields: string[]; complexFields: string[] }
): boolean[] {
  const results = new Array(values.length);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      results[i] = false;
      continue;
    }

    const obj = value as Record<string, unknown>;
    let valid = true;

    // Validate primitive fields first (fast path)
    for (const key of analysis.primitiveFields) {
      if (!(key in obj)) {
        valid = false;
        break;
      }

      const fieldValue = obj[key];
      const fieldSchema = shape[key];

      if (!fieldSchema.validateBatch([fieldValue])[0]) {
        valid = false;
        break;
      }
    }

    // Validate complex fields if primitives passed
    if (valid) {
      for (const key of analysis.complexFields) {
        if (!(key in obj)) {
          valid = false;
          break;
        }

        const fieldValue = obj[key];
        const fieldSchema = shape[key];

        if (!fieldSchema.validateBatch([fieldValue])[0]) {
          valid = false;
          break;
        }
      }
    }

    results[i] = valid;
  }

  return results;
}

// Object schema with optimized batch validation
export function object<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> {
  const keys = Object.keys(shape);
  const analysis = analyzeSchema(shape);

  return {
    shape,
    validate(value: unknown): T {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected object');
      }

      const obj = value as Record<string, unknown>;
      const result = {} as T;

      for (const key of keys) {
        if (!(key in obj)) {
          throw new Error(`Missing required field: ${key}`);
        }
        (result as any)[key] = shape[key].validate(obj[key]);
      }

      return result;
    },
    validateBatch(values: unknown[]): boolean[] {
      // Use optimized asymmetric validation if applicable
      if (analysis.hasAsymmetricStructure) {
        return validateAsymmetricBatch(values, keys, shape, analysis);
      }

      // Standard batch validation
      return values.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }

        const obj = value as Record<string, unknown>;

        for (const key of keys) {
          if (!(key in obj)) {
            return false;
          }

          const fieldValue = obj[key];
          const fieldSchema = shape[key];

          if (!fieldSchema.validateBatch([fieldValue])[0]) {
            return false;
          }
        }

        return true;
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

// Model creation API
export function model<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> {
  return object(shape);
}
