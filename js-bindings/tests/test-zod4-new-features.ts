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
  expect(z.file().mime('text/plain').safeParse(txtFile).success).toBe(true);
  expect(z.file().mime('text/plain').safeParse(pngFile).success).toBe(false);
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

test('z.success() always succeeds', () => {
  const schema = z.success(z.string());
  expect(schema.safeParse('hello').success).toBe(true);
  expect(schema.safeParse(123).success).toBe(true); // Should still succeed
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

// Summary
console.log('\n============================================================');
console.log(`  Test Results: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
}
