/**
 * N-API native addon compatibility test suite
 * Mirrors test-zod4-compat.ts but imports from schema-napi (N-API backend)
 * Extra coverage: deep union/discriminated-union scenarios, native validator edge cases
 */
import { z, ZodError } from '../schema-napi';

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
  };
}

// ============================================================================
// 1. TYPE INFERENCE
// ============================================================================

test('Type inference: z.infer on object', () => {
  const schema = z.object({ name: z.string(), age: z.number(), email: z.string().email() });
  type User = z.infer<typeof schema>;
  const user: User = { name: 'Alice', age: 30, email: 'alice@example.com' };
  expect(user.name).toBe('Alice');
});

test('Type inference: optional fields', () => {
  const schema = z.object({ required: z.string(), optional: z.string().optional() });
  type T = z.infer<typeof schema>;
  const val: T = { required: 'hello' };
  expect(val.required).toBe('hello');
});

test('Type inference: transform changes output type', () => {
  const schema = z.string().transform(s => s.length);
  const result = schema.parse('hello');
  expect(result).toBe(5);
});

test('Type inference: union types', () => {
  const schema = z.union([z.string(), z.number()]);
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(42)).toBe(42);
});

test('Type inference: literal types', () => {
  const schema = z.literal('hello');
  expect(schema.parse('hello')).toBe('hello');
});

test('Type inference: enum types', () => {
  const schema = z.enum(['red', 'green', 'blue']);
  expect(schema.parse('red')).toBe('red');
});

test('Type inference: tuple types', () => {
  const schema = z.tuple([z.string(), z.number(), z.boolean()]);
  const result = schema.parse(['hello', 42, true]);
  expect(result[0]).toBe('hello');
  expect(result[1]).toBe(42);
  expect(result[2]).toBe(true);
});

test('Type inference: nullable', () => {
  const schema = z.string().nullable();
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(null)).toBe(null);
});

test('Type inference: default value', () => {
  const schema = z.string().default('world');
  expect(schema.parse(undefined)).toBe('world');
});

// ============================================================================
// 2. STRING VALIDATORS (native N-API backend)
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

test('String: email (native)', () => {
  expect(z.string().email().safeParse('test@example.com').success).toBeTrue();
  expect(z.string().email().safeParse('user+tag@domain.co.uk').success).toBeTrue();
  expect(z.string().email().safeParse('invalid').success).toBeFalse();
  expect(z.string().email().safeParse('@bad.com').success).toBeFalse();
  expect(z.string().email().safeParse('a@@b.com').success).toBeFalse();
  expect(z.string().email().safeParse('').success).toBeFalse();
});

test('String: email edge cases (native)', () => {
  expect(z.string().email().safeParse('a@b.co').success).toBeTrue();
  expect(z.string().email().safeParse('a.b+c_d@sub.domain.com').success).toBeTrue();
  expect(z.string().email().safeParse('no-at-sign').success).toBeFalse();
  expect(z.string().email().safeParse('missing@tld').success).toBeFalse();
});

test('String: url (native)', () => {
  expect(z.string().url().safeParse('https://example.com').success).toBeTrue();
  expect(z.string().url().safeParse('http://www.test.org/path?q=1').success).toBeTrue();
  expect(z.string().url().safeParse('invalid').success).toBeFalse();
  expect(z.string().url().safeParse('ftp://nope.com').success).toBeFalse();
  expect(z.string().url().safeParse('https://').success).toBeFalse();
});

test('String: uuid (native)', () => {
  expect(z.string().uuid().safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBeTrue();
  expect(z.string().uuid().safeParse('00000000-0000-0000-0000-000000000000').success).toBeTrue();
  expect(z.string().uuid().safeParse('not-a-uuid').success).toBeFalse();
  expect(z.string().uuid().safeParse('550e8400-e29b-41d4-a716-44665544000g').success).toBeFalse();
  expect(z.string().uuid().safeParse('').success).toBeFalse();
});

test('String: ipv4 (native)', () => {
  expect(z.string().ipv4().safeParse('192.168.1.1').success).toBeTrue();
  expect(z.string().ipv4().safeParse('0.0.0.0').success).toBeTrue();
  expect(z.string().ipv4().safeParse('255.255.255.255').success).toBeTrue();
  expect(z.string().ipv4().safeParse('256.1.1.1').success).toBeFalse();
  expect(z.string().ipv4().safeParse('abc').success).toBeFalse();
  expect(z.string().ipv4().safeParse('1.2.3').success).toBeFalse();
});

test('String: base64 (native)', () => {
  expect(z.string().base64().safeParse('SGVsbG8=').success).toBeTrue();
  expect(z.string().base64().safeParse('dGVzdA==').success).toBeTrue();
  expect(z.string().base64().safeParse('not base64!').success).toBeFalse();
});

test('String: datetime (native)', () => {
  expect(z.string().datetime().safeParse('2024-01-15T10:30:00').success).toBeTrue();
  expect(z.string().datetime().safeParse('2024-01-15T10:30:00Z').success).toBeTrue();
  expect(z.string().datetime().safeParse('not-a-date').success).toBeFalse();
});

test('String: date (native)', () => {
  expect(z.string().date().safeParse('2024-01-15').success).toBeTrue();
  expect(z.string().date().safeParse('2024-13-01').success).toBeFalse();
  expect(z.string().date().safeParse('2024/01/15').success).toBeFalse();
});

test('String: includes (native)', () => {
  expect(z.string().includes('world').safeParse('hello world').success).toBeTrue();
  expect(z.string().includes('xyz').safeParse('hello world').success).toBeFalse();
});

test('String: startsWith (native)', () => {
  expect(z.string().startsWith('hello').safeParse('hello world').success).toBeTrue();
  expect(z.string().startsWith('world').safeParse('hello world').success).toBeFalse();
});

test('String: endsWith (native)', () => {
  expect(z.string().endsWith('world').safeParse('hello world').success).toBeTrue();
  expect(z.string().endsWith('hello').safeParse('hello world').success).toBeFalse();
});

test('String: regex', () => {
  expect(z.string().regex(/^\d+$/).safeParse('12345').success).toBeTrue();
  expect(z.string().regex(/^\d+$/).safeParse('abc').success).toBeFalse();
});

test('String: trim/toLowerCase/toUpperCase', () => {
  expect(z.string().trim().parse('  hello  ')).toBe('hello');
  expect(z.string().toLowerCase().parse('HELLO')).toBe('hello');
  expect(z.string().toUpperCase().parse('hello')).toBe('HELLO');
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

test('Number: min/max/gt/lt/gte/lte (native)', () => {
  expect(z.number().min(5).safeParse(3).success).toBeFalse();
  expect(z.number().min(5).safeParse(5).success).toBeTrue();
  expect(z.number().max(10).safeParse(15).success).toBeFalse();
  expect(z.number().gt(5).safeParse(5).success).toBeFalse();
  expect(z.number().gt(5).safeParse(6).success).toBeTrue();
  expect(z.number().lt(10).safeParse(10).success).toBeFalse();
  expect(z.number().lt(10).safeParse(9).success).toBeTrue();
  expect(z.number().gte(5).safeParse(5).success).toBeTrue();
  expect(z.number().lte(10).safeParse(10).success).toBeTrue();
});

test('Number: int/positive/negative/nonnegative (native)', () => {
  expect(z.number().int().safeParse(5.5).success).toBeFalse();
  expect(z.number().int().safeParse(5).success).toBeTrue();
  expect(z.number().positive().safeParse(-1).success).toBeFalse();
  expect(z.number().positive().safeParse(0).success).toBeFalse();
  expect(z.number().positive().safeParse(1).success).toBeTrue();
  expect(z.number().negative().safeParse(1).success).toBeFalse();
  expect(z.number().negative().safeParse(-1).success).toBeTrue();
  expect(z.number().nonnegative().safeParse(-1).success).toBeFalse();
  expect(z.number().nonnegative().safeParse(0).success).toBeTrue();
});

test('Number: multipleOf/finite (native)', () => {
  expect(z.number().multipleOf(5).safeParse(10).success).toBeTrue();
  expect(z.number().multipleOf(5).safeParse(11).success).toBeFalse();
  expect(z.number().finite().safeParse(Infinity).success).toBeFalse();
  expect(z.number().finite().safeParse(-Infinity).success).toBeFalse();
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

test('Object: strips unknown keys', () => {
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
  expect(schema.pick({ name: true, age: true }).safeParse({ name: 'Alice', age: 30 }).success).toBeTrue();
  expect(schema.omit({ email: true }).safeParse({ name: 'Alice', age: 30 }).success).toBeTrue();
});

test('Object: extend', () => {
  const base = z.object({ name: z.string() });
  const extended = base.extend({ age: z.number() });
  expect(extended.parse({ name: 'Alice', age: 30 }).age).toBe(30);
});

test('Object: nested errors with paths', () => {
  const schema = z.object({ user: z.object({ name: z.string().min(1), age: z.number().positive() }) });
  const result = schema.safeParse({ user: { name: '', age: -1 } });
  expect(result.success).toBeFalse();
  if (!result.success) {
    expect(result.error.issues.length > 0).toBeTrue();
    expect(result.error.issues[0].path.length > 0).toBeTrue();
  }
});

test('Object: deeply nested', () => {
  const schema = z.object({ a: z.object({ b: z.object({ c: z.string().email() }) }) });
  expect(schema.safeParse({ a: { b: { c: 'test@example.com' } } }).success).toBeTrue();
  expect(schema.safeParse({ a: { b: { c: 'not-email' } } }).success).toBeFalse();
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
  expect(z.array(z.number()).nonempty().safeParse([1]).success).toBeTrue();
});

test('Array: of objects', () => {
  const schema = z.array(z.object({ id: z.number(), email: z.string().email() }));
  expect(schema.safeParse([{ id: 1, email: 'a@b.com' }, { id: 2, email: 'c@d.com' }]).success).toBeTrue();
  expect(schema.safeParse([{ id: 1, email: 'not-email' }]).success).toBeFalse();
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
  const result = schema.parse(new Map([['a', 1], ['b', 2]]));
  expect(result.get('a')).toBe(1);
});

test('Set: basic', () => {
  const schema = z.set(z.number());
  const result = schema.parse(new Set([1, 2, 3]));
  expect(result.size).toBe(3);
});

// ============================================================================
// 6. UNION — comprehensive coverage
// ============================================================================

test('Union: string | number', () => {
  const schema = z.union([z.string(), z.number()]);
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(42)).toBe(42);
  expect(schema.safeParse(true).success).toBeFalse();
  expect(schema.safeParse(null).success).toBeFalse();
});

test('Union: 3+ members', () => {
  const schema = z.union([z.string(), z.number(), z.boolean()]);
  expect(schema.parse('x')).toBe('x');
  expect(schema.parse(1)).toBe(1);
  expect(schema.parse(true)).toBe(true);
  expect(schema.safeParse(null).success).toBeFalse();
});

test('Union: object shapes', () => {
  const schema = z.union([
    z.object({ kind: z.literal('a'), x: z.number() }),
    z.object({ kind: z.literal('b'), y: z.string() }),
  ]);
  expect(schema.parse({ kind: 'a', x: 1 }).kind).toBe('a');
  expect(schema.parse({ kind: 'b', y: 'hi' }).kind).toBe('b');
  expect(schema.safeParse({ kind: 'c' }).success).toBeFalse();
});

test('Union: with validators — email OR url', () => {
  const schema = z.union([z.string().email(), z.string().url()]);
  expect(schema.safeParse('user@example.com').success).toBeTrue();
  expect(schema.safeParse('https://example.com').success).toBeTrue();
  expect(schema.safeParse('just a string').success).toBeFalse();
});

test('Union: nullable shorthand', () => {
  const schema = z.string().nullable();
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(null)).toBe(null);
  expect(schema.safeParse(undefined).success).toBeFalse();
});

test('Union: optional shorthand', () => {
  const schema = z.string().optional();
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(undefined)).toBe(undefined);
  expect(schema.safeParse(null).success).toBeFalse();
});

test('Union: nullish', () => {
  const schema = z.number().nullish();
  expect(schema.parse(42)).toBe(42);
  expect(schema.parse(null)).toBe(null);
  expect(schema.parse(undefined)).toBe(undefined);
  expect(schema.safeParse('x').success).toBeFalse();
});

test('Union: nested in object', () => {
  const schema = z.object({
    value: z.union([z.string().email(), z.number().int().positive()]),
  });
  expect(schema.safeParse({ value: 'a@b.com' }).success).toBeTrue();
  expect(schema.safeParse({ value: 5 }).success).toBeTrue();
  expect(schema.safeParse({ value: 'not-email' }).success).toBeFalse();
  expect(schema.safeParse({ value: -1 }).success).toBeFalse();
});

test('Union: in array', () => {
  const schema = z.array(z.union([z.string(), z.number()]));
  expect(schema.parse(['a', 1, 'b', 2]).length).toBe(4);
  expect(schema.safeParse(['a', true]).success).toBeFalse();
});

test('Union: or() chaining', () => {
  const schema = z.string().or(z.number()).or(z.boolean());
  expect(schema.parse('x')).toBe('x');
  expect(schema.parse(1)).toBe(1);
  expect(schema.parse(true)).toBe(true);
  expect(schema.safeParse(null).success).toBeFalse();
});

test('Union: with transform on branch', () => {
  const schema = z.union([
    z.string().transform(s => ({ type: 'str' as const, val: s })),
    z.number().transform(n => ({ type: 'num' as const, val: n })),
  ]);
  expect(schema.parse('hi').type).toBe('str');
  expect(schema.parse(42).type).toBe('num');
});

test('Union: catch fallback', () => {
  const schema = z.union([z.string(), z.number()]).catch('default');
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.parse(42)).toBe(42);
  expect(schema.parse(true)).toBe('default');
});

// ============================================================================
// 7. DISCRIMINATED UNION — comprehensive coverage
// ============================================================================

test('Discriminated union: basic 2 variants', () => {
  const schema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('circle'), radius: z.number() }),
    z.object({ type: z.literal('square'), side: z.number() }),
  ]);
  expect(schema.parse({ type: 'circle', radius: 5 }).radius).toBe(5);
  expect(schema.parse({ type: 'square', side: 4 }).side).toBe(4);
  expect(schema.safeParse({ type: 'triangle', side: 3 }).success).toBeFalse();
  expect(schema.safeParse({ radius: 5 }).success).toBeFalse();
});

test('Discriminated union: 4 variants with validators', () => {
  const schema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('active'),   email: z.string().email() }),
    z.object({ status: z.literal('pending'),  url: z.string().url() }),
    z.object({ status: z.literal('inactive'), reason: z.string().min(1) }),
    z.object({ status: z.literal('banned'),   since: z.string().date() }),
  ]);
  expect(schema.safeParse({ status: 'active', email: 'x@y.com' }).success).toBeTrue();
  expect(schema.safeParse({ status: 'active', email: 'bad' }).success).toBeFalse();
  expect(schema.safeParse({ status: 'pending', url: 'https://ok.com' }).success).toBeTrue();
  expect(schema.safeParse({ status: 'pending', url: 'not-a-url' }).success).toBeFalse();
  expect(schema.safeParse({ status: 'inactive', reason: 'left' }).success).toBeTrue();
  expect(schema.safeParse({ status: 'inactive', reason: '' }).success).toBeFalse();
  expect(schema.safeParse({ status: 'banned', since: '2024-01-01' }).success).toBeTrue();
  expect(schema.safeParse({ status: 'unknown' }).success).toBeFalse();
});

test('Discriminated union: integer discriminator', () => {
  const schema = z.discriminatedUnion('code', [
    z.object({ code: z.literal(200), body: z.string() }),
    z.object({ code: z.literal(404), message: z.string() }),
    z.object({ code: z.literal(500), error: z.string() }),
  ]);
  expect(schema.parse({ code: 200, body: 'ok' }).body).toBe('ok');
  expect(schema.parse({ code: 404, message: 'not found' }).message).toBe('not found');
  expect(schema.safeParse({ code: 301, message: 'redirect' }).success).toBeFalse();
});

test('Discriminated union: in array (polymorphic list)', () => {
  const Event = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('click'), x: z.number(), y: z.number() }),
    z.object({ kind: z.literal('key'),   key: z.string() }),
    z.object({ kind: z.literal('scroll'), delta: z.number() }),
  ]);
  const schema = z.array(Event);
  const events = [
    { kind: 'click', x: 10, y: 20 },
    { kind: 'key', key: 'Enter' },
    { kind: 'scroll', delta: -3 },
  ];
  const result = schema.parse(events);
  expect(result.length).toBe(3);
  expect(result[0].kind).toBe('click');
  expect(result[1].kind).toBe('key');
  expect(schema.safeParse([{ kind: 'unknown', foo: 1 }]).success).toBeFalse();
});

test('Discriminated union: nested inside object', () => {
  const Payload = z.discriminatedUnion('op', [
    z.object({ op: z.literal('insert'), doc: z.object({ id: z.number(), name: z.string() }) }),
    z.object({ op: z.literal('delete'), id: z.number() }),
  ]);
  const schema = z.object({ requestId: z.string().uuid(), payload: Payload });
  expect(schema.safeParse({
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    payload: { op: 'insert', doc: { id: 1, name: 'test' } },
  }).success).toBeTrue();
  expect(schema.safeParse({
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    payload: { op: 'insert', doc: { id: 'not-number', name: 'test' } },
  }).success).toBeFalse();
});

// ============================================================================
// 8. INTERSECTION
// ============================================================================

test('Intersection: two objects', () => {
  const schema = z.intersection(z.object({ name: z.string() }), z.object({ age: z.number() }));
  const result = schema.parse({ name: 'Alice', age: 30 });
  expect(result.name).toBe('Alice');
  expect(result.age).toBe(30);
});

test('Intersection: and() shorthand', () => {
  const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
  const result = schema.parse({ a: 'hello', b: 42 });
  expect(result.a).toBe('hello');
  expect(result.b).toBe(42);
});

// ============================================================================
// 9. MODIFIERS
// ============================================================================

test('Optional', () => {
  const schema = z.string().optional();
  expect(schema.parse(undefined)).toBe(undefined);
  expect(schema.parse('hello')).toBe('hello');
  expect(schema.safeParse(42).success).toBeFalse();
});

test('Nullable', () => {
  const schema = z.string().nullable();
  expect(schema.parse(null)).toBe(null);
  expect(schema.parse('hello')).toBe('hello');
});

test('Default', () => {
  expect(z.string().default('fallback').parse(undefined)).toBe('fallback');
  expect(z.string().default('fallback').parse('custom')).toBe('custom');
});

test('Catch', () => {
  expect(z.number().catch(0).parse('not a number')).toBe(0);
  expect(z.number().catch(0).parse(42)).toBe(42);
});

test('Transform', () => {
  expect(z.string().transform(s => s.length).parse('hello')).toBe(5);
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

test('Readonly', () => {
  const schema = z.object({ name: z.string() }).readonly();
  const result = schema.parse({ name: 'Alice' });
  expect(result.name).toBe('Alice');
  expect(Object.isFrozen(result)).toBeTrue();
});

// ============================================================================
// 10. COERCION
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
// 11. ZOD 4 FEATURES
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
    z.object({ name: z.string(), children: z.array(categorySchema) })
  );
  const result = categorySchema.parse({ name: 'root', children: [{ name: 'child', children: [] }] });
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

test('instanceof', () => {
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
// 12. ERROR HANDLING
// ============================================================================

test('ZodError: format()', () => {
  const result = z.object({ name: z.string(), age: z.number() }).safeParse({ name: 42, age: 'bad' });
  if (!result.success) {
    const formatted = result.error.format();
    expect(typeof formatted).toBe('object');
    expect(Array.isArray(formatted._errors)).toBeTrue();
  }
});

test('ZodError: flatten()', () => {
  const result = z.object({ name: z.string(), age: z.number() }).safeParse({ name: 42, age: 'bad' });
  if (!result.success) {
    const flat = result.error.flatten();
    expect(typeof flat.fieldErrors).toBe('object');
    expect(Array.isArray(flat.formErrors)).toBeTrue();
  }
});

test('Error is instance of ZodError', () => {
  const result = z.string().safeParse(42);
  if (!result.success) {
    expect(result.error instanceof ZodError).toBeTrue();
    expect(result.error.name).toBe('ZodError');
  }
});

test('Parse throws ZodError', () => {
  let caught = false;
  try { z.string().parse(42); }
  catch (e) { caught = e instanceof ZodError; }
  expect(caught).toBeTrue();
});

// ============================================================================
// 13. MISC
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
  expect(schema.parse(['a', 'b', 'c']).length).toBe(3);
});

// ============================================================================
// 14. NATIVE VALIDATOR SMOKE TESTS (N-API specific)
// ============================================================================

test('Native: unicode strings through N-API', () => {
  expect(z.string().min(1).safeParse('héllo').success).toBeTrue();
  expect(z.string().min(1).safeParse('日本語').success).toBeTrue();
  expect(z.string().includes('ñ').safeParse('mañana').success).toBeTrue();
});

test('Native: long strings through N-API', () => {
  const long = 'a'.repeat(3000);
  expect(z.string().min(1).safeParse(long).success).toBeTrue();
  expect(z.string().max(100).safeParse(long).success).toBeFalse();
  expect(z.string().includes('aaa').safeParse(long).success).toBeTrue();
});

test('Native: all string format validators in one object', () => {
  const schema = z.object({
    email: z.string().email(),
    url: z.string().url(),
    uuid: z.string().uuid(),
    ip: z.string().ipv4(),
    b64: z.string().base64(),
    date: z.string().date(),
    datetime: z.string().datetime(),
  });
  const valid = {
    email: 'user@example.com',
    url: 'https://example.com',
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    ip: '192.168.1.1',
    b64: 'SGVsbG8=',
    date: '2024-01-15',
    datetime: '2024-01-15T10:30:00Z',
  };
  expect(schema.safeParse(valid).success).toBeTrue();
  expect(schema.safeParse({ ...valid, email: 'bad' }).success).toBeFalse();
  expect(schema.safeParse({ ...valid, url: 'bad' }).success).toBeFalse();
  expect(schema.safeParse({ ...valid, ip: '999.0.0.0' }).success).toBeFalse();
});

test('Native: number constraint edge cases', () => {
  expect(z.number().min(0).safeParse(0).success).toBeTrue();
  expect(z.number().max(0).safeParse(0).success).toBeTrue();
  expect(z.number().gt(0).safeParse(0).success).toBeFalse();
  expect(z.number().lt(0).safeParse(0).success).toBeFalse();
  expect(z.number().multipleOf(3).safeParse(9).success).toBeTrue();
  expect(z.number().multipleOf(3).safeParse(10).success).toBeFalse();
  expect(z.number().multipleOf(3).safeParse(0).success).toBeTrue();
});

test('Native: union resolving with N-API format validators', () => {
  const schema = z.union([
    z.string().email(),
    z.string().url(),
    z.string().uuid(),
    z.string().ipv4(),
  ]);
  expect(schema.safeParse('user@example.com').success).toBeTrue();
  expect(schema.safeParse('https://example.com').success).toBeTrue();
  expect(schema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBeTrue();
  expect(schema.safeParse('10.0.0.1').success).toBeTrue();
  expect(schema.safeParse('just a plain string').success).toBeFalse();
});

// ============================================================================
// RESULTS
// ============================================================================

console.log(`\n${'='.repeat(62)}`);
console.log(`  dhi N-API Compatibility Test Results`);
console.log(`${'='.repeat(62)}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log(`${'='.repeat(62)}\n`);

if (failed > 0) process.exit(1);
