/**
 * Tests for new Zod 4 features added to dhi
 */

import { z } from '../schema.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function expect<T>(val: T) {
  return {
    toBe: (expected: T) => {
      if (val !== expected) throw new Error(`Expected ${expected}, got ${val}`);
    },
    toEqual: (expected: T) => {
      if (JSON.stringify(val) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
      }
    },
    toThrow: () => {
      throw new Error('Expected function to throw');
    },
  };
}

console.log('============================================================');
console.log('  dhi Zod 4 New Features Test');
console.log('============================================================\n');

// Top-level string format shortcuts
console.log('📝 Top-Level String Format Shortcuts');
console.log('------------------------------------------------------------');

test('z.email()', () => {
  expect(z.email().safeParse('test@example.com').success).toBe(true);
  expect(z.email().safeParse('invalid').success).toBe(false);
});

test('z.uuid()', () => {
  expect(z.uuid().safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  expect(z.uuid().safeParse('not-a-uuid').success).toBe(false);
});

test('z.url()', () => {
  expect(z.url().safeParse('https://example.com').success).toBe(true);
  expect(z.url().safeParse('not-a-url').success).toBe(false);
});

test('z.ipv4()', () => {
  expect(z.ipv4().safeParse('192.168.1.1').success).toBe(true);
  expect(z.ipv4().safeParse('999.999.999.999').success).toBe(false);
});

test('z.jwt()', () => {
  expect(z.jwt().safeParse('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature').success).toBe(true);
  expect(z.jwt().safeParse('not-a-jwt').success).toBe(false);
});

test('z.base64()', () => {
  expect(z.base64().safeParse('SGVsbG8gV29ybGQ=').success).toBe(true);
  expect(z.base64().safeParse('not@valid!').success).toBe(false);
});

test('z.nanoid()', () => {
  expect(z.nanoid().safeParse('V1StGXR8_Z5jdHi6B-myT').success).toBe(true);
  expect(z.nanoid().safeParse('too-short').success).toBe(false);
});

test('z.ulid()', () => {
  expect(z.ulid().safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV').success).toBe(true);
  expect(z.ulid().safeParse('invalid').success).toBe(false);
});

test('z.cuid()', () => {
  expect(z.cuid().safeParse('clh3ppdjk0000qwerty').success).toBe(true);
  expect(z.cuid().safeParse('invalid').success).toBe(false);
});

test('z.cuid2()', () => {
  expect(z.cuid2().safeParse('abc123def456').success).toBe(true);
  expect(z.cuid2().safeParse('').success).toBe(false);
});

test('z.e164()', () => {
  expect(z.e164().safeParse('+14155552671').success).toBe(true);
  expect(z.e164().safeParse('1234567890').success).toBe(false);
});

test('z.mac()', () => {
  expect(z.mac().safeParse('00:1B:44:11:3A:B7').success).toBe(true);
  expect(z.mac().safeParse('not-a-mac').success).toBe(false);
});

test('z.cidrv4()', () => {
  expect(z.cidrv4().safeParse('192.168.0.0/24').success).toBe(true);
  expect(z.cidrv4().safeParse('192.168.0.0').success).toBe(false);
});

test('z.hex()', () => {
  expect(z.hex().safeParse('deadbeef').success).toBe(true);
  expect(z.hex().safeParse('ghijkl').success).toBe(false);
});

test('z.hash("sha256")', () => {
  expect(z.hash('sha256').safeParse('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').success).toBe(true);
  expect(z.hash('sha256').safeParse('tooshort').success).toBe(false);
});

test('z.hash("md5")', () => {
  expect(z.hash('md5').safeParse('d41d8cd98f00b204e9800998ecf8427e').success).toBe(true);
  expect(z.hash('md5').safeParse('tooshort').success).toBe(false);
});

// ISO namespace
console.log('\n📅 ISO Namespace');
console.log('------------------------------------------------------------');

test('z.iso.datetime()', () => {
  expect(z.iso.datetime().safeParse('2024-01-15T10:30:00Z').success).toBe(true);
});

test('z.iso.date()', () => {
  expect(z.iso.date().safeParse('2024-01-15').success).toBe(true);
  expect(z.iso.date().safeParse('not-a-date').success).toBe(false);
});

test('z.iso.time()', () => {
  expect(z.iso.time().safeParse('10:30:00').success).toBe(true);
  expect(z.iso.time().safeParse('25:00:00').success).toBe(false);
});

test('z.iso.duration()', () => {
  expect(z.iso.duration().safeParse('P1Y2M3D').success).toBe(true);
  expect(z.iso.duration().safeParse('invalid').success).toBe(false);
});

// Number format shortcuts
console.log('\n🔢 Number Format Shortcuts');
console.log('------------------------------------------------------------');

test('z.int()', () => {
  expect(z.int().safeParse(42).success).toBe(true);
  expect(z.int().safeParse(3.14).success).toBe(false);
});

test('z.float()', () => {
  expect(z.float().safeParse(3.14).success).toBe(true);
  expect(z.float().safeParse(Infinity).success).toBe(false);
});

test('z.int8()', () => {
  expect(z.int8().safeParse(127).success).toBe(true);
  expect(z.int8().safeParse(128).success).toBe(false);
  expect(z.int8().safeParse(-128).success).toBe(true);
  expect(z.int8().safeParse(-129).success).toBe(false);
});

test('z.uint8()', () => {
  expect(z.uint8().safeParse(255).success).toBe(true);
  expect(z.uint8().safeParse(256).success).toBe(false);
  expect(z.uint8().safeParse(-1).success).toBe(false);
});

test('z.int16()', () => {
  expect(z.int16().safeParse(32767).success).toBe(true);
  expect(z.int16().safeParse(32768).success).toBe(false);
});

test('z.uint16()', () => {
  expect(z.uint16().safeParse(65535).success).toBe(true);
  expect(z.uint16().safeParse(65536).success).toBe(false);
});

test('z.int32()', () => {
  expect(z.int32().safeParse(2147483647).success).toBe(true);
  expect(z.int32().safeParse(2147483648).success).toBe(false);
});

test('z.uint32()', () => {
  expect(z.uint32().safeParse(4294967295).success).toBe(true);
  expect(z.uint32().safeParse(4294967296).success).toBe(false);
});

test('z.int64()', () => {
  expect(z.int64().safeParse(9223372036854775807n).success).toBe(true);
});

test('z.uint64()', () => {
  expect(z.uint64().safeParse(18446744073709551615n).success).toBe(true);
  expect(z.uint64().safeParse(-1n).success).toBe(false);
});

// File schema
console.log('\n📁 File Schema');
console.log('------------------------------------------------------------');

test('z.file() basic', () => {
  const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
  expect(z.file().safeParse(file).success).toBe(true);
  expect(z.file().safeParse('not-a-file').success).toBe(false);
});

test('z.file().mime()', () => {
  const txtFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
  const pngFile = new File([''], 'test.png', { type: 'image/png' });
  // Zod compares `File.type` exactly; some runtimes append a charset parameter
  // to the type given to `new File(...)`, so match against the actual value.
  expect(z.file().mime(txtFile.type).safeParse(txtFile).success).toBe(true);
  expect(z.file().mime(txtFile.type).safeParse(pngFile).success).toBe(false);
  expect(z.file().mime([txtFile.type, pngFile.type]).safeParse(pngFile).success).toBe(true);
});

test('z.file().min().max()', () => {
  const smallFile = new File(['hi'], 'small.txt');
  const largeFile = new File(['a'.repeat(1000)], 'large.txt');
  expect(z.file().min(1).max(100).safeParse(smallFile).success).toBe(true);
  expect(z.file().min(1).max(100).safeParse(largeFile).success).toBe(false);
});

// Template literal
console.log('\n📜 Template Literal');
console.log('------------------------------------------------------------');

test('z.templateLiteral() with strings', () => {
  const schema = z.templateLiteral(['hello-', 'world']);
  expect(schema.safeParse('hello-world').success).toBe(true);
  expect(schema.safeParse('hello-other').success).toBe(false);
});

test('z.templateLiteral() with number', () => {
  const schema = z.templateLiteral(['user-', z.number()]);
  expect(schema.safeParse('user-123').success).toBe(true);
  expect(schema.safeParse('user-abc').success).toBe(false);
});

test('z.templateLiteral() with enum', () => {
  const schema = z.templateLiteral([z.enum(['px', 'em', 'rem'])]);
  expect(schema.safeParse('px').success).toBe(true);
  expect(schema.safeParse('em').success).toBe(true);
  expect(schema.safeParse('invalid').success).toBe(false);
});

// JSON schema
console.log('\n🔄 JSON Schema');
console.log('------------------------------------------------------------');

test('z.json() with primitives', () => {
  expect(z.json().safeParse('hello').success).toBe(true);
  expect(z.json().safeParse(42).success).toBe(true);
  expect(z.json().safeParse(true).success).toBe(true);
  expect(z.json().safeParse(null).success).toBe(true);
});

test('z.json() with arrays', () => {
  expect(z.json().safeParse([1, 2, 3]).success).toBe(true);
  expect(z.json().safeParse(['a', 'b', 'c']).success).toBe(true);
});

test('z.json() with objects', () => {
  expect(z.json().safeParse({ a: 1, b: 'hello' }).success).toBe(true);
  expect(z.json().safeParse({ nested: { deep: true } }).success).toBe(true);
});

// Success wrapper
console.log('\n✅ Success Wrapper');
console.log('------------------------------------------------------------');

test('z.success() (Zod 4 semantics: true when the inner schema passes)', () => {
  const schema = z.success(z.string());
  expect(schema.safeParse('hello').success).toBe(true);
  expect(schema.parse('hello')).toBe(true);
  // Zod 4 propagates the inner schema's issues, so a failing inner schema fails the parse
  expect(schema.safeParse(123).success).toBe(false);
});

// StringBool
console.log('\n🔘 StringBool');
console.log('------------------------------------------------------------');

test('z.stringbool() with truthy values', () => {
  expect(z.stringbool().safeParse('true').success).toBe(true);
  expect(z.stringbool().parse('true')).toBe(true);
  expect(z.stringbool().parse('yes')).toBe(true);
  expect(z.stringbool().parse('1')).toBe(true);
  expect(z.stringbool().parse('on')).toBe(true);
});

test('z.stringbool() with falsy values', () => {
  expect(z.stringbool().parse('false')).toBe(false);
  expect(z.stringbool().parse('no')).toBe(false);
  expect(z.stringbool().parse('0')).toBe(false);
  expect(z.stringbool().parse('off')).toBe(false);
});

// Object methods
console.log('\n📦 Object Methods');
console.log('------------------------------------------------------------');

test('object.keyof()', () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const keySchema = schema.keyof();
  expect(keySchema.safeParse('name').success).toBe(true);
  expect(keySchema.safeParse('age').success).toBe(true);
  expect(keySchema.safeParse('invalid').success).toBe(false);
});

test('object.valueof()', () => {
  const schema = z.object({ name: z.string(), count: z.number() });
  const valueSchema = schema.valueof();
  expect(valueSchema.safeParse('hello').success).toBe(true);
  expect(valueSchema.safeParse(42).success).toBe(true);
});

test('object.entryof()', () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const entrySchema = schema.entryof();
  expect(entrySchema.safeParse(['name', 'John']).success).toBe(true);
  expect(entrySchema.safeParse(['age', 30]).success).toBe(true);
});

// Registry
console.log('\n📋 Registry System');
console.log('------------------------------------------------------------');

test('z.registry() basic operations', () => {
  const registry = z.registry<{ title: string; version: number }>();
  const schema = z.string();
  registry.add(schema, { title: 'Name', version: 1 });
  expect(registry.has(schema)).toBe(true);
  const meta = registry.get(schema);
  expect(meta?.title).toBe('Name');
  expect(meta?.version).toBe(1);
});

test('z.globalRegistry', () => {
  const schema = z.string();
  z.globalRegistry.add(schema, { id: 'test-schema', title: 'Test' });
  expect(z.globalRegistry.has(schema)).toBe(true);
  expect(z.globalRegistry.get(schema)?.id).toBe('test-schema');
});

// Hostname validation
console.log('\n🌐 Network Validators');
console.log('------------------------------------------------------------');

test('z.hostname()', () => {
  expect(z.hostname().safeParse('example.com').success).toBe(true);
  expect(z.hostname().safeParse('sub.example.com').success).toBe(true);
  expect(z.hostname().safeParse('localhost').success).toBe(true);
  expect(z.hostname().safeParse('-invalid.com').success).toBe(false);
});

// ============================================================================
// Zod 4 API surface (1.7.0)
// ============================================================================
console.log('\n🧩 Error helpers');
console.log('------------------------------------------------------------');

const failing = z.object({ a: z.object({ b: z.string() }), arr: z.array(z.number()) })
  .safeParse({ a: { b: 1 }, arr: ['x', 2] });
const err = (failing as { success: false; error: any }).error;

test('ZodError is an Error with issues, name and stack', () => {
  expect(err instanceof Error).toBe(true);
  expect(err.name).toBe('ZodError');
  expect(Array.isArray(err.issues)).toBe(true);
  expect(typeof err.stack).toBe('string');
  expect(err.isEmpty).toBe(false);
  expect(JSON.parse(err.message).length).toBe(2);
});

test('z.treeifyError()', () => {
  const tree = z.treeifyError(err) as any;
  expect(tree.properties.a.properties.b.errors.length).toBe(1);
  expect(tree.properties.arr.items[0].errors.length).toBe(1);
});

test('z.flattenError() / error.flatten()', () => {
  const flat = z.flattenError(err);
  expect(Object.keys(flat.fieldErrors).sort().join(',')).toBe('a,arr');
  expect(flat.formErrors.length).toBe(0);
  expect(JSON.stringify(err.flatten())).toBe(JSON.stringify(flat));
});

test('z.formatError() / error.format()', () => {
  const formatted = z.formatError(err) as any;
  expect(formatted.a.b._errors.length).toBe(1);
  expect(JSON.stringify(err.format())).toBe(JSON.stringify(formatted));
});

test('z.prettifyError() uses Zod 4 layout', () => {
  const lines = z.prettifyError(err).split('\n');
  expect(lines[0].startsWith('✖ ')).toBe(true);
  expect(lines[1]).toBe('  → at a.b');
  expect(lines[3]).toBe('  → at arr[0]');
});

test('mappers are honoured', () => {
  expect(z.flattenError(err, () => 'X').fieldErrors.a[0]).toBe('X');
  expect((z.treeifyError(err, () => 'Y') as any).properties.a.properties.b.errors[0]).toBe('Y');
});

console.log('\n🔁 Codecs');
console.log('------------------------------------------------------------');

const StringToNumber = z.codec(z.string(), z.number(), {
  decode: (s) => Number(s),
  encode: (n) => String(n),
});

test('z.codec() decodes and encodes', () => {
  expect(StringToNumber.parse('42')).toBe(42);
  expect(StringToNumber.decode('7')).toBe(7);
  expect(StringToNumber.encode(7)).toBe('7');
  expect(z.decode(StringToNumber, '3')).toBe(3);
  expect(z.encode(StringToNumber, 3)).toBe('3');
});

test('safeDecode / safeEncode', () => {
  expect(z.safeDecode(StringToNumber, 'x').success).toBe(false);
  expect(z.safeEncode(StringToNumber, 'x').success).toBe(false);
  expect(z.safeEncode(StringToNumber, 5).success).toBe(true);
});

test('codecs compose through containers', () => {
  const Wrapped = z.object({ n: StringToNumber, list: z.array(StringToNumber) });
  expect(JSON.stringify(Wrapped.parse({ n: '1', list: ['2', '3'] }))).toBe(JSON.stringify({ n: 1, list: [2, 3] }));
  expect(JSON.stringify(Wrapped.encode({ n: 1, list: [2, 3] }))).toBe(JSON.stringify({ n: '1', list: ['2', '3'] }));
});

test('encoding through a one-way transform throws', () => {
  let threw = false;
  try {
    z.encode(z.string().transform((s) => s.length), 3);
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});

console.log('\n⚙️  Top-level API');
console.log('------------------------------------------------------------');

test('functional parse helpers', () => {
  expect(z.parse(z.string(), 'a')).toBe('a');
  expect(z.safeParse(z.string(), 1).success).toBe(false);
});

test('top-level wrappers', () => {
  expect(z.nullish(z.string()).safeParse(null).success).toBe(true);
  expect(z.nonoptional(z.string().optional()).safeParse(undefined).success).toBe(false);
  expect(z.readonly(z.string()).parse('a')).toBe('a');
  expect(z.exactOptional(z.string()).safeParse('a').success).toBe(true);
  expect(z.keyof(z.object({ a: z.string(), b: z.number() })).options.join(',')).toBe('a,b');
  expect(z.catch(z.number(), 0).parse('x')).toBe(0);
  expect(z.default(z.string(), 'd').parse(undefined)).toBe('d');
  expect(z.prefault(z.string().min(2), 'ab').parse(undefined)).toBe('ab');
  expect(z.clone(z.string()).parse('a')).toBe('a');
});

test('z.xor() requires exactly one match', () => {
  expect(z.xor([z.string(), z.number()]).safeParse('a').success).toBe(true);
  expect(z.xor([z.string(), z.string().min(1)]).safeParse('a').success).toBe(false);
});

test('z.stringFormat() and z.slugify()', () => {
  const Hexish = z.stringFormat('hexish', /^[0-9a-f]+$/);
  expect(Hexish.safeParse('0f').success).toBe(true);
  expect(Hexish.safeParse('zz').error!.issues[0].code).toBe('invalid_format');
  expect(z.string().slugify().parse('  Hello World! ')).toBe('hello-world');
  expect(z.string().check(z.slugify()).parse('A B')).toBe('a-b');
});

test('constants and namespaces', () => {
  expect(typeof z.NEVER).toBe('object');
  expect(z.TimePrecision.Millisecond).toBe(3);
  expect(z.ZodIssueCode.invalid_format).toBe('invalid_format');
  expect(typeof z.$brand).toBe('symbol');
  expect(z.util.slugify('A B')).toBe('a-b');
  expect(z.util.toDotPath(['a', 0, 'b'])).toBe('a[0].b');
  expect(z.regexes.cuid instanceof RegExp).toBe(true);
  expect(typeof z.core.toJSONSchema).toBe('function');
  expect(z.core.NEVER).toBe(z.NEVER);
});

test('z.config() / get+setErrorMap / locales', () => {
  const cfg = z.config();
  expect(typeof cfg).toBe('object');
  const map = () => undefined;
  z.setErrorMap(map);
  expect(z.getErrorMap()).toBe(map);
  z.config({ customError: undefined });
  expect(typeof z.locales.en).toBe('function');
});

test('runtime Zod* class aliases', () => {
  expect(z.string() instanceof z.ZodString).toBe(true);
  expect(z.object({}) instanceof z.ZodObject).toBe(true);
  expect(z.array(z.string()) instanceof z.ZodArray).toBe(true);
  expect(StringToNumber instanceof z.ZodCodec).toBe(true);
  expect(z.string().optional() instanceof z.ZodOptional).toBe(true);
  expect(z.string() instanceof z.ZodType).toBe(true);
  expect(z.ZodRealError).toBe(z.ZodError);
});

console.log('\n🔍 Schema introspection');
console.log('------------------------------------------------------------');

test('.type / .apply / .with / .spa', () => {
  expect(z.string().type).toBe('string');
  expect(z.object({}).type).toBe('object');
  expect(z.string().apply((s) => s.type)).toBe('string');
  expect(z.string().with(z.minLength(3)).safeParse('ab').success).toBe(false);
});

test('number / bigint / date accessors', () => {
  expect(z.number().min(3).minValue).toBe(3);
  expect(z.number().max(9).maxValue).toBe(9);
  expect(z.number().int().isInt).toBe(true);
  expect(z.number().isFinite).toBe(true);
  expect(z.number().int().format).toBe('safeint');
  expect(z.bigint().min(1n).minValue).toBe(1n);
  expect(z.date().min(new Date(0)).minDate!.getTime()).toBe(0);
});

test('container accessors', () => {
  expect(z.array(z.string()).element.type).toBe('string');
  expect(z.array(z.string()).unwrap().type).toBe('string');
  expect([...z.literal(['a', 'b']).values].join(',')).toBe('a,b');
  expect(z.record(z.string(), z.number()).keyType.type).toBe('string');
  expect(z.record(z.string(), z.number()).valueType.type).toBe('number');
  expect(z.map(z.string(), z.number()).valueType.type).toBe('number');
  expect(z.string().email().format).toBe('email');
  expect(z.string().format).toBe(null);
});

test('object.safeExtend()', () => {
  const Base = z.object({ a: z.string() });
  expect(Object.keys(Base.safeExtend({ b: z.number() }).shape).join(',')).toBe('a,b');
  let threw = false;
  try {
    (Base as any).safeExtend('nope');
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});

console.log('\n🗂  JSON Schema');
console.log('------------------------------------------------------------');

test('z.toJSONSchema() emits Zod\'s document shape', () => {
  const out = z.toJSONSchema(z.object({ a: z.string() }));
  expect(out.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(out.additionalProperties).toBe(false);
  expect(z.toJSONSchema(z.looseObject({ a: z.string() })).additionalProperties!.constructor).toBe(Object);
  expect(z.toJSONSchema(z.string(), { target: 'draft-7' }).$schema).toBe('http://json-schema.org/draft-07/schema#');
  expect(z.toJSONSchema(z.string(), { target: 'openapi-3.0' }).$schema).toBe(undefined);
  expect(z.string().toJSONSchema().type).toBe('string');
});

test('toJSONSchema metadata, override and unrepresentable', () => {
  expect(z.toJSONSchema(z.object({ a: z.string().meta({ title: 'A' }) })).properties.a.title).toBe('A');
  const registry = z.registry<{ title: string }>();
  const inner = z.string();
  registry.add(inner, { title: 'R' });
  expect(z.toJSONSchema(z.object({ a: inner }), { metadata: registry }).properties.a.title).toBe('R');
  expect(z.toJSONSchema(z.string(), { override: (ctx) => { ctx.jsonSchema.foo = 1; } }).foo).toBe(1);
  let threw = false;
  try {
    z.toJSONSchema(z.bigint(), { unrepresentable: 'throw' });
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
  expect(JSON.stringify(z.toJSONSchema(z.bigint()))).toBe('{"$schema":"https://json-schema.org/draft/2020-12/schema"}');
});

test('.meta() round-trips through the global registry', () => {
  const schema = z.string().meta({ title: 'T', examples: ['a'] });
  expect(z.globalRegistry.get(schema)?.title).toBe('T');
  expect(schema.meta()?.title).toBe('T');
  expect(z.string().describe('d').description).toBe('d');
  expect(z.string().check(z.describe('via check')).description).toBe('via check');
  expect(z.string().check(z.meta({ title: 'M' })).meta()?.title).toBe('M');
});

console.log('\n⏳ Async');
console.log('------------------------------------------------------------');

const asyncTests: Array<[string, () => Promise<void>]> = [];
const atest = (name: string, fn: () => Promise<void>) => asyncTests.push([name, fn]);

atest('parseAsync awaits async refinements', async () => {
  const schema = z.string().refine(async (s) => s.length > 2);
  expect((await schema.safeParseAsync('abc')).success).toBe(true);
  expect((await schema.safeParseAsync('a')).success).toBe(false);
});

atest('async refinements nested in containers', async () => {
  const schema = z.object({ list: z.array(z.string().refine(async (s) => s.length > 1)) });
  expect((await schema.safeParseAsync({ list: ['ab', 'cd'] })).success).toBe(true);
  expect((await schema.safeParseAsync({ list: ['ab', 'c'] })).success).toBe(false);
});

atest('async transforms and pipes', async () => {
  const schema = z.string().transform(async (s) => s.length).pipe(z.number().min(2));
  expect(await schema.parseAsync('abc')).toBe(3);
  expect((await schema.safeParseAsync('a')).success).toBe(false);
});

atest('sync parse refuses an async refinement', async () => {
  let threw = false;
  try {
    z.string().refine(async () => true).parse('a');
  } catch (e: any) {
    threw = e.name === 'ZodAsyncError';
  }
  expect(threw).toBe(true);
});

atest('spa is safeParseAsync', async () => {
  expect((await z.string().spa('a')).success).toBe(true);
});

atest('encodeAsync / decodeAsync', async () => {
  expect(await StringToNumber.decodeAsync('9')).toBe(9);
  expect(await StringToNumber.encodeAsync(9)).toBe('9');
  expect((await z.safeEncodeAsync(StringToNumber, 'x')).success).toBe(false);
});

atest('z.function().implementAsync()', async () => {
  const fn = z.function({ input: [z.number()], output: z.number() }).implementAsync(async (n: number) => n + 1);
  expect(await fn(1)).toBe(2);
});

for (const [name, fn] of asyncTests) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

// Summary
console.log('\n============================================================');
console.log(`  Test Results: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
}
