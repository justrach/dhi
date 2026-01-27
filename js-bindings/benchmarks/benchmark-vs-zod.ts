/**
 * Head-to-head: dhi v0.6.0 (SIMD WASM) vs Zod 4.3.6
 */
import { z as dhi } from '../schema';
import { z as zod } from 'zod';

function bench(fn: () => void, iterations: number = 1_000_000): number {
  // Warmup
  for (let i = 0; i < 10000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  return (iterations / elapsed) * 1000;
}

function compare(name: string, dhiFn: () => void, zodFn: () => void, iterations = 1_000_000) {
  const dhiOps = bench(dhiFn, iterations);
  const zodOps = bench(zodFn, iterations);
  const speedup = dhiOps / zodOps;
  const dhiStr = (dhiOps / 1e6).toFixed(2);
  const zodStr = (zodOps / 1e6).toFixed(2);
  const speedupStr = speedup >= 1
    ? `${speedup.toFixed(1)}x faster`
    : `${(1/speedup).toFixed(1)}x slower`;
  console.log(`  ${name.padEnd(24)} dhi: ${dhiStr.padStart(7)}M   zod: ${zodStr.padStart(7)}M   ${speedupStr}`);
}

console.log('='.repeat(80));
console.log('  dhi v0.6.0 (SIMD WASM) vs Zod 4.3.6 — Head-to-Head Benchmark');
console.log('='.repeat(80));
console.log('');

// === String Validators ===
console.log('--- String Validators ---');

const dhiEmail = dhi.string().email();
const zodEmail = zod.string().email();
compare('Email (valid)',
  () => dhiEmail.safeParse('user+test@example.com'),
  () => zodEmail.safeParse('user+test@example.com'));
compare('Email (invalid)',
  () => dhiEmail.safeParse('not-an-email'),
  () => zodEmail.safeParse('not-an-email'));

const dhiUrl = dhi.string().url();
const zodUrl = zod.string().url();
compare('URL (valid)',
  () => dhiUrl.safeParse('https://www.example.com/path?q=v'),
  () => zodUrl.safeParse('https://www.example.com/path?q=v'));

const dhiUuid = dhi.string().uuid();
const zodUuid = zod.string().uuid();
compare('UUID (valid)',
  () => dhiUuid.safeParse('550e8400-e29b-41d4-a716-446655440000'),
  () => zodUuid.safeParse('550e8400-e29b-41d4-a716-446655440000'));

const dhiIp = dhi.string().ipv4();
const zodIp = zod.string().ipv4();
compare('IPv4 (valid)',
  () => dhiIp.safeParse('192.168.1.100'),
  () => zodIp.safeParse('192.168.1.100'));

const dhiBase64 = dhi.string().base64();
const zodBase64 = zod.string().base64();
compare('Base64 (valid)',
  () => dhiBase64.safeParse('SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0'),
  () => zodBase64.safeParse('SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0'));

const dhiDate = dhi.string().date();
const zodDate = zod.string().date();
compare('Date (valid)',
  () => dhiDate.safeParse('2024-06-15'),
  () => zodDate.safeParse('2024-06-15'));

const dhiIncludes = dhi.string().includes('needle');
const zodIncludes = zod.string().includes('needle');
const haystack = 'The quick brown fox jumps over the lazy dog and finds the needle in the haystack';
compare('Includes (substr)',
  () => dhiIncludes.safeParse(haystack),
  () => zodIncludes.safeParse(haystack));

const dhiStarts = dhi.string().startsWith('http');
const zodStarts = zod.string().startsWith('http');
compare('StartsWith',
  () => dhiStarts.safeParse('https://example.com/api'),
  () => zodStarts.safeParse('https://example.com/api'));

const dhiEnds = dhi.string().endsWith('.com');
const zodEnds = zod.string().endsWith('.com');
compare('EndsWith',
  () => dhiEnds.safeParse('www.example.com'),
  () => zodEnds.safeParse('www.example.com'));

const dhiMinMax = dhi.string().min(3).max(50);
const zodMinMax = zod.string().min(3).max(50);
compare('Min/Max length',
  () => dhiMinMax.safeParse('hello world'),
  () => zodMinMax.safeParse('hello world'));

console.log('');

// === Number Validators ===
console.log('--- Number Validators ---');

const dhiNum = dhi.number().min(0).max(100).int();
const zodNum = zod.number().min(0).max(100).int();
compare('Int + range (valid)',
  () => dhiNum.safeParse(42),
  () => zodNum.safeParse(42));
compare('Int + range (invalid)',
  () => dhiNum.safeParse(150),
  () => zodNum.safeParse(150));

const dhiNumComplex = dhi.number().positive().finite().multipleOf(5);
const zodNumComplex = zod.number().positive().finite().multipleOf(5);
compare('Positive+finite+mult',
  () => dhiNumComplex.safeParse(25),
  () => zodNumComplex.safeParse(25));

console.log('');

// === Object Validators ===
console.log('--- Object Validators ---');

const dhiUser = dhi.object({
  name: dhi.string().min(1).max(100),
  email: dhi.string().email(),
  age: dhi.number().int().positive().max(150),
});
const zodUser = zod.object({
  name: zod.string().min(1).max(100),
  email: zod.string().email(),
  age: zod.number().int().positive().max(150),
});
const validUser = { name: 'Alice Johnson', email: 'alice@example.com', age: 28 };
const invalidUser = { name: '', email: 'bad', age: -5 };

compare('User object (valid)',
  () => dhiUser.safeParse(validUser),
  () => zodUser.safeParse(validUser), 500_000);
compare('User object (invalid)',
  () => dhiUser.safeParse(invalidUser),
  () => zodUser.safeParse(invalidUser), 500_000);

// Nested object
const dhiNested = dhi.object({
  user: dhi.object({
    profile: dhi.object({
      name: dhi.string().min(1),
      bio: dhi.string().max(500),
    }),
    settings: dhi.object({
      theme: dhi.enum(['light', 'dark']),
      notifications: dhi.boolean(),
    }),
  }),
  metadata: dhi.object({
    version: dhi.number().int(),
    tags: dhi.array(dhi.string()),
  }),
});
const zodNested = zod.object({
  user: zod.object({
    profile: zod.object({
      name: zod.string().min(1),
      bio: zod.string().max(500),
    }),
    settings: zod.object({
      theme: zod.enum(['light', 'dark']),
      notifications: zod.boolean(),
    }),
  }),
  metadata: zod.object({
    version: zod.number().int(),
    tags: zod.array(zod.string()),
  }),
});
const nestedData = {
  user: {
    profile: { name: 'Alice', bio: 'Developer' },
    settings: { theme: 'dark' as const, notifications: true },
  },
  metadata: { version: 2, tags: ['admin', 'verified'] },
};
compare('Nested object (valid)',
  () => dhiNested.safeParse(nestedData),
  () => zodNested.safeParse(nestedData), 200_000);

console.log('');

// === Primitives ===
console.log('--- Primitive Type Checks ---');
const dhiStr = dhi.string();
const zodStr = zod.string();
compare('String type check',
  () => dhiStr.safeParse('hello'),
  () => zodStr.safeParse('hello'));

compare('Number type check',
  () => dhi.number().safeParse(42),
  () => zod.number().safeParse(42));

const dhiBool = dhi.boolean();
const zodBool = zod.boolean();
compare('Boolean type check',
  () => dhiBool.safeParse(true),
  () => zodBool.safeParse(true));

console.log('');

// === Arrays ===
console.log('--- Array Validators ---');
const dhiArr = dhi.array(dhi.number());
const zodArr = zod.array(zod.number());
const numArr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
compare('Array<number> (10)',
  () => dhiArr.safeParse(numArr),
  () => zodArr.safeParse(numArr), 500_000);

const dhiArrStr = dhi.array(dhi.string().email());
const zodArrStr = zod.array(zod.string().email());
const emailArr = ['a@b.com', 'c@d.org', 'e@f.net'];
compare('Array<email> (3)',
  () => dhiArrStr.safeParse(emailArr),
  () => zodArrStr.safeParse(emailArr), 500_000);

console.log('');

// === Coercion ===
console.log('--- Coercion ---');
compare('Coerce to string',
  () => dhi.coerce.string().safeParse(42),
  () => zod.coerce.string().safeParse(42));
compare('Coerce to number',
  () => dhi.coerce.number().safeParse('42'),
  () => zod.coerce.number().safeParse('42'));

console.log('');

// === Enum ===
console.log('--- Enum ---');
const dhiEnum = dhi.enum(['red', 'green', 'blue', 'yellow', 'purple']);
const zodEnum = zod.enum(['red', 'green', 'blue', 'yellow', 'purple']);
compare('Enum (valid)',
  () => dhiEnum.safeParse('blue'),
  () => zodEnum.safeParse('blue'));
compare('Enum (invalid)',
  () => dhiEnum.safeParse('orange'),
  () => zodEnum.safeParse('orange'));

console.log('');

// === Union ===
console.log('--- Union / Discriminated Union ---');
const dhiUnion = dhi.union([dhi.string(), dhi.number(), dhi.boolean()]);
const zodUnion = zod.union([zod.string(), zod.number(), zod.boolean()]);
compare('Union (string|num|bool)',
  () => dhiUnion.safeParse('hello'),
  () => zodUnion.safeParse('hello'));

const dhiDiscrim = dhi.discriminatedUnion('type', [
  dhi.object({ type: dhi.literal('a'), value: dhi.string() }),
  dhi.object({ type: dhi.literal('b'), count: dhi.number() }),
  dhi.object({ type: dhi.literal('c'), flag: dhi.boolean() }),
]);
const zodDiscrim = zod.discriminatedUnion('type', [
  zod.object({ type: zod.literal('a'), value: zod.string() }),
  zod.object({ type: zod.literal('b'), count: zod.number() }),
  zod.object({ type: zod.literal('c'), flag: zod.boolean() }),
]);
compare('DiscriminatedUnion',
  () => dhiDiscrim.safeParse({ type: 'b', count: 42 }),
  () => zodDiscrim.safeParse({ type: 'b', count: 42 }), 500_000);

console.log('');

// === Transforms ===
console.log('--- Transforms ---');
const dhiTrim = dhi.string().trim();
const zodTrim = zod.string().trim();
compare('Trim',
  () => dhiTrim.safeParse('  hello  '),
  () => zodTrim.safeParse('  hello  '));

const dhiTransform = dhi.string().transform(s => s.length);
const zodTransform = zod.string().transform(s => s.length);
compare('Transform (len)',
  () => dhiTransform.safeParse('hello'),
  () => zodTransform.safeParse('hello'));

console.log('');

// === Optional/Nullable ===
console.log('--- Optional / Nullable ---');
const dhiOpt = dhi.string().optional();
const zodOpt = zod.string().optional();
compare('Optional (undefined)',
  () => dhiOpt.safeParse(undefined),
  () => zodOpt.safeParse(undefined));
compare('Optional (value)',
  () => dhiOpt.safeParse('hello'),
  () => zodOpt.safeParse('hello'));

const dhiNull = dhi.string().nullable();
const zodNull = zod.string().nullable();
compare('Nullable (null)',
  () => dhiNull.safeParse(null),
  () => zodNull.safeParse(null));

console.log('');
console.log('='.repeat(80));
console.log('  Benchmark complete');
console.log('='.repeat(80));
