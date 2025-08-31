// 🚨 TEMPORARY Zod Compatibility Layer
// This is a placeholder for migration purposes only and will be removed in future versions.
// Use the native DHI API (object, string, number, etc.) for best performance and features.

// Simple Zod-compatible validation functions
function createStringSchema() {
  const baseValidate = (value: unknown): string => {
    if (typeof value !== 'string') {
      throw new Error('Expected string');
    }
    return value;
  };

  const baseSafeParse = (value: unknown) => {
    try {
      return { success: true as const, data: baseValidate(value) };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false as const, error };
      }
      const message = error instanceof Error ? error.message : 'Validation failed';
      return { success: false as const, error: new ZodError([{ message, path: [] }]) };
    }
  };

  return {
    parse: baseValidate,
    safeParse: baseSafeParse,
    optional() {
      return createOptionalSchema(this);
    },
    transform(fn: (value: string) => any) {
      return createTransformSchema(this, fn);
    },
    email() {
      return {
        parse(value: unknown): string {
          const str = baseValidate(value);
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(str)) {
            throw new Error('Invalid email address');
          }
          return str;
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    min(length: number) {
      return {
        parse(value: unknown): string {
          const str = baseValidate(value);
          if (str.length < length) {
            throw new Error(`String must be at least ${length} characters`);
          }
          return str;
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    max(length: number) {
      return {
        parse(value: unknown): string {
          const str = baseValidate(value);
          if (str.length > length) {
            throw new Error(`String must be at most ${length} characters`);
          }
          return str;
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    regex(pattern: RegExp, message?: string) {
      return {
        parse(value: unknown): string {
          const str = baseValidate(value);
          if (!pattern.test(str)) {
            throw new Error(message || `String does not match pattern ${pattern}`);
          }
          return str;
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const msg = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message: msg, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    url() {
      return {
        parse(value: unknown): string {
          const str = baseValidate(value);
          try {
            new URL(str);
            return str;
          } catch {
            throw new Error('Invalid URL');
          }
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    }
  };
}

function createNumberSchema() {
  const baseValidate = (value: unknown): number => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Expected number');
    }
    return value;
  };

  const baseSafeParse = (value: unknown) => {
    try {
      return { success: true as const, data: baseValidate(value) };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false as const, error };
      }
      const message = error instanceof Error ? error.message : 'Validation failed';
      return { success: false as const, error: new ZodError([{ message, path: [] }]) };
    }
  };

  return {
    parse: baseValidate,
    safeParse: baseSafeParse,
    optional() {
      return createOptionalSchema(this);
    },
    transform(fn: (value: number) => any) {
      return createTransformSchema(this, fn);
    },
    min(value: number) {
      const self = this;
      return {
        parse(input: unknown): number {
          const num = baseValidate(input);
          if (num < value) {
            throw new Error(`Number must be at least ${value}`);
          }
          return num;
        },
        safeParse(input: unknown) {
          try {
            return { success: true as const, data: this.parse(input) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        max(maxValue: number) {
          return {
            parse(input: unknown): number {
              const num = baseValidate(input);
              if (num < value) {
                throw new Error(`Number must be at least ${value}`);
              }
              if (num > maxValue) {
                throw new Error(`Number must be at most ${maxValue}`);
              }
              return num;
            },
            safeParse(input: unknown) {
              try {
                return { success: true as const, data: this.parse(input) };
              } catch (error) {
                if (error instanceof ZodError) {
                  return { success: false as const, error };
                }
                const message = error instanceof Error ? error.message : 'Validation failed';
                return { success: false as const, error: new ZodError([{ message, path: [] }]) };
              }
            },
            optional() {
              return createOptionalSchema(this);
            }
          };
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    max(value: number) {
      return {
        parse(input: unknown): number {
          const num = baseValidate(input);
          if (num > value) {
            throw new Error(`Number must be at most ${value}`);
          }
          return num;
        },
        safeParse(input: unknown) {
          try {
            return { success: true as const, data: this.parse(input) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        },
        optional() {
          return createOptionalSchema(this);
        }
      };
    },
    int() {
      return {
        parse(input: unknown): number {
          const num = baseValidate(input);
          if (!Number.isInteger(num)) {
            throw new Error('Expected integer');
          }
          return num;
        },
        safeParse(input: unknown) {
          try {
            return { success: true as const, data: this.parse(input) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        }
      };
    },
    positive() {
      return {
        parse(input: unknown): number {
          const num = baseValidate(input);
          if (num <= 0) {
            throw new Error('Number must be positive');
          }
          return num;
        },
        safeParse(input: unknown) {
          try {
            return { success: true as const, data: this.parse(input) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        }
      };
    }
  };
}

function createBooleanSchema() {
  const baseValidate = (value: unknown): boolean => {
    if (typeof value !== 'boolean') {
      throw new Error('Expected boolean');
    }
    return value;
  };

  return {
    parse: baseValidate,
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: baseValidate(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    optional() {
      return createOptionalSchema(this);
    }
  };
}

function createObjectSchema(shape: Record<string, any>) {
  return {
    parse(value: unknown): any {
      if (!value || typeof value !== 'object') {
        throw new Error('Expected object');
      }
      
      const obj = value as Record<string, unknown>;
      const result: Record<string, any> = {};
      
      for (const [key, schema] of Object.entries(shape)) {
        const fieldValue = obj[key];
        result[key] = schema.parse(fieldValue);
      }
      
      return result;
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    shape,
    optional() {
      return createOptionalSchema(this);
    }
  };
}

function createArraySchema(itemSchema: any) {
  return {
    parse(value: unknown): any[] {
      if (!Array.isArray(value)) {
        throw new Error('Expected array');
      }
      return value.map((item, index) => {
        try {
          return itemSchema.parse(item);
        } catch (error) {
          if (error instanceof ZodError) {
            // Propagate with path context
            throw new ZodError(error.issues.map(issue => ({ message: issue.message, path: [index, ...issue.path] })));
          }
          const message = error instanceof Error ? error.message : 'Validation failed';
          throw new ZodError([{ message: `Array item at index ${index}: ${message}`, path: [index] }]);
        }
      });
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    optional() {
      return createOptionalSchema(this);
    }
  };
}

function createOptionalSchema(schema: any) {
  return {
    parse(value: unknown): any {
      if (value === undefined) {
        return undefined;
      }
      return schema.parse(value);
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    }
  };
}

function createTransformSchema(schema: any, transform: (value: any) => any) {
  const baseParse = (value: unknown): any => {
    const parsed = schema.parse(value);
    return transform(parsed);
  };
  return {
    parse: baseParse,
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: baseParse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    pipe(nextSchema: any) {
      return {
        parse(value: unknown): any {
          const transformed = baseParse(value);
          return nextSchema.parse(transformed);
        },
        safeParse(value: unknown) {
          try {
            return { success: true as const, data: this.parse(value) };
          } catch (error) {
            if (error instanceof ZodError) {
              return { success: false as const, error };
            }
            const message = error instanceof Error ? error.message : 'Validation failed';
            return { success: false as const, error: new ZodError([{ message, path: [] }]) };
          }
        }
      };
    }
  };
}

function createEnumSchema(values: readonly [string, ...string[]]) {
  return {
    parse(value: unknown): string {
      if (typeof value !== 'string' || !values.includes(value)) {
        throw new Error(`Expected one of: ${values.join(', ')}`);
      }
      return value;
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    optional() {
      return createOptionalSchema(this);
    }
  };
}

function createRecordSchema(valueSchema: any) {
  return {
    parse(value: unknown): Record<string, any> {
      if (!value || typeof value !== 'object') {
        throw new Error('Expected object');
      }
      
      const obj = value as Record<string, unknown>;
      const result: Record<string, any> = {};
      
      for (const [key, val] of Object.entries(obj)) {
        result[key] = valueSchema.parse(val);
      }
      
      return result;
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false as const, error };
        }
        const message = error instanceof Error ? error.message : 'Validation failed';
        return { success: false as const, error: new ZodError([{ message, path: [] }]) };
      }
    },
    optional() {
      return createOptionalSchema(this);
    }
  };
}

// ZodError class for compatibility
export class ZodError extends Error {
  issues: Array<{ message: string; path: (string | number)[] }>;
  
  constructor(issues: Array<{ message: string; path: (string | number)[] }>) {
    super(issues[0]?.message || 'Validation failed');
    this.issues = issues;
    this.name = 'ZodError';
  }
}

// 🚨 TEMPORARY: Zod-compatible API (will be removed in future versions)
// Use native DHI API instead: import { object, string, number } from 'dhi'
export const z = {
  string: createStringSchema,
  number: createNumberSchema,
  boolean: createBooleanSchema,
  object: createObjectSchema,
  array: createArraySchema,
  optional: createOptionalSchema,
  enum: createEnumSchema,
  record: createRecordSchema,
  ZodError,
  ZodSchema: {} as any, // Type placeholder
  
  // Type inference helper (type-only)
  infer: {} as any
};

// Type namespace for z.infer<T>
export namespace z {
  export type ZodSchema<T = any> = {
    parse(value: unknown): T;
    safeParse(value: unknown):
      | { success: true; data: T }
      | { success: false; error: ZodError };
  };
  export type infer<T> = T extends { parse(value: unknown): infer U } ? U : never;
}

export default z;
