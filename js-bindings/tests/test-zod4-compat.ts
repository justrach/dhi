/**
 * Comprehensive test: dhi as Zod 4 drop-in replacement
 * Tests SIMD-powered validators + full type inference + Zod API parity
 */
import { z, ZodError } from '../schema';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`FAIL: ${name} - ${e.message}`);
  }
}

function expect<T>(value: T) {
  return {
    toBe(expected: T) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toBeTrue() {
      if (value !== true) throw new Error(`Expected true, got ${value}`);
    },
    toBeFalse() {
      if (value !== false) throw new Error(`Expected false, got ${value}`);
    },
    toThrow() {
      try { (value as any)(); throw new Error('Did not throw'); } catch (e: any) { if (e.message === 'Did not throw') throw e; }
    }
  };
}

// ============================================================================
// 1. TYPE INFERENCE TESTS (compile-time only - if these compile, types work)
// ============================================================================

test('Type inference: z.infer on object', () => {
  const userSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  });
  type User = z.infer<typeof userSchema>;

  // This should compile - User = { name: string; age: number; email: string }
  const user: User = { name: 'Alice', age: 30, email: 'alice@example.com' };
  expect(user.name).toBe('Alice');
});

test('Type inference: optional fields', () => {
  const schema = z.object({
    required: z.string(),
    optional: z.string().optional(),
  });
  type T = z.infer<typeof schema>;

  // optional field should be string | undefined
  const val: T = { required: 'hello' };
  expect(val.required).toBe('hello');
});

test('Type inference: transform changes output type', () => {
  const schema = z.string().transform(s => s.length);
  type T = z.infer<typeof schema>;
  // T should be number (output of transform)
  const result: T = schema.parse('hello');
  expect(result).toBe(5);
});

test('Type inference: union types', () => {
  const schema = z.union([z.string(), z.number()]);
  type T = z.infer<typeof schema>;
  // T should be string | number
  const val1: T = 'hello';
  const val2: T = 42;
  expect(schema.parse(val1)).toBe('hello');
  expect(schema.parse(val2)).toBe(42);
});

test('Type inference: literal types', () => {
  const schema = z.literal('hello');
  type T = z.infer<typeof schema>;
  const val: T = 'hello';
  expect(schema.parse(val)).toBe('hello');
});

test('Type inference: enum types', () => {
  const schema = z.enum(['red', 'green', 'blue']);
  type T = z.infer<typeof schema>;
  const val: T = 'red';
  expect(schema.parse(val)).toBe('red');
});

test('Type inference: tuple types', () => {
  const schema = z.tuple([z.string(), z.number(), z.boolean()]);
  type T = z.infer<typeof schema>;
  const val: T = ['hello', 42, true];
  const result = schema.parse(val);
  expect(result[0]).toBe('hello');
  expect(result[1]).toBe(42);
  expect(result[2]).toBe(true);
});

test('Type inference: nullable', () => {
  const schema = z.string().nullable();
  type T = z.infer<typeof schema>;
  const val1: T = 'hello';
  const val2: T = null;
  expect(schema.parse(val1)).toBe('hello');
  expect(schema.parse(val2)).toBe(null);
});

test('Type inference: default value', () => {
  const schema = z.string().default('world');
  type T = z.infer<typeof schema>;
  const val: T = schema.parse(undefined);
  expect(val).toBe('world');
});

// ============================================================================
// 2. STRING VALIDATORS (SIMD-powered)
// ============================================================================

test('String: basic', () => {
  expect(z.string().parse('hello')).toBe('hello');
  expect(z.string().safeParse(42).success).toBeFalse();
});

test('String: min/max', () => {
  expect(z.string().min(3).safeParse('hi').success).toBeFalse();
  expect(z.string().min(3).safeParse('hey').success).toBeTrue();
  expect(z.string().max(5).safeParse('toolong').success).toBeFalse();
  expect(z.string().max(5).safeParse('short').success).toBeTrue();
});

test('String: email (SIMD)', () => {
  expect(z.string().email().safeParse('test@example.com').success).toBeTrue();
  expect(z.string().email().safeParse('user+tag@domain.co.uk').success).toBeTrue();
  expect(z.string().email().safeParse('invalid').success).toBeFalse();
  expect(z.string().email().safeParse('@bad.com').success).toBeFalse();
  expect(z.string().email().safeParse('a@@b.com').success).toBeFalse();
});

test('String: url (SIMD)', () => {
  expect(z.string().url().safeParse('https://example.com').success).toBeTrue();
  expect(z.string().url().safeParse('http://www.test.org/path').success).toBeTrue();
  expect(z.string().url().safeParse('invalid').success).toBeFalse();
  expect(z.string().url().safeParse('ftp://nope.com').success).toBeFalse();
});

test('String: uuid (SIMD)', () => {
  expect(z.string().uuid().safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBeTrue();
  expect(z.string().uuid().safeParse('not-a-uuid').success).toBeFalse();
  expect(z.string().uuid().safeParse('550e8400-e29b-41d4-a716-44665544000g').success).toBeFalse();
});

test('String: ipv4 (SIMD)', () => {
  expect(z.string().ipv4().safeParse('192.168.1.1').success).toBeTrue();
  expect(z.string().ipv4().safeParse('0.0.0.0').success).toBeTrue();
  expect(z.string().ipv4().safeParse('256.1.1.1').success).toBeFalse();
  expect(z.string().ipv4().safeParse('abc').success).toBeFalse();
});

test('String: base64 (SIMD)', () => {
  expect(z.string().base64().safeParse('SGVsbG8=').success).toBeTrue();
  expect(z.string().base64().safeParse('dGVzdA==').success).toBeTrue();
  expect(z.string().base64().safeParse('not base64!').success).toBeFalse();
});

test('String: includes (SIMD Mula algorithm)', () => {
  expect(z.string().includes('world').safeParse('hello world').success).toBeTrue();
  expect(z.string().includes('xyz').safeParse('hello world').success).toBeFalse();
});

test('String: startsWith (SIMD)', () => {
  expect(z.string().startsWith('hello').safeParse('hello world').success).toBeTrue();
  expect(z.string().startsWith('world').safeParse('hello world').success).toBeFalse();
});

test('String: endsWith (SIMD)', () => {
  expect(z.string().endsWith('world').safeParse('hello world').success).toBeTrue();
  expect(z.string().endsWith('hello').safeParse('hello world').success).toBeFalse();
});

test('String: regex', () => {
  expect(z.string().regex(/^\d+$/).safeParse('12345').success).toBeTrue();
  expect(z.string().regex(/^\d+$/).safeParse('abc').success).toBeFalse();
});

test('String: trim + transforms', () => {
  expect(z.string().trim().parse('  hello  ')).toBe('hello');
  expect(z.string().toLowerCase().parse('HELLO')).toBe('hello');
  expect(z.string().toUpperCase().parse('hello')).toBe('HELLO');
});

test('String: datetime', () => {
  expect(z.string().datetime().safeParse('2024-01-15T10:30:00').success).toBeTrue();
  expect(z.string().datetime().safeParse('not-a-date').success).toBeFalse();
});

test('String: date', () => {
  expect(z.string().date().safeParse('2024-01-15').success).toBeTrue();
  expect(z.string().date().safeParse('2024-13-01').success).toBeFalse();
});

test('String: nonempty', () => {
  expect(z.string().nonempty().safeParse('').success).toBeFalse();
  expect(z.string().nonempty().safeParse('a').success).toBeTrue();
});

// ============================================================================
// 3. NUMBER VALIDATORS
// ============================================================================

test('Number: basic', () => {
  expect(z.number().parse(42)).toBe(42);
  expect(z.number().safeParse('42').success).toBeFalse();
  expect(z.number().safeParse(NaN).success).toBeFalse();
});

test('Number: min/max/gt/lt', () => {
  expect(z.number().min(5).safeParse(3).success).toBeFalse();
  expect(z.number().min(5).safeParse(5).success).toBeTrue();
  expect(z.number().max(10).safeParse(15).success).toBeFalse();
  expect(z.number().gt(5).safeParse(5).success).toBeFalse();
  expect(z.number().gt(5).safeParse(6).success).toBeTrue();
  expect(z.number().lt(10).safeParse(10).success).toBeFalse();
  expect(z.number().lt(10).safeParse(9).success).toBeTrue();
});

test('Number: int/positive/negative', () => {
  expect(z.number().int().safeParse(5.5).success).toBeFalse();
  expect(z.number().int().safeParse(5).success).toBeTrue();
  expect(z.number().positive().safeParse(-1).success).toBeFalse();
  expect(z.number().positive().safeParse(1).success).toBeTrue();
  expect(z.number().negative().safeParse(1).success).toBeFalse();
  expect(z.number().negative().safeParse(-1).success).toBeTrue();
});

test('Number: multipleOf/finite', () => {
  expect(z.number().multipleOf(5).safeParse(10).success).toBeTrue();
  expect(z.number().multipleOf(5).safeParse(11).success).toBeFalse();
  expect(z.number().finite().safeParse(Infinity).success).toBeFalse();
  expect(z.number().finite().safeParse(42).success).toBeTrue();
});

// ============================================================================
// 4. OBJECT SCHEMAS
// ============================================================================

test('Object: basic validation', () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const result = schema.parse({ name: 'Alice', age: 30 });
  expect(result.name).toBe('Alice');
  expect(result.age).toBe(30);
});

test('Object: strips unknown keys by default', () => {
  const schema = z.object({ name: z.string() });
  const result = schema.parse({ name: 'Alice', extra: 'ignored' });
  expect((result as any).extra).toBe(undefined);
});

test('Object: strict mode', () => {
  const schema = z.object({ name: z.string() }).strict();
  expect(schema.safeParse({ name: 'Alice', extra: 'bad' }).success).toBeFalse();
});

test('Object: passthrough', () => {
  const schema = z.object({ name: z.string() }).passthrough();
  const result = schema.parse({ name: 'Alice', extra: 'kept' });
  expect((result as any).extra).toBe('kept');
});

test('Object: partial', () => {
  const schema = z.object({ name: z.string(), age: z.number() }).partial();
  expect(schema.safeParse({}).success).toBeTrue();
  expect(schema.safeParse({ name: 'Alice' }).success).toBeTrue();
});

test('Object: pick/omit', () => {
  const schema = z.object({ name: z.string(), age: z.number(), email: z.string() });
  const picked = schema.pick({ name: true, age: true });
  expect(picked.safeParse({ name: 'Alice', age: 30 }).success).toBeTrue();

  const omitted = schema.omit({ email: true });
  expect(omitted.safeParse({ name: 'Alice', age: 30 }).success).toBeTrue();
});

test('Object: extend/merge', () => {
  const base = z.object({ name: z.string() });
  const extended = base.extend({ age: z.number() });
  expect(extended.parse({ name: 'Alice', age: 30 }).age).toBe(30);
});

test('Object: nested errors with paths', () => {
  const schema = z.object({
    user: z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    }),
  });
  const result = schema.safeParse({ user: { name: '', age: -1 } });
  expect(result.success).toBeFalse();
  if (!result.success) {
    expect(result.error.issues.length > 0).toBeTrue();
    // Path should include nested field
    expect(result.error.issues[0].path.length > 0).toBeTrue();
  }
});

// ============================================================================
// 5. ARRAY, TUPLE, RECORD, MAP, SET
// ============================================================================

test('Array: basic', () => {
  const schema = z.array(z.number());
  expect(schema.parse([1, 2, 3]).length).toBe(3);
  expect(schema.safeParse('not array').success).toBeFalse();
});

test('Array: min/max/nonempty', () => {
  expect(z.array(z.number()).min(2).safeParse([1]).success).toBeFalse();
  expect(z.array(z.number()).max(2).safeParse([1, 2, 3]).success).toBeFalse();
  expect(z.array(z.number()).nonempty().safeParse([]).success).toBeFalse();
});

test('Tuple: basic', () => {
  const schema = z.tuple([z.string(), z.number()]);
  const result = schema.parse(['hello', 42]);
  expect(result[0]).toBe('hello');
  expect(result[1]).toBe(42);
  expect(schema.safeParse(['hello']).success).toBeFalse();
});

test('Record: basic', () => {
  const schema = z.record(z.number());
  const result = schema.parse({ a: 1, b: 2 });
  expect(result.a).toBe(1);
  expect(schema.safeParse({ a: 'not number' }).success).toBeFalse();
});

test('Map: basic', () => {
  const schema = z.map(z.string(), z.number());
  const m = new Map([['a', 1], ['b', 2]]);
  const result = schema.parse(m);
  expect(result.get('a')).toBe(1);
});

test('Set: basic', () => {
  const schema = z.set(z.number());
  const s = new Set([1, 2, 3]);
  const result = schema.parse(s);
  expect(result.size).toBe(3);
});

// ============================================================================
// 6. UNION, DISCRIMINATED UNION, INTERSECTION
// ============================================================================

test('Union: basic', () => {
  const schema = z.union([z.string(), z.number()]);
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(42)).toBe(42);
  expect(schema.safeParse(true).success).toBeFalse();
});

test('Discriminated union', () => {
  const schema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('circle'), radius: z.number() }),
    z.object({ type: z.literal('square'), side: z.number() }),
  ]);
  const circle = schema.parse({ type: 'circle', radius: 5 });
  expect(circle.radius).toBe(5);
  expect(schema.safeParse({ type: 'triangle', side: 3 }).success).toBeFalse();
});

test('Intersection', () => {
  const schema = z.intersection(
    z.object({ name: z.string() }),
    z.object({ age: z.number() })
  );
  const result = schema.parse({ name: 'Alice', age: 30 });
  expect(result.name).toBe('Alice');
  expect(result.age).toBe(30);
});

// ============================================================================
// 7. MODIFIERS: optional, nullable, default, catch, transform, refine, pipe
// ============================================================================

test('Optional', () => {
  const schema = z.string().optional();
  expect(schema.parse(undefined)).toBe(undefined);
  expect(schema.parse('hello')).toBe('hello');
});

test('Nullable', () => {
  const schema = z.string().nullable();
  expect(schema.parse(null)).toBe(null);
  expect(schema.parse('hello')).toBe('hello');
});

test('Nullish', () => {
  const schema = z.string().nullish();
  expect(schema.parse(null)).toBe(null);
  expect(schema.parse(undefined)).toBe(undefined);
  expect(schema.parse('hello')).toBe('hello');
});

test('Default', () => {
  const schema = z.string().default('fallback');
  expect(schema.parse(undefined)).toBe('fallback');
  expect(schema.parse('custom')).toBe('custom');
});

test('Catch', () => {
  const schema = z.number().catch(0);
  expect(schema.parse('not a number')).toBe(0);
  expect(schema.parse(42)).toBe(42);
});

test('Transform', () => {
  const schema = z.string().transform(s => s.length);
  expect(schema.parse('hello')).toBe(5);
});

test('Refine', () => {
  const schema = z.number().refine(n => n > 0, 'Must be positive');
  expect(schema.safeParse(-1).success).toBeFalse();
  expect(schema.safeParse(1).success).toBeTrue();
});

test('SuperRefine', () => {
  const schema = z.string().superRefine((val, ctx) => {
    if (val.length < 5) ctx.addIssue({ message: 'Too short' });
  });
  expect(schema.safeParse('hi').success).toBeFalse();
  expect(schema.safeParse('hello world').success).toBeTrue();
});

test('Pipe', () => {
  const schema = z.string().transform(s => parseInt(s, 10)).pipe(z.number().min(0));
  expect(schema.parse('42')).toBe(42);
  expect(schema.safeParse('-5').success).toBeFalse();
});

test('Or (union shorthand)', () => {
  const schema = z.string().or(z.number());
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(42)).toBe(42);
});

test('And (intersection shorthand)', () => {
  const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
  const result = schema.parse({ a: 'hello', b: 42 });
  expect(result.a).toBe('hello');
  expect(result.b).toBe(42);
});

test('Readonly', () => {
  const schema = z.object({ name: z.string() }).readonly();
  const result = schema.parse({ name: 'Alice' });
  expect(result.name).toBe('Alice');
  // Object should be frozen
  expect(Object.isFrozen(result)).toBeTrue();
});

// ============================================================================
// 8. COERCION
// ============================================================================

test('Coerce string', () => {
  expect(z.coerce.string().parse(42)).toBe('42');
  expect(z.coerce.string().parse(true)).toBe('true');
});

test('Coerce number', () => {
  expect(z.coerce.number().parse('42')).toBe(42);
  expect(z.coerce.number().parse(true)).toBe(1);
});

test('Coerce boolean', () => {
  expect(z.coerce.boolean().parse(1)).toBe(true);
  expect(z.coerce.boolean().parse(0)).toBe(false);
  expect(z.coerce.boolean().parse('')).toBe(false);
});

test('Coerce date', () => {
  const result = z.coerce.date().parse('2024-01-15');
  expect(result instanceof Date).toBeTrue();
});

// ============================================================================
// 9. ZOD 4 NEW FEATURES
// ============================================================================

test('StringBool', () => {
  const schema = z.stringbool();
  expect(schema.parse('true')).toBe(true);
  expect(schema.parse('false')).toBe(false);
  expect(schema.parse('1')).toBe(true);
  expect(schema.parse('0')).toBe(false);
  expect(schema.parse('yes')).toBe(true);
  expect(schema.parse('no')).toBe(false);
  expect(schema.safeParse('maybe').success).toBeFalse();
});

test('Lazy (recursive types)', () => {
  type Category = { name: string; children: Category[] };
  const categorySchema: any = z.lazy(() =>
    z.object({
      name: z.string(),
      children: z.array(categorySchema),
    })
  );
  const result = categorySchema.parse({
    name: 'root',
    children: [{ name: 'child', children: [] }],
  });
  expect(result.name).toBe('root');
  expect(result.children[0].name).toBe('child');
});

test('Enum: extract/exclude', () => {
  const colors = z.enum(['red', 'green', 'blue']);
  const warm = colors.extract(['red']);
  expect(warm.safeParse('red').success).toBeTrue();
  expect(warm.safeParse('blue').success).toBeFalse();
});

test('NativeEnum', () => {
  enum Direction { Up = 'UP', Down = 'DOWN' }
  const schema = z.nativeEnum(Direction);
  expect(schema.parse('UP')).toBe('UP');
  expect(schema.safeParse('LEFT').success).toBeFalse();
});

test('BigInt', () => {
  expect(z.bigint().parse(42n)).toBe(42n);
  expect(z.bigint().positive().safeParse(-1n).success).toBeFalse();
  expect(z.bigint().min(10n).safeParse(5n).success).toBeFalse();
});

test('Date schema', () => {
  const now = new Date();
  expect(z.date().parse(now)).toBe(now);
  expect(z.date().safeParse('not a date').success).toBeFalse();
});

test('Instance of', () => {
  const schema = z.instanceof(Date);
  expect(schema.parse(new Date()) instanceof Date).toBeTrue();
  expect(schema.safeParse('not a date').success).toBeFalse();
});

test('Custom validator', () => {
  const isPositive = (val: unknown): val is number => typeof val === 'number' && val > 0;
  const schema = z.custom(isPositive, { message: 'Must be positive number' });
  expect(schema.parse(5)).toBe(5);
  expect(schema.safeParse(-1).success).toBeFalse();
});

test('Preprocess', () => {
  const schema = z.preprocess((val) => String(val).trim(), z.string().min(1));
  expect(schema.parse('  hello  ')).toBe('hello');
  expect(schema.safeParse('   ').success).toBeFalse();
});

// ============================================================================
// 10. ERROR HANDLING
// ============================================================================

test('ZodError: format()', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });
  const result = schema.safeParse({ name: 42, age: 'bad' });
  if (!result.success) {
    const formatted = result.error.format();
    expect(typeof formatted).toBe('object');
    expect(Array.isArray(formatted._errors)).toBeTrue();
  }
});

test('ZodError: flatten()', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });
  const result = schema.safeParse({ name: 42, age: 'bad' });
  if (!result.success) {
    const flat = result.error.flatten();
    expect(typeof flat.fieldErrors).toBe('object');
    expect(Array.isArray(flat.formErrors)).toBeTrue();
  }
});

test('Error is instance of ZodError', () => {
  const schema = z.string();
  const result = schema.safeParse(42);
  if (!result.success) {
    expect(result.error instanceof ZodError).toBeTrue();
    expect(result.error.name).toBe('ZodError');
  }
});

test('Parse throws ZodError', () => {
  const schema = z.string();
  let caught = false;
  try {
    schema.parse(42);
  } catch (e) {
    caught = e instanceof ZodError;
  }
  expect(caught).toBeTrue();
});

// ============================================================================
// 11. MISC: describe, meta, brand, array shorthand
// ============================================================================

test('Describe', () => {
  const schema = z.string().describe('A name field');
  expect(schema._description).toBe('A name field');
});

test('Meta', () => {
  const schema = z.string().meta({ label: 'Name' });
  expect(schema._metadata?.label).toBe('Name');
});

test('Array shorthand (.array())', () => {
  const schema = z.string().array();
  const result = schema.parse(['a', 'b', 'c']);
  expect(result.length).toBe(3);
});

// ============================================================================
// RESULTS
// ============================================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`  dhi Zod 4 Compatibility Test Results`);
console.log(`${'='.repeat(60)}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
