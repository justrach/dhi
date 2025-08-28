// HYPER-OPTIMIZED SIMD-style validators for specific performance bottlenecks
// Deep Nested Objects & Mixed Arrays optimizations

import { Schema } from './typed';

export type ObjectSchemaShape<T> = {
  [K in keyof T]: Schema<T[K]>;
};

// HYPOTHESIS: Deep nested validation is slow due to:
// 1. Recursive validateBatch calls creating function call overhead
// 2. Object property traversal at each level
// 3. Lack of path flattening and direct property access

// SIMD-OPTIMIZED Deep Nested Object Validator
export function validateDeepNestedSIMD<T extends Record<string, unknown>>(
  values: unknown[],
  nestedPaths: string[][],
  leafValidators: Array<{path: string[], validator: Schema<any>}>
): boolean[] {
  const results = new Array(values.length);
  const BATCH_SIZE = 8; // Process 8 values simultaneously
  
  let i = 0;
  // SIMD-style batch processing with unrolled loops
  while (i < values.length - BATCH_SIZE + 1) {
    // Process 8 values in parallel with maximum unrolling
    for (let offset = 0; offset < BATCH_SIZE; offset++) {
      results[i + offset] = validateSingleDeepNestedUltraFast(
        values[i + offset], 
        nestedPaths, 
        leafValidators
      );
    }
    i += BATCH_SIZE;
  }
  
  // Handle remaining values
  while (i < values.length) {
    results[i] = validateSingleDeepNestedUltraFast(values[i], nestedPaths, leafValidators);
    i++;
  }
  
  return results;
}

// Ultra-fast single deep nested validation with flattened path access
function validateSingleDeepNestedUltraFast(
  value: unknown,
  nestedPaths: string[][],
  leafValidators: Array<{path: string[], validator: Schema<any>}>
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  
  const obj = value as Record<string, any>;
  
  // ULTRA-FAST path traversal with direct property access
  for (const pathInfo of leafValidators) {
    let current = obj;
    
    // Traverse path with minimal overhead
    for (let i = 0; i < pathInfo.path.length - 1; i++) {
      const key = pathInfo.path[i];
      if (!current || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    
    // Validate leaf value
    const leafKey = pathInfo.path[pathInfo.path.length - 1];
    if (!current || typeof current !== 'object' || !(leafKey in current)) {
      return false;
    }
    
    const leafValue = current[leafKey];
    if (!pathInfo.validator.validateBatch([leafValue])[0]) {
      return false;
    }
  }
  
  return true;
}

// HYPOTHESIS: Mixed arrays are slow due to:
// 1. Array iteration overhead
// 2. Nested object validation within arrays
// 3. Union type discrimination for each array element
// 4. Multiple validateBatch calls for different array types

// SIMD-OPTIMIZED Mixed Arrays Validator
export function validateMixedArraysSIMD(
  values: unknown[],
  arrayFieldSpecs: Array<{
    key: string;
    elementType: 'object' | 'primitive' | 'union';
    elementValidator: Schema<any>;
    objectFields?: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>;
  }>,
  objectFieldSpecs: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>
): boolean[] {
  const results = new Array(values.length);
  const BATCH_SIZE = 4; // Smaller batches for complex mixed validation
  
  let i = 0;
  // SIMD-style processing with aggressive unrolling
  while (i < values.length - BATCH_SIZE + 1) {
    // Process 4 values in parallel
    for (let offset = 0; offset < BATCH_SIZE; offset++) {
      results[i + offset] = validateSingleMixedArraysUltraFast(
        values[i + offset],
        arrayFieldSpecs,
        objectFieldSpecs
      );
    }
    i += BATCH_SIZE;
  }
  
  // Handle remaining values
  while (i < values.length) {
    results[i] = validateSingleMixedArraysUltraFast(values[i], arrayFieldSpecs, objectFieldSpecs);
    i++;
  }
  
  return results;
}

// Ultra-fast single mixed arrays validation
function validateSingleMixedArraysUltraFast(
  value: unknown,
  arrayFieldSpecs: Array<{
    key: string;
    elementType: 'object' | 'primitive' | 'union';
    elementValidator: Schema<any>;
    objectFields?: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>;
  }>,
  objectFieldSpecs: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  
  const obj = value as Record<string, any>;
  
  // ULTRA-FAST object field validation first (early exit)
  for (const field of objectFieldSpecs) {
    const fieldValue = obj[field.key];
    if (fieldValue === undefined) return false;
    
    // Direct type checking for primitives
    switch (field.type) {
      case 'string':
        if (typeof fieldValue !== 'string') return false;
        break;
      case 'number':
        if (typeof fieldValue !== 'number') return false;
        break;
      case 'boolean':
        if (typeof fieldValue !== 'boolean') return false;
        break;
      case 'complex':
        if (!field.validator!.validateBatch([fieldValue])[0]) return false;
        break;
    }
  }
  
  // HYPER-OPTIMIZED array field validation
  for (const arraySpec of arrayFieldSpecs) {
    const arrayValue = obj[arraySpec.key];
    if (!Array.isArray(arrayValue)) return false;
    
    // Specialized validation based on element type
    if (arraySpec.elementType === 'primitive') {
      // Fast primitive array validation
      if (!validatePrimitiveArrayUltraFast(arrayValue, arraySpec.elementValidator)) {
        return false;
      }
    } else if (arraySpec.elementType === 'object' && arraySpec.objectFields) {
      // Fast object array validation with pre-compiled field specs
      if (!validateObjectArrayUltraFast(arrayValue, arraySpec.objectFields)) {
        return false;
      }
    } else if (arraySpec.elementType === 'union') {
      // Fast union array validation
      if (!validateUnionArrayUltraFast(arrayValue, arraySpec.elementValidator)) {
        return false;
      }
    } else {
      // Fallback to standard validation
      if (!arraySpec.elementValidator.validateBatch(arrayValue).every(r => r)) {
        return false;
      }
    }
  }
  
  return true;
}

// Ultra-fast primitive array validation
function validatePrimitiveArrayUltraFast(array: unknown[], validator: Schema<any>): boolean {
  const validatorStr = validator.toString();
  
  // Direct type checking for common primitives
  if (validatorStr.includes('typeof value === \'string\'')) {
    return array.every(item => typeof item === 'string');
  } else if (validatorStr.includes('typeof value === \'number\'')) {
    return array.every(item => typeof item === 'number');
  } else if (validatorStr.includes('typeof value === \'boolean\'')) {
    return array.every(item => typeof item === 'boolean');
  }
  
  // Fallback to batch validation
  return validator.validateBatch(array).every(r => r);
}

// Ultra-fast object array validation
function validateObjectArrayUltraFast(
  array: unknown[],
  objectFields: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>
): boolean {
  for (const item of array) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    
    const obj = item as Record<string, any>;
    
    // Validate all fields with direct type checking
    for (const field of objectFields) {
      const fieldValue = obj[field.key];
      if (fieldValue === undefined) return false;
      
      switch (field.type) {
        case 'string':
          if (typeof fieldValue !== 'string') return false;
          break;
        case 'number':
          if (typeof fieldValue !== 'number') return false;
          break;
        case 'boolean':
          if (typeof fieldValue !== 'boolean') return false;
          break;
        case 'complex':
          if (!field.validator!.validateBatch([fieldValue])[0]) return false;
          break;
      }
    }
  }
  
  return true;
}

// Ultra-fast union array validation
function validateUnionArrayUltraFast(array: unknown[], validator: Schema<any>): boolean {
  // Use batch validation for union arrays (already optimized in main validator)
  return validator.validateBatch(array).every(r => r);
}

// Compile deep nested schema into optimized paths
export function compileDeepNestedSchema<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): {
  nestedPaths: string[][];
  leafValidators: Array<{path: string[], validator: Schema<any>}>;
} {
  const nestedPaths: string[][] = [];
  const leafValidators: Array<{path: string[], validator: Schema<any>}> = [];
  
  function traverse(currentShape: any, currentPath: string[] = []) {
    for (const [key, schema] of Object.entries(currentShape)) {
      const newPath = [...currentPath, key];
      
      // Check if this is a nested object
      if (schema && typeof schema === 'object' && 'shape' in schema) {
        // Recurse into nested object
        traverse((schema as any).shape, newPath);
      } else {
        // This is a leaf validator
        nestedPaths.push(newPath);
        leafValidators.push({
          path: newPath,
          validator: schema as Schema<any>
        });
      }
    }
  }
  
  traverse(shape);
  
  return { nestedPaths, leafValidators };
}

// Compile mixed arrays schema into optimized specs
export function compileMixedArraysSchema<T extends Record<string, unknown>>(
  shape: ObjectSchemaShape<T>
): {
  arrayFieldSpecs: Array<{
    key: string;
    elementType: 'object' | 'primitive' | 'union';
    elementValidator: Schema<any>;
    objectFields?: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>;
  }>;
  objectFieldSpecs: Array<{key: string, type: 'string' | 'number' | 'boolean' | 'complex', validator?: Schema<any>}>;
} {
  const arrayFieldSpecs: any[] = [];
  const objectFieldSpecs: any[] = [];
  
  for (const [key, schema] of Object.entries(shape)) {
    const schemaStr = (schema as Schema<any>).toString();
    
    if (schemaStr.includes('Array') || (schema && typeof schema === 'object' && 'element' in schema)) {
      // This is an array field
      const elementSchema = (schema as any).element;
      const elementStr = elementSchema?.toString() || '';
      
      let elementType: 'object' | 'primitive' | 'union' = 'primitive';
      let objectFields: any[] | undefined;
      
      if (elementStr.includes('union') || elementStr.includes('Union')) {
        elementType = 'union';
      } else if (elementSchema && typeof elementSchema === 'object' && 'shape' in elementSchema) {
        elementType = 'object';
        // Compile object fields
        objectFields = [];
        for (const [fieldKey, fieldSchema] of Object.entries((elementSchema as any).shape)) {
          const fieldType = getFieldType(fieldSchema as Schema<any>);
          objectFields.push({
            key: fieldKey,
            type: fieldType,
            validator: fieldType === 'complex' ? fieldSchema as Schema<any> : undefined
          });
        }
      }
      
      arrayFieldSpecs.push({
        key,
        elementType,
        elementValidator: elementSchema,
        objectFields
      });
    } else {
      // This is a regular object field
      const fieldType = getFieldType(schema as Schema<any>);
      objectFieldSpecs.push({
        key,
        type: fieldType,
        validator: fieldType === 'complex' ? schema as Schema<any> : undefined
      });
    }
  }
  
  return { arrayFieldSpecs, objectFieldSpecs };
}

function getFieldType(schema: Schema<any>): 'string' | 'number' | 'boolean' | 'complex' {
  const str = schema.toString();
  if (str.includes('typeof value === \'string\'')) return 'string';
  if (str.includes('typeof value === \'number\'')) return 'number';
  if (str.includes('typeof value === \'boolean\'')) return 'boolean';
  return 'complex';
}
