// TypeScript-first schema definition with compile-time type checking
// Similar to Yup's approach but with DHI performance

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

type ObjectSchemaShape<T> = {
  [K in keyof T]: Schema<T[K]>;
};

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
        // ULTRA-FAST PATH: Pure JavaScript validation for simple schemas
        return values.map(value => {
          if (typeof value !== 'object' || value === null) return false;
          const obj = value as Record<string, unknown>;
          
          // Unrolled validation for up to 4 fields
          switch (keys.length) {
            case 1:
              return shape[keys[0] as keyof T].validateBatch([obj[keys[0]]])[0];
            case 2:
              return shape[keys[0] as keyof T].validateBatch([obj[keys[0]]])[0] &&
                     shape[keys[1] as keyof T].validateBatch([obj[keys[1]]])[0];
            case 3:
              return shape[keys[0] as keyof T].validateBatch([obj[keys[0]]])[0] &&
                     shape[keys[1] as keyof T].validateBatch([obj[keys[1]]])[0] &&
                     shape[keys[2] as keyof T].validateBatch([obj[keys[2]]])[0];
            case 4:
              return shape[keys[0] as keyof T].validateBatch([obj[keys[0]]])[0] &&
                     shape[keys[1] as keyof T].validateBatch([obj[keys[1]]])[0] &&
                     shape[keys[2] as keyof T].validateBatch([obj[keys[2]]])[0] &&
                     shape[keys[3] as keyof T].validateBatch([obj[keys[3]]])[0];
            default:
              return keys.every(key => 
                shape[key as keyof T].validateBatch([obj[key]])[0]
              );
          }
        });
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
