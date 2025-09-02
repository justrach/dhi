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
  const isOptional = (validator as Schema<unknown>).__kind === 'optional';
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    const v = obj[key];
    results[i] = isOptional
      ? (v === undefined || validator.validateBatch([v])[0])
      : validator.validateBatch([v])[0];
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
  const isOpt1 = (validator1 as Schema<unknown>).__kind === 'optional';
  const isOpt2 = (validator2 as Schema<unknown>).__kind === 'optional';
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    const v1 = obj[key1];
    const ok1 = isOpt1 ? (v1 === undefined || validator1.validateBatch([v1])[0]) : validator1.validateBatch([v1])[0];
    if (!ok1) { results[i] = false; continue; }
    const v2 = obj[key2];
    const ok2 = isOpt2 ? (v2 === undefined || validator2.validateBatch([v2])[0]) : validator2.validateBatch([v2])[0];
    results[i] = ok2;
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
  const isOpt1 = (validator1 as Schema<unknown>).__kind === 'optional';
  const isOpt2 = (validator2 as Schema<unknown>).__kind === 'optional';
  const isOpt3 = (validator3 as Schema<unknown>).__kind === 'optional';
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    const v1 = obj[key1];
    const ok1 = isOpt1 ? (v1 === undefined || validator1.validateBatch([v1])[0]) : validator1.validateBatch([v1])[0];
    if (!ok1) { results[i] = false; continue; }
    const v2 = obj[key2];
    const ok2 = isOpt2 ? (v2 === undefined || validator2.validateBatch([v2])[0]) : validator2.validateBatch([v2])[0];
    if (!ok2) { results[i] = false; continue; }
    const v3 = obj[key3];
    const ok3 = isOpt3 ? (v3 === undefined || validator3.validateBatch([v3])[0]) : validator3.validateBatch([v3])[0];
    results[i] = ok3;
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
  const isOpt1 = (validator1 as Schema<unknown>).__kind === 'optional';
  const isOpt2 = (validator2 as Schema<unknown>).__kind === 'optional';
  const isOpt3 = (validator3 as Schema<unknown>).__kind === 'optional';
  const isOpt4 = (validator4 as Schema<unknown>).__kind === 'optional';
  
  for (let i = start; i < end; i++) {
    const value = values[i];
    if (typeof value !== 'object' || value === null) {
      results[i] = false;
      continue;
    }
    const obj = value as Record<string, unknown>;
    const v1 = obj[key1];
    const ok1 = isOpt1 ? (v1 === undefined || validator1.validateBatch([v1])[0]) : validator1.validateBatch([v1])[0];
    if (!ok1) { results[i] = false; continue; }
    const v2 = obj[key2];
    const ok2 = isOpt2 ? (v2 === undefined || validator2.validateBatch([v2])[0]) : validator2.validateBatch([v2])[0];
    if (!ok2) { results[i] = false; continue; }
    const v3 = obj[key3];
    const ok3 = isOpt3 ? (v3 === undefined || validator3.validateBatch([v3])[0]) : validator3.validateBatch([v3])[0];
    if (!ok3) { results[i] = false; continue; }
    const v4 = obj[key4];
    const ok4 = isOpt4 ? (v4 === undefined || validator4.validateBatch([v4])[0]) : validator4.validateBatch([v4])[0];
    results[i] = ok4;
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
    let ok = true;
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      const validator = shape[key];
      const v = (obj as any)[key];
      if ((validator as Schema<unknown>).__kind === 'optional') {
        if (!(v === undefined || validator.validateBatch([v])[0])) { ok = false; break; }
      } else {
        if (!validator.validateBatch([v])[0]) { ok = false; break; }
      }
    }
    results[i] = ok;
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
    const s = shape[key] as Schema<any> | undefined;
    if (!s || typeof s !== 'object') { allPrimitive = false; continue; }
    let current: Schema<any> = s;
    let kind = current.__kind;
    // Unwrap optional for analysis
    if (kind === 'optional' && (current as any).inner) {
      current = (current as any).inner as Schema<any>;
      kind = current.__kind;
    }

    if (kind === 'object' && 'shape' in (current as any)) {
      hasNestedObjects = true;
      allPrimitive = false;
      const nestedAnalysis = analyzeSchema(((current as unknown) as ObjectSchema<any>).shape);
      maxDepth = Math.max(maxDepth, nestedAnalysis.maxDepth + 1);
    } else if (kind === 'array' || kind === 'union') {
      allPrimitive = false;
    } else if (kind === 'string' || kind === 'number' || kind === 'boolean') {
      // still primitive
    } else {
      // Unknown/complex kinds are not primitive
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
  
  // Try building an iterative, non-recursive validator for object-only trees (no arrays)
  const iterative = createIterativeObjectValidator(shape);
  if (iterative) {
    return function(obj: unknown): boolean {
      try {
        return iterative(obj);
      } catch {
        return false;
      }
    };
  }

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

// Iterative validator for nested object trees without arrays/unions
type IterNode =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'object'; keys: string[]; children: (IterNode | null)[]; optional: boolean[] };

function createIterativeObjectValidator<T extends Record<string, unknown>>(shape: ObjectSchemaShape<T>): ((obj: unknown) => boolean) | null {
  // Build a compact node tree. If we encounter non-object/primitive (e.g., arrays), abort and return null.
  function toNode(s: Schema<any>): IterNode | null {
    // unwrap optional
    const isOptional = (s as any).__kind === 'optional' && (s as any).inner;
    const inner = isOptional ? (s as any).inner as Schema<any> : s;
    const kind = (inner as any).__kind as string | undefined;
    if (kind === 'string') return { kind: 'string' };
    if (kind === 'number') return { kind: 'number' };
    if (kind === 'boolean') return { kind: 'boolean' };
    if (kind === 'object' && typeof (inner as any).shape === 'object') {
      const sh = (inner as any).shape as Record<string, Schema<any>>;
      const keys = Object.keys(sh);
      const children: (IterNode | null)[] = new Array(keys.length);
      const optional: boolean[] = new Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        const childSchema = sh[keys[i]] as any;
        const chOptional = childSchema && childSchema.__kind === 'optional' && childSchema.inner;
        optional[i] = !!chOptional;
        const base = chOptional ? (childSchema.inner as Schema<any>) : childSchema as Schema<any>;
        const node = toNode(base);
        if (!node) return null; // unsupported type in this fast path
        children[i] = node;
      }
      // Group direct leaves by type to reduce polymorphism: string -> number -> boolean -> object
      const idxString: number[] = [];
      const idxNumber: number[] = [];
      const idxBoolean: number[] = [];
      const idxObject: number[] = [];
      for (let i = 0; i < keys.length; i++) {
        const n = children[i]!;
        if (n.kind === 'string') idxString.push(i);
        else if (n.kind === 'number') idxNumber.push(i);
        else if (n.kind === 'boolean') idxBoolean.push(i);
        else idxObject.push(i);
      }
      const order = idxString.concat(idxNumber, idxBoolean, idxObject);
      if (order.length === keys.length) {
        const newKeys = new Array<string>(keys.length);
        const newChildren = new Array<IterNode | null>(keys.length);
        const newOptional = new Array<boolean>(keys.length);
        for (let i = 0; i < order.length; i++) {
          const from = order[i];
          newKeys[i] = keys[from];
          newChildren[i] = children[from];
          newOptional[i] = optional[from];
        }
        return { kind: 'object', keys: newKeys, children: newChildren, optional: newOptional };
      }
      return { kind: 'object', keys, children, optional };
    }
    // Unsupported (arrays, unions, etc.)
    return null;
  }

  const rootNode = { kind: 'object', keys: Object.keys(shape), children: [] as (IterNode | null)[], optional: [] as boolean[] } as IterNode;
  const rootKeys = (rootNode as any).keys as string[];
  for (let i = 0; i < rootKeys.length; i++) {
    const k = rootKeys[i];
    const s = shape[k] as any;
    const isOpt = s && s.__kind === 'optional' && s.inner;
    (rootNode as any).optional[i] = !!isOpt;
    const base = isOpt ? (s.inner as Schema<any>) : s as Schema<any>;
    const node = toNode(base);
    if (!node) return null;
    (rootNode as any).children[i] = node;
  }

  // Depth-5 is small; implement an explicit stack without recursion
  type Frame = { node: IterNode; value: any };
  return function(obj: unknown): boolean {
    if (obj === null || typeof obj !== 'object') return false;
    const stack: Frame[] = new Array(64);
    let sp = 0;
    stack[sp++] = { node: rootNode, value: obj };

    while (sp > 0) {
      const fr = stack[--sp];
      const n = fr.node;
      const v = fr.value;
      if (n.kind === 'string') { if (typeof v !== 'string') return false; continue; }
      if (n.kind === 'number') { if (typeof v !== 'number') return false; continue; }
      if (n.kind === 'boolean') { if (typeof v !== 'boolean') return false; continue; }
      // object
      if (v === null || typeof v !== 'object') return false;
      const keys = (n as any).keys as string[];
      const children = (n as any).children as IterNode[];
      const optional = (n as any).optional as boolean[];
      // validate properties; push children in reverse order to process in key order
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        if (!Object.prototype.hasOwnProperty.call(v, k)) {
          if (!optional[i]) return false;
          continue;
        }
        const childVal = (v as any)[k];
        stack[sp++] = { node: children[i], value: childVal };
      }
    }
    return true;
  };
}

// Compile validation paths for efficient nested validation (legacy fallback)
function compileValidationPaths<T extends Record<string, unknown>>(keys: string[], shape: ObjectSchemaShape<T>, parentOptional: boolean = false): ValidationPath[] {
  const paths: ValidationPath[] = [];

  for (const key of keys) {
    let schema = shape[key] as Schema<any>;
    let isOptional = !!(schema && typeof schema === 'object' && schema.__kind === 'optional');
    const inner = isOptional && (schema as any).inner ? (schema as any).inner as Schema<any> : schema;

    if (inner && typeof inner === 'object' && 'shape' in (inner as any)) {
      const objectSchema = (inner as unknown) as ObjectSchema<any>;
      const nestedPaths = compileValidationPaths(Object.keys(objectSchema.shape), objectSchema.shape, parentOptional || isOptional);
      for (const nestedPath of nestedPaths) {
        paths.push({
          path: [key, ...nestedPath.path],
          validator: nestedPath.validator,
          optional: (parentOptional || isOptional || nestedPath.optional),
          kind: nestedPath.kind
        });
      }
    } else {
      const kind = (inner && (inner as any).__kind && ((inner as any).__kind === 'string' || (inner as any).__kind === 'number' || (inner as any).__kind === 'boolean'))
        ? ((inner as any).__kind as 'string' | 'number' | 'boolean')
        : undefined;
      paths.push({
        path: [key],
        validator: inner,
        optional: (parentOptional || isOptional),
        kind
      });
    }
  }

  return paths;
}

interface ValidationPath {
  path: string[];
  validator: Schema<unknown>;
  optional: boolean;
  kind?: 'string' | 'number' | 'boolean';
}

// Fast nested object validation using pre-compiled paths (legacy fallback)
function validateObjectWithPaths(obj: unknown, paths: ValidationPath[]): boolean {
  const target = obj as Record<string, unknown>;

  for (const p of paths) {
    const { path, validator, optional, kind } = p;
    let current: any = target;

    // Navigate to the nested value
    for (let i = 0; i < path.length - 1; i++) {
      if (current == null || typeof current !== 'object') {
        if (optional) {
          // Missing optional parent object -> path is valid by omission
          current = undefined;
          break;
        }
        return false;
      }
      current = (current as any)[path[i]];
      if (current == null && optional) {
        // Early exit for optional path
        current = undefined;
        break;
      }
    }

    // If we short-circuited due to optional missing parent
    if (current === undefined && optional) {
      continue;
    }

    if (current == null || typeof current !== 'object') {
      if (optional) continue;
      return false;
    }

    // Validate the final value
    const finalKey = path[path.length - 1];
    const value = (current as any)[finalKey];

    if (value === undefined && optional) {
      continue;
    }

    // Primitive fast path via typeof; fallback to schema validation for complex types
    if (kind === 'string') {
      if (typeof value !== 'string') return false;
    } else if (kind === 'number') {
      if (typeof value !== 'number') return false;
    } else if (kind === 'boolean') {
      if (typeof value !== 'boolean') return false;
    } else {
      if (!validator.validateBatch([value])[0]) {
        return false;
      }
    }
  }

  return true;
}

export interface Schema<T> {
  validate(value: unknown): T;
  validateBatch(values: unknown[]): boolean[];
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: string };
  // Internal discriminator for optimized paths
  __kind?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'union' | 'optional' | 'record';
  // Optional: used by wrappers like optional() to expose the inner schema for analysis
  inner?: Schema<any>;
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

// Record schema: validates a dictionary of string keys to values of a schema
export function record<T>(valueSchema: Schema<T>): Schema<Record<string, T>> {
  return {
    __kind: 'record',
    validate(value: unknown): Record<string, T> {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected record (object with string keys)');
      }
      const input = value as Record<string, unknown>;
      const out: Record<string, T> = {} as any;
      // Validate without allocating Object.values() / entries arrays
      for (const k in input) {
        if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
        out[k] = valueSchema.validate(input[k]);
      }
      return out;
    },
    validateBatch(values: unknown[]): boolean[] {
      const kind = (valueSchema as Schema<T>).__kind;
      // Fast primitive path: avoid calling into schema per element
      if (kind === 'string' || kind === 'number' || kind === 'boolean') {
        return values.map((value) => {
          if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
          const obj = value as Record<string, unknown>;
          for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            const v = obj[k];
            if (kind === 'string') { if (typeof v !== 'string') return false; }
            else if (kind === 'number') { if (typeof v !== 'number') return false; }
            else /* boolean */ { if (typeof v !== 'boolean') return false; }
          }
          return true;
        });
      }
      // Generic fused path
      return values.map((value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
        const obj = value as Record<string, unknown>;
        try {
          for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            valueSchema.validate(obj[k]);
          }
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

// ... (rest of the code remains the same)

// Nullable wrapper: accepts null in addition to the inner schema
export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return {
    validate(value: unknown): T | null {
      if (value === null) return null;
      return inner.validate(value);
    },
    validateBatch(values: unknown[]): boolean[] {
      return values.map(v => (v === null) ? true : inner.validateBatch([v])[0]);
    },
    safeParse(value: unknown) {
      if (value === null) {
        return { success: true as const, data: null };
      }
      return inner.safeParse(value) as any;
    }
  };
}

export function array<T>(itemSchema: Schema<T>): ArraySchema<T> {
  return {
    __kind: 'array',
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

        // Primitive arrays fast path
        const kind = (itemSchema as Schema<T>).__kind;
        if (kind === 'string') return isArrayOfPrimitives(value, 'string');
        if (kind === 'number') return isArrayOfPrimitives(value, 'number');
        if (kind === 'boolean') return isArrayOfPrimitives(value, 'boolean');

        // Array of object fast path: inner object with ≤4 primitive/optional-primitive fields
        if ((itemSchema as any).__kind === 'object' && typeof (itemSchema as any).shape === 'object') {
          const shape = (itemSchema as any).shape as Record<string, Schema<any>>;
          const keys = Object.keys(shape);
          if (keys.length > 0 && keys.length <= 4) {
            let primitiveOnly = true;
            const fields: { key: string; kind: 'string'|'number'|'boolean'|null; optional: boolean; inner?: Schema<any> }[] = [];
            for (const k of keys) {
              const s = shape[k] as any;
              if (s && s.__kind === 'optional' && s.inner) {
                const inner = s.inner as Schema<any> & { __kind?: string };
                const ik = inner.__kind;
                const prim = ik === 'string' || ik === 'number' || ik === 'boolean';
                if (!prim) { primitiveOnly = false; break; }
                fields.push({ key: k, kind: ik as any, optional: true, inner });
              } else {
                const ik = s && s.__kind;
                const prim = ik === 'string' || ik === 'number' || ik === 'boolean';
                if (!prim) { primitiveOnly = false; break; }
                fields.push({ key: k, kind: ik as any, optional: false });
              }
            }
            if (primitiveOnly) {
              // Validate each element quickly using direct typeof checks
              for (let i = 0; i < value.length; i++) {
                const el = value[i];
                if (typeof el !== 'object' || el === null) return false;
                for (const f of fields) {
                  const v = (el as any)[f.key];
                  if (v === undefined) { if (f.optional) continue; else return false; }
                  if (f.kind === 'string') { if (typeof v !== 'string') return false; }
                  else if (f.kind === 'number') { if (typeof v !== 'number') return false; }
                  else if (f.kind === 'boolean') { if (typeof v !== 'boolean') return false; }
                }
              }
              return true;
            }
          }
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
  // Check internal discriminator set by primitive schema constructors
  return schema.__kind === 'string' || schema.__kind === 'number' || schema.__kind === 'boolean';
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
    __kind: 'object',
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
      } else if (isNestedObject) {
        // OPTIMIZED PATH: Specialized nested object validation (no depth cap)
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
    __kind: 'string',
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
    __kind: 'number',
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
    __kind: 'boolean',
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

// Optional wrapper schema
export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    __kind: 'optional',
    // Expose inner schema for analysis and nested path compilation
    inner: schema as Schema<T>,
    validate(value: unknown): T | undefined {
      if (value === undefined) return undefined;
      return schema.validate(value);
    },
    validateBatch(values: unknown[]): boolean[] {
      const len = values.length;
      const results = new Array<boolean>(len);
      for (let i = 0; i < len; i++) {
        const v = values[i];
        if (v === undefined) {
          results[i] = true;
        } else {
          results[i] = schema.validateBatch([v])[0];
        }
      }
      return results;
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
    __kind: 'union',
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

// Discriminated union with fast dispatch based on a key
export function discriminatedUnion<K extends string, M extends Record<string, ObjectSchema<any>>>(
  discriminator: K,
  mapping: M
): Schema<Infer<M[keyof M]>> {
  const keys = Object.keys(mapping);
  const schemasByKey = mapping as Record<string, ObjectSchema<any>>;

  return {
    validate(value: unknown) {
      if (typeof value !== 'object' || value === null) {
        throw new Error('Expected object for discriminated union');
      }
      const disc = (value as any)[discriminator];
      const schema = schemasByKey[String(disc)];
      if (!schema) throw new Error('Invalid discriminator value');
      return schema.validate(value);
    },
    validateBatch(values: unknown[]): boolean[] {
      const indexBuckets: Record<string, number[]> = {};
      const valueBuckets: Record<string, unknown[]> = {};

      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (typeof v !== 'object' || v === null) {
          continue;
        }
        const disc = (v as any)[discriminator];
        const key = String(disc);
        if (!(key in schemasByKey)) continue;
        (indexBuckets[key] ||= []).push(i);
        (valueBuckets[key] ||= []).push(v);
      }

      const results = new Array<boolean>(values.length).fill(false);
      for (const k of Object.keys(valueBuckets)) {
        const schema = schemasByKey[k];
        const bucket = valueBuckets[k];
        const idxs = indexBuckets[k];
        const batchRes = schema.validateBatch(bucket);
        for (let j = 0; j < idxs.length; j++) {
          results[idxs[j]] = batchRes[j];
        }
      }
      return results;
    },
    safeParse(value: unknown) {
      try {
        const data = this.validate(value);
        return { success: true as const, data };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : 'Validation failed' };
      }
    }
  } as Schema<Infer<M[keyof M]>>;
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
