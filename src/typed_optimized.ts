// TypeScript-first schema definition with compile-time type checking
// Hyper-optimized for performance with specialized validation paths

// Core schema interface
export interface Schema<T> {
  validate(value: unknown): T;
  validateBatch(values: unknown[]): boolean[];
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: string };
}

// Object schema types
export interface ObjectSchema<T> extends Schema<T> {
  shape: ObjectSchemaShape<T>;
}

export interface UnionSchema<T> extends Schema<T> {
  options: Schema<T>[];
}

export interface ArraySchema<T> extends Schema<T[]> {
  element: Schema<T>;
}

type ObjectSchemaShape<T> = {
  [K in keyof T]: Schema<T[K]>;
};

// HYPER-OPTIMIZED asymmetric batch validation for mixed simple/complex fields
function validateAsymmetricBatch<T extends Record<string, unknown>>(
  values: unknown[],
  keys: string[],
  shape: ObjectSchemaShape<T>,
  analysis: SchemaAnalysis
): boolean[] {
  const results = new Array(values.length);
  const BATCH_SIZE = 64; // Increased for better throughput
  
  // Pre-compile primitive validators for zero overhead
  const primitiveValidators = analysis.primitiveFields.map(key => ({
    key,
    schema: shape[key],
    type: getPrimitiveType(shape[key])
  }));
  
  for (let batchStart = 0; batchStart < values.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, values.length);
    
    // ULTRA-FAST batch processing with unrolled primitive validation
    for (let i = batchStart; i < batchEnd; i++) {
      const value = values[i];
      
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        results[i] = false;
        continue;
      }
      
      const obj = value as Record<string, unknown>;
      let valid = true;
      
      // HYPER-OPTIMIZED primitive validation with direct type checks
      for (const validator of primitiveValidators) {
        const fieldValue = obj[validator.key];
        
        if (fieldValue === undefined) {
          valid = false;
          break;
        }
        
        // Direct type checking without function calls
        switch (validator.type) {
          case 'string':
            if (typeof fieldValue !== 'string') valid = false;
            break;
          case 'number':
            if (typeof fieldValue !== 'number') valid = false;
            break;
          case 'boolean':
            if (typeof fieldValue !== 'boolean') valid = false;
            break;
          default:
            if (!validator.schema.validateBatch([fieldValue])[0]) valid = false;
        }
        
        if (!valid) break;
      }
      
      // OPTIMIZED complex field validation with early exit
      if (valid && analysis.complexFields.length > 0) {
        // Batch validate complex fields for better performance
        const complexValues = analysis.complexFields.map(key => obj[key]);
        const hasUndefined = complexValues.some(v => v === undefined);
        
        if (hasUndefined) {
          valid = false;
        } else {
          // Validate complex fields one by one with early exit
          for (let j = 0; j < analysis.complexFields.length && valid; j++) {
            const key = analysis.complexFields[j];
            const fieldSchema = shape[key];
            const fieldValue = obj[key];
            
            if (!fieldSchema.validateBatch([fieldValue])[0]) {
              valid = false;
            }
          }
        }
      }
      
      results[i] = valid;
    }
  }
  
  return results;
}

// HYPER-OPTIMIZED asymmetric batch validation - final performance push
function validateHyperOptimizedAsymmetricBatch<T extends Record<string, unknown>>(
  values: unknown[],
  keys: string[],
  shape: ObjectSchemaShape<T>,
  analysis: SchemaAnalysis
): boolean[] {
  const results = new Array(values.length);
  const BATCH_SIZE = 256; // Maximum batching for asymmetric structures
  
  // Pre-compile all validators for zero-overhead validation
  const primitiveValidators = analysis.primitiveFields.map(key => ({
    key,
    type: getPrimitiveType(shape[key])
  }));
  
  const complexValidators = analysis.complexFields.map(key => ({
    key,
    schema: shape[key]
  }));
  
  for (let batchStart = 0; batchStart < values.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, values.length);
    
    // ULTRA-AGGRESSIVE batch processing with maximum unrolling
    let i = batchStart;
    while (i < batchEnd - 15) {
      // Process 16 values at once for maximum instruction-level parallelism
      for (let offset = 0; offset < 16; offset++) {
        results[i + offset] = validateSingleValueUltraFast(
          values[i + offset], 
          primitiveValidators, 
          complexValidators
        );
      }
      i += 16;
    }
    
    // Handle remaining values
    while (i < batchEnd) {
      results[i] = validateSingleValueUltraFast(values[i], primitiveValidators, complexValidators);
      i++;
    }
  }
  
  return results;
}

// Ultra-fast single value validation with zero function call overhead
function validateSingleValueUltraFast(
  value: unknown,
  primitiveValidators: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex'}>,
  complexValidators: Array<{key: string, schema: Schema<any>}>
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // HYPER-OPTIMIZED primitive validation with direct type checks
  for (const validator of primitiveValidators) {
    const fieldValue = obj[validator.key];
    
    if (fieldValue === undefined) return false;
    
    // Direct type checking - fastest possible path
    switch (validator.type) {
      case 'string':
        if (typeof fieldValue !== 'string') return false;
        break;
      case 'number':
        if (typeof fieldValue !== 'number') return false;
        break;
      case 'boolean':
        if (typeof fieldValue !== 'boolean') return false;
        break;
    }
  }
  
  // OPTIMIZED complex field validation with early exit
  for (const validator of complexValidators) {
    const fieldValue = obj[validator.key];
    
    if (fieldValue === undefined) return false;
    
    // Single-item batch validation for consistency
    if (!validator.schema.validateBatch([fieldValue])[0]) {
      return false;
    }
  }
  
  return true;
}

// Helper to get primitive type for optimization
function getPrimitiveType<T>(schema: Schema<T>): 'string' | 'number' | 'boolean' | 'complex' {
  const schemaStr = schema.toString();
  if (schemaStr.includes('typeof value === \'string\'')) return 'string';
  if (schemaStr.includes('typeof value === \'number\'')) return 'number';
  if (schemaStr.includes('typeof value === \'boolean\'')) return 'boolean';
  return 'complex';
}

// Direct primitive validation without function overhead
function validatePrimitiveDirect<T>(value: unknown, schema: Schema<T>): boolean {
  const schemaStr = schema.toString();
  
  if (schemaStr.includes('typeof value === \'string\'')) {
    return typeof value === 'string';
  }
  if (schemaStr.includes('typeof value === \'number\'')) {
    return typeof value === 'number';
  }
  if (schemaStr.includes('typeof value === \'boolean\'')) {
    return typeof value === 'boolean';
  }
  
  // Fallback for complex primitives
  return schema.validateBatch([value])[0];
}

// Enhanced schema analysis
interface SchemaAnalysis {
  isSimplePrimitive: boolean;
  isNestedObject: boolean;
  maxDepth: number;
  fieldCount: number;
  hasAsymmetricStructure: boolean;
  primitiveFields: string[];
  complexFields: string[];
}

function analyzeSchema<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): SchemaAnalysis {
  const keys = Object.keys(shape);
  const fieldCount = keys.length;
  let maxDepth = 1;
  let hasComplexFields = false;
  let hasPrimitiveFields = false;
  const primitiveFields: string[] = [];
  const complexFields: string[] = [];
  
  for (const key of keys) {
    const schema = shape[key as keyof T];
    const schemaStr = schema.toString();
    
    if (schemaStr.includes('typeof')) {
      hasPrimitiveFields = true;
      primitiveFields.push(key);
    } else {
      hasComplexFields = true;
      complexFields.push(key);
      // Estimate depth for nested objects
      const nestedMatches = schemaStr.match(/object\(/g);
      if (nestedMatches) {
        maxDepth = Math.max(maxDepth, nestedMatches.length + 1);
      }
    }
  }
  
  return {
    isSimplePrimitive: hasPrimitiveFields && !hasComplexFields,
    isNestedObject: hasComplexFields && fieldCount <= 10,
    maxDepth,
    fieldCount,
    hasAsymmetricStructure: hasPrimitiveFields && hasComplexFields,
    primitiveFields,
    complexFields
  };
}

// HYPER-OPTIMIZED SIMD-style batch validation
function validateBatchSIMD<T extends Record<string, unknown>>(
  values: unknown[], 
  keys: string[], 
  shape: { [K in keyof T]: Schema<T[K]> }
): boolean[] {
  const len = values.length;
  const results = new Array(len);
  const keyCount = keys.length;
  
  const BATCH_SIZE = 16;
  const compiledValidators = precompileValidators(keys, shape);
  
  for (let batchStart = 0; batchStart < len; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, len);
    
    switch (keyCount) {
      case 1:
        validateBatch1FieldHyperOptimized(values, results, batchStart, batchEnd, compiledValidators);
        break;
      case 2:
        validateBatch2FieldsHyperOptimized(values, results, batchStart, batchEnd, compiledValidators);
        break;
      default:
        validateBatchNFieldsHyperOptimized(values, results, batchStart, batchEnd, compiledValidators);
    }
  }
  
  return results;
}

// Pre-compile validators for zero-overhead validation
interface CompiledValidator {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'complex';
  validator?: Schema<unknown>;
}

function precompileValidators<T extends Record<string, unknown>>(
  keys: string[],
  shape: { [K in keyof T]: Schema<T[K]> }
): CompiledValidator[] {
  return keys.map(key => {
    const schema = shape[key];
    const schemaStr = schema.toString();
    
    if (schemaStr.includes('typeof value === \'string\'')) {
      return { key, type: 'string' };
    } else if (schemaStr.includes('typeof value === \'number\'')) {
      return { key, type: 'number' };
    } else if (schemaStr.includes('typeof value === \'boolean\'')) {
      return { key, type: 'boolean' };
    } else {
      return { key, type: 'complex', validator: schema };
    }
  });
}

// Hyper-optimized 1-field validation
function validateBatch1FieldHyperOptimized(
  values: unknown[], results: boolean[], start: number, end: number,
  compiled: CompiledValidator[]
): void {
  const { key, type, validator } = compiled[0];
  
  let i = start;
  while (i < end - 3) {
    const v1 = values[i] as any;
    const v2 = values[i + 1] as any;
    const v3 = values[i + 2] as any;
    const v4 = values[i + 3] as any;
    
    if (type === 'string') {
      results[i] = v1 && typeof v1 === 'object' && typeof v1[key] === 'string';
      results[i + 1] = v2 && typeof v2 === 'object' && typeof v2[key] === 'string';
      results[i + 2] = v3 && typeof v3 === 'object' && typeof v3[key] === 'string';
      results[i + 3] = v4 && typeof v4 === 'object' && typeof v4[key] === 'string';
    } else if (type === 'number') {
      results[i] = v1 && typeof v1 === 'object' && typeof v1[key] === 'number';
      results[i + 1] = v2 && typeof v2 === 'object' && typeof v2[key] === 'number';
      results[i + 2] = v3 && typeof v3 === 'object' && typeof v3[key] === 'number';
      results[i + 3] = v4 && typeof v4 === 'object' && typeof v4[key] === 'number';
    } else if (type === 'boolean') {
      results[i] = v1 && typeof v1 === 'object' && typeof v1[key] === 'boolean';
      results[i + 1] = v2 && typeof v2 === 'object' && typeof v2[key] === 'boolean';
      results[i + 2] = v3 && typeof v3 === 'object' && typeof v3[key] === 'boolean';
      results[i + 3] = v4 && typeof v4 === 'object' && typeof v4[key] === 'boolean';
    } else {
      results[i] = v1 && typeof v1 === 'object' && validator!.validateBatch([v1[key]])[0];
      results[i + 1] = v2 && typeof v2 === 'object' && validator!.validateBatch([v2[key]])[0];
      results[i + 2] = v3 && typeof v3 === 'object' && validator!.validateBatch([v3[key]])[0];
      results[i + 3] = v4 && typeof v4 === 'object' && validator!.validateBatch([v4[key]])[0];
    }
    
    i += 4;
  }
  
  while (i < end) {
    const value = values[i] as any;
    if (!value || typeof value !== 'object') {
      results[i] = false;
    } else if (type === 'string') {
      results[i] = typeof value[key] === 'string';
    } else if (type === 'number') {
      results[i] = typeof value[key] === 'number';
    } else if (type === 'boolean') {
      results[i] = typeof value[key] === 'boolean';
    } else {
      results[i] = validator!.validateBatch([value[key]])[0];
    }
    i++;
  }
}

// Optimized 2-field validation
function validateBatch2FieldsHyperOptimized(
  values: unknown[], results: boolean[], start: number, end: number,
  compiled: CompiledValidator[]
): void {
  const field1 = compiled[0];
  const field2 = compiled[1];
  
  for (let i = start; i < end; i++) {
    const value = values[i] as any;
    if (!value || typeof value !== 'object') {
      results[i] = false;
      continue;
    }
    
    let valid = true;
    
    // Validate field 1
    if (field1.type === 'string') {
      valid = typeof value[field1.key] === 'string';
    } else if (field1.type === 'number') {
      valid = typeof value[field1.key] === 'number';
    } else if (field1.type === 'boolean') {
      valid = typeof value[field1.key] === 'boolean';
    } else {
      valid = field1.validator!.validateBatch([value[field1.key]])[0];
    }
    
    // Early exit if field 1 failed
    if (!valid) {
      results[i] = false;
      continue;
    }
    
    // Validate field 2
    if (field2.type === 'string') {
      valid = typeof value[field2.key] === 'string';
    } else if (field2.type === 'number') {
      valid = typeof value[field2.key] === 'number';
    } else if (field2.type === 'boolean') {
      valid = typeof value[field2.key] === 'boolean';
    } else {
      valid = field2.validator!.validateBatch([value[field2.key]])[0];
    }
    
    results[i] = valid;
  }
}

// N-field validation fallback
function validateBatchNFieldsHyperOptimized(
  values: unknown[], results: boolean[], start: number, end: number,
  compiled: CompiledValidator[]
): void {
  for (let i = start; i < end; i++) {
    const value = values[i] as any;
    if (!value || typeof value !== 'object') {
      results[i] = false;
      continue;
    }
    
    let valid = true;
    for (const field of compiled) {
      if (field.type === 'string') {
        valid = typeof value[field.key] === 'string';
      } else if (field.type === 'number') {
        valid = typeof value[field.key] === 'number';
      } else if (field.type === 'boolean') {
        valid = typeof value[field.key] === 'boolean';
      } else {
        valid = field.validator!.validateBatch([value[field.key]])[0];
      }
      
      if (!valid) break;
    }
    
    results[i] = valid;
  }
}

// Nested object validation
function validateNestedObjectsBatch<T extends Record<string, unknown>>(
  values: unknown[],
  keys: string[],
  shape: ObjectSchemaShape<T>,
  maxDepth: number
): boolean[] {
  const len = values.length;
  const results = new Array(len);
  const BATCH_SIZE = 64;
  
  for (let i = 0; i < len; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, len);
    
    for (let j = i; j < batchEnd; j++) {
      const value = values[j];
      
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        results[j] = false;
        continue;
      }
      
      const obj = value as Record<string, unknown>;
      let valid = true;
      
      for (const key of keys) {
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
      
      results[j] = valid;
    }
  }
  
  return results;
}

// Optimized object validation
export function object<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> {
  const keys = Object.keys(shape);
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
        return validateBatchSIMD(values, keys, shape);
      } else if (schemaAnalysis.hasAsymmetricStructure) {
        // PRIORITY: Use hyper-optimized asymmetric validation
        return validateHyperOptimizedAsymmetricBatch(values, keys, shape, schemaAnalysis);
      } else if (isNestedObject && maxDepth <= 4) {
        return validateNestedObjectsBatch(values, keys, shape, maxDepth);
      }
      
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

// HYPER-OPTIMIZED array validation with specialized paths
export function array<T>(itemSchema: Schema<T>): ArraySchema<T> {
  // Pre-analyze item schema for optimization
  const itemSchemaStr = itemSchema.toString();
  const isPrimitiveItem = itemSchemaStr.includes('typeof');
  const isUnionItem = itemSchemaStr.includes('options');
  
  return {
    element: itemSchema,
    validate(value: unknown): T[] {
      if (!Array.isArray(value)) {
        throw new Error('Expected array');
      }
      
      return value.map(item => itemSchema.validate(item));
    },
    validateBatch(values: unknown[]): boolean[] {
      if (isPrimitiveItem) {
        // ULTRA-FAST primitive array validation
        return validatePrimitiveArraysBatch(values, itemSchema);
      } else if (isUnionItem) {
        // OPTIMIZED union array validation
        return validateUnionArraysBatch(values, itemSchema);
      } else {
        // Standard complex array validation
        return values.map(value => {
          if (!Array.isArray(value)) return false;
          return itemSchema.validateBatch(value).every(r => r);
        });
      }
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

// ULTRA-FAST primitive array batch validation
function validatePrimitiveArraysBatch<T>(values: unknown[], itemSchema: Schema<T>): boolean[] {
  const schemaStr = itemSchema.toString();
  const results = new Array(values.length);
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Array.isArray(value)) {
      results[i] = false;
      continue;
    }
    
    // Direct type checking for primitive arrays
    if (schemaStr.includes('string')) {
      results[i] = value.every(item => typeof item === 'string');
    } else if (schemaStr.includes('number')) {
      results[i] = value.every(item => typeof item === 'number');
    } else if (schemaStr.includes('boolean')) {
      results[i] = value.every(item => typeof item === 'boolean');
    } else {
      results[i] = itemSchema.validateBatch(value).every(r => r);
    }
  }
  
  return results;
}

// OPTIMIZED union array batch validation
function validateUnionArraysBatch<T>(values: unknown[], itemSchema: Schema<T>): boolean[] {
  const results = new Array(values.length);
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Array.isArray(value)) {
      results[i] = false;
      continue;
    }
    
    // Batch validate all items in the array at once
    const itemResults = itemSchema.validateBatch(value);
    results[i] = itemResults.every(r => r);
  }
  
  return results;
}

// ULTRA-FAST union validation with aggressive type discrimination
export function union<T extends readonly Schema<any>[]>(
  schemas: T
): UnionSchema<T[number] extends Schema<infer U> ? U : never> {
  // Pre-compile union for ultra-fast discrimination
  const compiledUnion = compileUltraFastUnion(schemas);
  
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
      // HYPER-OPTIMIZED batch union validation
      return validateUltraFastUnionBatch(values, compiledUnion);
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

// Ultra-fast union compiler with zero-overhead discrimination
interface CompiledUnion {
  stringSchema?: Schema<any>;
  numberSchema?: Schema<any>;
  booleanSchema?: Schema<any>;
  arraySchemas: Schema<any>[];
  objectSchemas: Schema<any>[];
  discriminate(value: unknown): Schema<any> | null;
}

function compileUltraFastUnion<T extends readonly Schema<any>[]>(schemas: T): CompiledUnion {
  let stringSchema: Schema<any> | undefined;
  let numberSchema: Schema<any> | undefined;
  let booleanSchema: Schema<any> | undefined;
  const arraySchemas: Schema<any>[] = [];
  const objectSchemas: Schema<any>[] = [];
  
  // Categorize schemas by testing with sample values
  for (const schema of schemas) {
    try {
      if (schema.validateBatch(['__test_string__'])[0]) {
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
      
      // Ultra-fast primitive discrimination (single lookup)
      if (valueType === 'string' && stringSchema) return stringSchema;
      if (valueType === 'number' && numberSchema) return numberSchema;
      if (valueType === 'boolean' && booleanSchema) return booleanSchema;
      
      // Fast array discrimination
      if (Array.isArray(value)) {
        for (const schema of arraySchemas) {
          if (schema.validateBatch([value])[0]) return schema;
        }
      }
      
      // Object discrimination with early exit
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const schema of objectSchemas) {
          if (schema.validateBatch([value])[0]) return schema;
        }
      }
      
      return null;
    }
  };
}

// HYPER-OPTIMIZED batch union validation with SIMD-style processing
function validateUltraFastUnionBatch(values: unknown[], compiledUnion: CompiledUnion): boolean[] {
  const results = new Array(values.length);
  const BATCH_SIZE = 128; // Aggressive batching for maximum throughput
  
  for (let batchStart = 0; batchStart < values.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, values.length);
    
    // SIMD-style processing with unrolled loops
    let i = batchStart;
    while (i < batchEnd - 7) {
      // Process 8 values at once for instruction-level parallelism
      const v1 = values[i], v2 = values[i+1], v3 = values[i+2], v4 = values[i+3];
      const v5 = values[i+4], v6 = values[i+5], v7 = values[i+6], v8 = values[i+7];
      
      results[i] = discriminateValueUltraFast(v1, compiledUnion);
      results[i+1] = discriminateValueUltraFast(v2, compiledUnion);
      results[i+2] = discriminateValueUltraFast(v3, compiledUnion);
      results[i+3] = discriminateValueUltraFast(v4, compiledUnion);
      results[i+4] = discriminateValueUltraFast(v5, compiledUnion);
      results[i+5] = discriminateValueUltraFast(v6, compiledUnion);
      results[i+6] = discriminateValueUltraFast(v7, compiledUnion);
      results[i+7] = discriminateValueUltraFast(v8, compiledUnion);
      
      i += 8;
    }
    
    // Handle remaining values
    while (i < batchEnd) {
      results[i] = discriminateValueUltraFast(values[i], compiledUnion);
      i++;
    }
  }
  
  return results;
}

// Ultra-fast value discrimination with zero function call overhead
function discriminateValueUltraFast(value: unknown, compiledUnion: CompiledUnion): boolean {
  const valueType = typeof value;
  
  // Direct type-based discrimination (fastest path)
  if (valueType === 'string' && compiledUnion.stringSchema) return true;
  if (valueType === 'number' && compiledUnion.numberSchema) return true;
  if (valueType === 'boolean' && compiledUnion.booleanSchema) return true;
  
  // Array discrimination
  if (Array.isArray(value) && compiledUnion.arraySchemas.length > 0) {
    for (const schema of compiledUnion.arraySchemas) {
      if (schema.validateBatch([value])[0]) return true;
    }
  }
  
  // Object discrimination
  if (value && typeof value === 'object' && !Array.isArray(value) && compiledUnion.objectSchemas.length > 0) {
    for (const schema of compiledUnion.objectSchemas) {
      if (schema.validateBatch([value])[0]) return true;
    }
  }
  
  return false;
}

// Model creation API
export function model<T extends Record<string, unknown>>(
  name: string,
  shape: ObjectSchemaShape<T>
): ObjectSchema<T> & { modelName: string } {
  const schema = object(shape);
  return {
    ...schema,
    modelName: name,
  };
}

// Type inference helper
export type Infer<T extends Schema<unknown>> = T extends Schema<infer U> ? U : never;
