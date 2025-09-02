// 🚨 TEMPORARY Zod Compatibility Layer
// Thin Zod-like facade to support migration; prefer native DHI typed API for performance.

type Path = (string | number)[];
type Issue = { code: string; message: string; path: Path; params?: Record<string, any> };

function joinPath(p: Path): string {
  return p
    .map((seg) => (typeof seg === 'number' ? `[${seg}]` : p.length && typeof seg === 'string' && /\./.test(seg) ? `['${seg}']` : String(seg)))
    .join(p.length ? '.' : '');
}

function err(code: string, message: string, path: Path = [], params?: Record<string, any>): never {
  throw new ZodError([{ code, message, path, params }]);
}

export class ZodError extends Error {
  issues: Issue[];

  constructor(issues: Issue[]) {
    super(issues[0]?.message || 'Validation error');
    this.name = 'ZodError';
    this.issues = issues;
  }

  flatten() {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];
    for (const i of this.issues) {
      if (!i.path || i.path.length === 0) {
        formErrors.push(i.message);
      } else {
        const key = joinPath(i.path);
        (fieldErrors[key] ||= []).push(i.message);
      }
    }
    return { formErrors, fieldErrors };
  }

  toString(): string {
    return `ZodError: ${this.issues.map((i) => `${i.code} at ${joinPath(i.path) || '<root>'}: ${i.message}`).join('; ')}`;
  }
}

type SafeParse<T> = { success: true; data: T } | { success: false; error: ZodError };

function wrapSafe<T>(fn: () => T): SafeParse<T> {
  try {
    return { success: true, data: fn() };
  } catch (e: any) {
    if (e instanceof ZodError) return { success: false, error: e };
    const message = e instanceof Error ? e.message : 'Validation failed';
    return { success: false, error: new ZodError([{ code: 'custom', message, path: [] }]) };
  }
}

function makeCommon<T>(parse: (input: unknown, path?: Path) => T) {
  const self: any = {
    parse(input: unknown) {
      return parse(input, []);
    },
    async parseAsync(input: unknown) {
      return self.parse(input);
    },
    safeParse(input: unknown): SafeParse<T> {
      return wrapSafe(() => self.parse(input));
    },
    async safeParseAsync(input: unknown): Promise<SafeParse<T>> {
      try {
        const data = await self.parseAsync(input);
        return { success: true, data };
      } catch (e: any) {
        if (e instanceof ZodError) return { success: false, error: e };
        const message = e instanceof Error ? e.message : 'Validation failed';
        return { success: false, error: new ZodError([{ code: 'custom', message, path: [] }]) };
      }
    },
    is(input: unknown): input is T {
      return self.safeParse(input).success;
    },
    optional() {
      return createOptionalSchema(self);
    },
    nullable() {
      return createNullableSchema(self);
    }
  };
  return self as T & any;
}

function createStringSchema() {
  const base = makeCommon<string>((value, path = []) => {
    if (typeof value !== 'string') err('invalid_type', 'Expected string', path, { expected: 'string' });
    return value;
  });

  return Object.assign(base, {
    min(length: number, message?: string) {
      return makeCommon<string>((v, p = []) => {
        const s = base.parse(v);
        if (s.length < length) err('too_small', message || `String must contain at least ${length} character(s)`, p, { minimum: length, type: 'string' });
        return s;
      });
    },
    max(length: number, message?: string) {
      return makeCommon<string>((v, p = []) => {
        const s = base.parse(v);
        if (s.length > length) err('too_big', message || `String must contain at most ${length} character(s)`, p, { maximum: length, type: 'string' });
        return s;
      });
    },
    length(len: number, message?: string) {
      return makeCommon<string>((v, p = []) => {
        const s = base.parse(v);
        if (s.length !== len) err('invalid_string', message || `String must contain exactly ${len} character(s)`, p, { length: len });
        return s;
      });
    },
    nonempty(message?: string) {
      return (this as any).min(1, message || 'String must contain at least 1 character(s)');
    },
    regex(pattern: RegExp, message?: string) {
      return makeCommon<string>((v, p = []) => {
        const s = base.parse(v);
        if (!pattern.test(s)) err('invalid_string', message || `Invalid string`, p, { validation: 'regex' });
        return s;
      });
    },
    email(message?: string) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return (this as any).regex(emailRegex, message || 'Invalid email');
    },
    url(message?: string) {
      return makeCommon<string>((v, p = []) => {
        const s = base.parse(v);
        try {
          new URL(s);
          return s;
        } catch {
          err('invalid_string', message || 'Invalid url', p, { validation: 'url' });
        }
      });
    },
    trim() {
      return createTransformSchema(base, (s: string) => s.trim());
    },
    toLowerCase() {
      return createTransformSchema(base, (s: string) => s.toLowerCase());
    },
    toUpperCase() {
      return createTransformSchema(base, (s: string) => s.toUpperCase());
    },
    transform(fn: (value: string) => any) {
      return createTransformSchema(base, fn);
    }
  });
}

function createNumberSchema() {
  const base = makeCommon<number>((value, path = []) => {
    if (typeof value !== 'number' || Number.isNaN(value)) err('invalid_type', 'Expected number', path, { expected: 'number' });
    return value;
  });

  const withCmp = {
    gt(n: number, message?: string) {
      return makeCommon<number>((v, p = []) => {
        const num = base.parse(v);
        if (!(num > n)) err('too_small', message || `Number must be greater than ${n}`, p, { inclusive: false, minimum: n });
        return num;
      });
    },
    gte(n: number, message?: string) {
      return makeCommon<number>((v, p = []) => {
        const num = base.parse(v);
        if (num < n) err('too_small', message || `Number must be greater than or equal to ${n}`, p, { inclusive: true, minimum: n });
        return num;
      });
    },
    lt(n: number, message?: string) {
      return makeCommon<number>((v, p = []) => {
        const num = base.parse(v);
        if (!(num < n)) err('too_big', message || `Number must be less than ${n}`, p, { inclusive: false, maximum: n });
        return num;
      });
    },
    lte(n: number, message?: string) {
      return makeCommon<number>((v, p = []) => {
        const num = base.parse(v);
        if (num > n) err('too_big', message || `Number must be less than or equal to ${n}`, p, { inclusive: true, maximum: n });
        return num;
      });
    }
  };

  return Object.assign(base, withCmp, {
    int(message?: string) {
      return makeCommon<number>((v, p = []) => {
        const num = base.parse(v);
        if (!Number.isInteger(num)) err('invalid_type', message || 'Expected integer', p, { expected: 'integer' });
        return num;
      });
    },
    positive(message?: string) {
      return (this as any).gt(0, message || 'Number must be greater than 0');
    },
    negative(message?: string) {
      return (this as any).lt(0, message || 'Number must be less than 0');
    }
  });
}

function createBooleanSchema() {
  return makeCommon<boolean>((value, path = []) => {
    if (typeof value !== 'boolean') err('invalid_type', 'Expected boolean', path, { expected: 'boolean' });
    return value;
  });
}

type UnknownKeys = 'strip' | 'passthrough' | 'strict';

function createObjectSchema(shape: Record<string, any>, unknownKeys: UnknownKeys = 'strip') {
  const base = makeCommon<any>((value, path = []) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) err('invalid_type', 'Expected object', path, { expected: 'object' });
    const input = value as Record<string, unknown>;
    const out: Record<string, any> = {};
    const keys = Object.keys(shape);

    // parse defined keys
    for (const key of keys) {
      const schema = shape[key];
      try {
        out[key] = schema.parse(input[key]);
      } catch (e: any) {
        if (e instanceof ZodError) {
          throw new ZodError(e.issues.map((iss) => ({ ...iss, path: [key, ...iss.path] })));
        }
        err('custom', e?.message || 'Invalid field', [key]);
      }
    }

    const extraKeys = Object.keys(input).filter((k) => !(k in shape));
    if (unknownKeys === 'strict' && extraKeys.length) {
      throw new ZodError(extraKeys.map((k) => ({ code: 'unrecognized_keys', message: `Unrecognized key: ${k}`, path: [k] })));
    }
    if (unknownKeys === 'passthrough') {
      for (const k of extraKeys) out[k] = (input as any)[k];
    }
    // strip: ignore extras
    return out;
  });

  return Object.assign(base, {
    shape,
    passthrough() {
      return createObjectSchema(shape, 'passthrough');
    },
    strip() {
      return createObjectSchema(shape, 'strip');
    },
    strict() {
      return createObjectSchema(shape, 'strict');
    }
  });
}

function createArraySchema(itemSchema: any) {
  const base = makeCommon<any[]>((value, path = []) => {
    if (!Array.isArray(value)) err('invalid_type', 'Expected array', path, { expected: 'array' });
    const out: any[] = [];
    for (let i = 0; i < value.length; i++) {
      try {
        out[i] = itemSchema.parse(value[i]);
      } catch (e: any) {
        if (e instanceof ZodError) throw new ZodError(e.issues.map((iss) => ({ ...iss, path: [i, ...iss.path] })));
        err('custom', e?.message || 'Invalid element', [i]);
      }
    }
    return out;
  });

  return Object.assign(base, {
    min(n: number, message?: string) {
      return makeCommon<any[]>((v, p = []) => {
        const arr = base.parse(v);
        if (arr.length < n) err('too_small', message || `Array must contain at least ${n} element(s)`, p, { minimum: n, type: 'array' });
        return arr;
      });
    },
    max(n: number, message?: string) {
      return makeCommon<any[]>((v, p = []) => {
        const arr = base.parse(v);
        if (arr.length > n) err('too_big', message || `Array must contain at most ${n} element(s)`, p, { maximum: n, type: 'array' });
        return arr;
      });
    },
    length(n: number, message?: string) {
      return makeCommon<any[]>((v, p = []) => {
        const arr = base.parse(v);
        if (arr.length !== n) err('invalid_array', message || `Array must contain exactly ${n} element(s)`, p, { length: n });
        return arr;
      });
    },
    nonempty(message?: string) {
      return (this as any).min(1, message || 'Array must contain at least 1 element(s)');
    }
  });
}

function createOptionalSchema(schema: any) {
  return makeCommon<any>((value, path = []) => {
    if (value === undefined) return undefined;
    return schema.parse(value);
  });
}

function createNullableSchema(schema: any) {
  return makeCommon<any>((value, path = []) => {
    if (value === null) return null;
    return schema.parse(value);
  });
}

function createTransformSchema(schema: any, transform: (value: any) => any) {
  const parse = (value: unknown) => transform(schema.parse(value));
  const base = makeCommon<any>(() => parse as any);
  // Ensure parse actually calls above function
  (base as any).parse = (value: unknown) => parse(value);
  (base as any).transform = (fn: (v: any) => any) => createTransformSchema(base, fn);
  (base as any).pipe = (nextSchema: any) => makeCommon<any>((v) => nextSchema.parse(parse(v)));
  return base;
}

function createEnumSchema(values: readonly [string, ...string[]]) {
  const set = new Set(values);
  return makeCommon<string>((value, path = []) => {
    if (typeof value !== 'string' || !set.has(value)) err('invalid_enum_value', `Invalid enum value. Expected ${values.join(', ')}`, path, { options: values });
    return value;
  });
}

function createRecordSchema(valueSchema: any) {
  return makeCommon<Record<string, any>>((value, path = []) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) err('invalid_type', 'Expected object', path, { expected: 'object' });
    const obj = value as Record<string, unknown>;
    const out: Record<string, any> = {};
    for (const k of Object.keys(obj)) {
      try {
        out[k] = valueSchema.parse(obj[k]);
      } catch (e: any) {
        if (e instanceof ZodError) throw new ZodError(e.issues.map((iss) => ({ ...iss, path: [k, ...iss.path] })));
        err('custom', e?.message || 'Invalid value', [k]);
      }
    }
    return out;
  });
}

function createUnionSchema(options: any[]) {
  return makeCommon<any>((value) => {
    const errors: ZodError[] = [];
    for (const opt of options) {
      const res = opt.safeParse(value);
      if (res.success) return res.data;
      errors.push(res.error);
    }
    // Return first error for simplicity; Zod aggregates but this keeps it small
    throw errors[0] || new ZodError([{ code: 'invalid_union', message: 'Invalid input', path: [] }]);
  });
}

function createDiscriminatedUnionSchema<K extends string>(key: K, options: Record<string, any>) {
  return makeCommon<any>((value, path = []) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) err('invalid_type', 'Expected object', path, { expected: 'object' });
    const disc = (value as any)[key];
    const schema = options[disc as any];
    if (!schema) err('invalid_union_discriminator', `Invalid discriminator value`, [...path, key]);
    return schema.parse(value);
  });
}

export const z = {
  string: createStringSchema,
  number: createNumberSchema,
  boolean: createBooleanSchema,
  object: createObjectSchema,
  array: createArraySchema,
  optional: createOptionalSchema,
  nullable: createNullableSchema,
  enum: createEnumSchema,
  record: createRecordSchema,
  union: createUnionSchema,
  discriminatedUnion: createDiscriminatedUnionSchema,
  ZodError,
  ZodSchema: {} as any,
  infer: {} as any
};

export namespace z {
  export type ZodSchema<T = any> = {
    parse(value: unknown): T;
    parseAsync(value: unknown): Promise<T>;
    safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodError };
    safeParseAsync(value: unknown): Promise<{ success: true; data: T } | { success: false; error: ZodError }>;
    is(value: unknown): value is T;
  };
  export type infer<T> = T extends { parse(value: unknown): infer U } ? U : never;
}

export default z;
