/**
 * Comprehensive test: dhi as Zod 4 drop-in replacement
 * Tests SIMD-powered validators + full type inference + Zod API parity
 */
import { z, ZodError } from './schema';

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
