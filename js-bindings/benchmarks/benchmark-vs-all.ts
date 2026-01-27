/**
 * Head-to-head: dhi vs Zod 4 vs Arktype 2 — Top 3 TS Validation Libraries
 *
 * This benchmark compares the three most popular TypeScript validation libraries:
 * - dhi (SIMD WASM-powered)
 * - Zod 4.x (the most popular)
 * - Arktype 2.x (claims 100x faster than Zod)
 */
import { z as dhi } from '../schema';
import { z as zod } from 'zod';
import { type } from 'arktype';

// Types for arktype results
type ArkResult<T> = T | import('arktype').ArkErrors;

function bench(fn: () => void, iterations: number = 1_000_000): number {
  // Warmup
  for (let i = 0; i < 10000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  return (iterations / elapsed) * 1000;
}

interface BenchmarkResult {
  name: string;
  dhi: number;
  zod: number;
  arktype: number;
  dhiVsZod: number;
  dhiVsArktype: number;
}

const results: BenchmarkResult[] = [];

function compare(
  name: string,
  dhiFn: () => void,
  zodFn: () => void,
  arktypeFn: () => void,
  iterations = 1_000_000
) {
  const dhiOps = bench(dhiFn, iterations);
  const zodOps = bench(zodFn, iterations);
  const arktypeOps = bench(arktypeFn, iterations);

  const dhiVsZod = dhiOps / zodOps;
  const dhiVsArktype = dhiOps / arktypeOps;

  results.push({ name, dhi: dhiOps, zod: zodOps, arktype: arktypeOps, dhiVsZod, dhiVsArktype });

  const dhiStr = (dhiOps / 1e6).toFixed(2);
  const zodStr = (zodOps / 1e6).toFixed(2);
  const arktypeStr = (arktypeOps / 1e6).toFixed(2);

  const vsZodStr = dhiVsZod >= 1
    ? `${dhiVsZod.toFixed(1)}x`
    : `${(1/dhiVsZod).toFixed(1)}x slower`;
  const vsArkStr = dhiVsArktype >= 1
    ? `${dhiVsArktype.toFixed(1)}x`
    : `${(1/dhiVsArktype).toFixed(1)}x slower`;

  console.log(
    `  ${name.padEnd(24)} ` +
    `dhi: ${dhiStr.padStart(7)}M  ` +
    `zod: ${zodStr.padStart(7)}M  ` +
    `ark: ${arktypeStr.padStart(7)}M  ` +
    `(vs zod: ${vsZodStr.padStart(8)}, vs ark: ${vsArkStr.padStart(8)})`
  );
}

console.log('='.repeat(100));
console.log('  dhi vs Zod 4.3.6 vs Arktype 2.1 — Top 3 TS Validation Libraries Benchmark');
console.log('='.repeat(100));
console.log('');

// === String Validators ===
console.log('--- String Validators ---');

// Email
const dhiEmail = dhi.string().email();
const zodEmail = zod.string().email();
const arktypeEmail = type('string.email');
compare('Email (valid)',
  () => dhiEmail.safeParse('user+test@example.com'),
  () => zodEmail.safeParse('user+test@example.com'),
  () => arktypeEmail('user+test@example.com')
);
compare('Email (invalid)',
  () => dhiEmail.safeParse('not-an-email'),
  () => zodEmail.safeParse('not-an-email'),
  () => arktypeEmail('not-an-email')
);

// URL
const dhiUrl = dhi.string().url();
const zodUrl = zod.string().url();
const arktypeUrl = type('string.url');
compare('URL (valid)',
  () => dhiUrl.safeParse('https://www.example.com/path?q=v'),
  () => zodUrl.safeParse('https://www.example.com/path?q=v'),
  () => arktypeUrl('https://www.example.com/path?q=v')
);

// UUID
const dhiUuid = dhi.string().uuid();
const zodUuid = zod.string().uuid();
const arktypeUuid = type('string.uuid');
compare('UUID (valid)',
  () => dhiUuid.safeParse('550e8400-e29b-41d4-a716-446655440000'),
  () => zodUuid.safeParse('550e8400-e29b-41d4-a716-446655440000'),
  () => arktypeUuid('550e8400-e29b-41d4-a716-446655440000')
);

// IPv4
const dhiIp = dhi.string().ipv4();
const zodIp = zod.string().ipv4();
const arktypeIp = type('string.ip');
compare('IPv4 (valid)',
  () => dhiIp.safeParse('192.168.1.100'),
  () => zodIp.safeParse('192.168.1.100'),
  () => arktypeIp('192.168.1.100')
);

// Date string
const dhiDate = dhi.string().date();
const zodDate = zod.string().date();
const arktypeDate = type('string.date.iso');
compare('Date (valid)',
  () => dhiDate.safeParse('2024-06-15'),
  () => zodDate.safeParse('2024-06-15'),
  () => arktypeDate('2024-06-15')
);

// String length constraints
const dhiMinMax = dhi.string().min(3).max(50);
const zodMinMax = zod.string().min(3).max(50);
const arktypeMinMax = type('3 <= string <= 50');
compare('Min/Max length',
  () => dhiMinMax.safeParse('hello world'),
  () => zodMinMax.safeParse('hello world'),
  () => arktypeMinMax('hello world')
);

console.log('');

// === Number Validators ===
console.log('--- Number Validators ---');

const dhiNum = dhi.number().min(0).max(100).int();
const zodNum = zod.number().min(0).max(100).int();
const arktypeNum = type('0 <= number.integer <= 100');
compare('Int + range (valid)',
  () => dhiNum.safeParse(42),
  () => zodNum.safeParse(42),
  () => arktypeNum(42)
);
compare('Int + range (invalid)',
  () => dhiNum.safeParse(150),
  () => zodNum.safeParse(150),
  () => arktypeNum(150)
);

const dhiNumPos = dhi.number().positive();
const zodNumPos = zod.number().positive();
const arktypeNumPos = type('number>0');
compare('Positive number',
  () => dhiNumPos.safeParse(25),
  () => zodNumPos.safeParse(25),
  () => arktypeNumPos(25)
);

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
const arktypeUser = type({
  name: '1 <= string <= 100',
  email: 'string.email',
  age: '0 < number.integer <= 150',
});
const validUser = { name: 'Alice Johnson', email: 'alice@example.com', age: 28 };
const invalidUser = { name: '', email: 'bad', age: -5 };

compare('User object (valid)',
  () => dhiUser.safeParse(validUser),
  () => zodUser.safeParse(validUser),
  () => arktypeUser(validUser),
  500_000
);
compare('User object (invalid)',
  () => dhiUser.safeParse(invalidUser),
  () => zodUser.safeParse(invalidUser),
  () => arktypeUser(invalidUser),
  500_000
);

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
const arktypeNested = type({
  user: {
    profile: {
      name: 'string >= 1',
      bio: 'string <= 500',
    },
    settings: {
      theme: "'light' | 'dark'",
      notifications: 'boolean',
    },
  },
  metadata: {
    version: 'number.integer',
    tags: 'string[]',
  },
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
  () => zodNested.safeParse(nestedData),
  () => arktypeNested(nestedData),
  200_000
);

console.log('');

// === Primitives ===
console.log('--- Primitive Type Checks ---');
const dhiStr = dhi.string();
const zodStr = zod.string();
const arktypeStr = type('string');
compare('String type check',
  () => dhiStr.safeParse('hello'),
  () => zodStr.safeParse('hello'),
  () => arktypeStr('hello')
);

compare('Number type check',
  () => dhi.number().safeParse(42),
  () => zod.number().safeParse(42),
  () => type('number')(42)
);

const dhiBool = dhi.boolean();
const zodBool = zod.boolean();
const arktypeBool = type('boolean');
compare('Boolean type check',
  () => dhiBool.safeParse(true),
  () => zodBool.safeParse(true),
  () => arktypeBool(true)
);

console.log('');

// === Arrays ===
console.log('--- Array Validators ---');
const dhiArr = dhi.array(dhi.number());
const zodArr = zod.array(zod.number());
const arktypeArr = type('number[]');
const numArr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
compare('Array<number> (10)',
  () => dhiArr.safeParse(numArr),
  () => zodArr.safeParse(numArr),
  () => arktypeArr(numArr),
  500_000
);

const dhiArrStr = dhi.array(dhi.string().email());
const zodArrStr = zod.array(zod.string().email());
const arktypeArrStr = type('string.email[]');
const emailArr = ['a@b.com', 'c@d.org', 'e@f.net'];
compare('Array<email> (3)',
  () => dhiArrStr.safeParse(emailArr),
  () => zodArrStr.safeParse(emailArr),
  () => arktypeArrStr(emailArr),
  500_000
);

console.log('');

// === Enum ===
console.log('--- Enum ---');
const dhiEnum = dhi.enum(['red', 'green', 'blue', 'yellow', 'purple']);
const zodEnum = zod.enum(['red', 'green', 'blue', 'yellow', 'purple']);
const arktypeEnum = type("'red' | 'green' | 'blue' | 'yellow' | 'purple'");
compare('Enum (valid)',
  () => dhiEnum.safeParse('blue'),
  () => zodEnum.safeParse('blue'),
  () => arktypeEnum('blue')
);
compare('Enum (invalid)',
  () => dhiEnum.safeParse('orange'),
  () => zodEnum.safeParse('orange'),
  () => arktypeEnum('orange')
);

console.log('');

// === Union ===
console.log('--- Union ---');
const dhiUnion = dhi.union([dhi.string(), dhi.number(), dhi.boolean()]);
const zodUnion = zod.union([zod.string(), zod.number(), zod.boolean()]);
const arktypeUnion = type('string | number | boolean');
compare('Union (string|num|bool)',
  () => dhiUnion.safeParse('hello'),
  () => zodUnion.safeParse('hello'),
  () => arktypeUnion('hello')
);

console.log('');

// === Optional/Nullable ===
console.log('--- Optional / Nullable ---');
const dhiOpt = dhi.string().optional();
const zodOpt = zod.string().optional();
const arktypeOpt = type('string | undefined');
compare('Optional (undefined)',
  () => dhiOpt.safeParse(undefined),
  () => zodOpt.safeParse(undefined),
  () => arktypeOpt(undefined)
);
compare('Optional (value)',
  () => dhiOpt.safeParse('hello'),
  () => zodOpt.safeParse('hello'),
  () => arktypeOpt('hello')
);

const dhiNull = dhi.string().nullable();
const zodNull = zod.string().nullable();
const arktypeNull = type('string | null');
compare('Nullable (null)',
  () => dhiNull.safeParse(null),
  () => zodNull.safeParse(null),
  () => arktypeNull(null)
);

console.log('');

// === Coercion ===
console.log('--- Coercion ---');
// Note: Arktype handles coercion differently, using morphs
const arktypeCoerceStr = type('unknown', '=>', (v: unknown) => String(v));
const arktypeCoerceNum = type('string.numeric.parse');
compare('Coerce to string',
  () => dhi.coerce.string().safeParse(42),
  () => zod.coerce.string().safeParse(42),
  () => arktypeCoerceStr(42)
);
compare('Coerce to number',
  () => dhi.coerce.number().safeParse('42'),
  () => zod.coerce.number().safeParse('42'),
  () => arktypeCoerceNum('42')
);

console.log('');
console.log('='.repeat(100));
console.log('');

// Summary
const avgDhiVsZod = results.reduce((sum, r) => sum + r.dhiVsZod, 0) / results.length;
const avgDhiVsArktype = results.reduce((sum, r) => sum + r.dhiVsArktype, 0) / results.length;

console.log('  SUMMARY');
console.log('  ' + '-'.repeat(60));
console.log(`  Average speedup vs Zod:     ${avgDhiVsZod.toFixed(1)}x faster`);
console.log(`  Average speedup vs Arktype: ${avgDhiVsArktype.toFixed(1)}x faster`);
console.log('');

// Best/worst case
const bestVsZod = results.reduce((best, r) => r.dhiVsZod > best.dhiVsZod ? r : best);
const worstVsZod = results.reduce((worst, r) => r.dhiVsZod < worst.dhiVsZod ? r : worst);
const bestVsArktype = results.reduce((best, r) => r.dhiVsArktype > best.dhiVsArktype ? r : best);
const worstVsArktype = results.reduce((worst, r) => r.dhiVsArktype < worst.dhiVsArktype ? r : worst);

console.log(`  Best vs Zod:     ${bestVsZod.name} (${bestVsZod.dhiVsZod.toFixed(1)}x faster)`);
console.log(`  Worst vs Zod:    ${worstVsZod.name} (${worstVsZod.dhiVsZod.toFixed(1)}x)`);
console.log(`  Best vs Arktype: ${bestVsArktype.name} (${bestVsArktype.dhiVsArktype.toFixed(1)}x faster)`);
console.log(`  Worst vs Arktype: ${worstVsArktype.name} (${worstVsArktype.dhiVsArktype.toFixed(1)}x)`);

console.log('');
console.log('='.repeat(100));
console.log('  Benchmark complete');
console.log('='.repeat(100));
