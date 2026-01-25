/**
 * Benchmark: dhi vs Zod — JSON output for CI
 * Outputs results as JSON for chart generation
 */
import { z as dhi } from './schema';
import { z as zod } from 'zod';
import { writeFileSync } from 'fs';

interface BenchmarkResult {
  name: string;
  category: string;
  dhi: number;
  zod: number;
  speedup: number;
}

function bench(fn: () => void, iterations: number = 1_000_000): number {
  // Warmup
  for (let i = 0; i < 10000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  return (iterations / elapsed) * 1000;
}

function runBenchmark(name: string, category: string, dhiFn: () => void, zodFn: () => void, iterations = 1_000_000): BenchmarkResult {
  const dhiOps = bench(dhiFn, iterations);
  const zodOps = bench(zodFn, iterations);
  const speedup = dhiOps / zodOps;
  return { name, category, dhi: dhiOps, zod: zodOps, speedup };
}

const results: BenchmarkResult[] = [];

// === String Format Shortcuts ===
results.push(runBenchmark('z.email()', 'String Formats',
  () => dhi.email().safeParse('test@example.com'),
  () => zod.email().safeParse('test@example.com')));

results.push(runBenchmark('z.uuid()', 'String Formats',
  () => dhi.uuid().safeParse('550e8400-e29b-41d4-a716-446655440000'),
  () => zod.uuid().safeParse('550e8400-e29b-41d4-a716-446655440000')));

results.push(runBenchmark('z.url()', 'String Formats',
  () => dhi.url().safeParse('https://example.com/path'),
  () => zod.url().safeParse('https://example.com/path')));

results.push(runBenchmark('z.ipv4()', 'String Formats',
  () => dhi.ipv4().safeParse('192.168.1.1'),
  () => zod.ipv4().safeParse('192.168.1.1')));

results.push(runBenchmark('z.jwt()', 'String Formats',
  () => dhi.jwt().safeParse('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig'),
  () => zod.jwt().safeParse('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig')));

results.push(runBenchmark('z.ulid()', 'String Formats',
  () => dhi.ulid().safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  () => zod.ulid().safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV')));

results.push(runBenchmark('z.nanoid()', 'String Formats',
  () => dhi.nanoid().safeParse('V1StGXR8_Z5jdHi6B-myT'),
  () => zod.nanoid().safeParse('V1StGXR8_Z5jdHi6B-myT')));

results.push(runBenchmark('z.base64()', 'String Formats',
  () => dhi.base64().safeParse('SGVsbG8gV29ybGQ='),
  () => zod.base64().safeParse('SGVsbG8gV29ybGQ=')));

// === Number Formats ===
results.push(runBenchmark('z.int()', 'Number Formats',
  () => dhi.int().safeParse(42),
  () => zod.int().safeParse(42)));

results.push(runBenchmark('z.int32()', 'Number Formats',
  () => dhi.int32().safeParse(2147483647),
  () => zod.int32().safeParse(2147483647)));

results.push(runBenchmark('z.float64()', 'Number Formats',
  () => dhi.float64().safeParse(3.141592653589793),
  () => zod.float64().safeParse(3.141592653589793)));

// === ISO Namespace ===
results.push(runBenchmark('z.iso.date()', 'ISO Formats',
  () => dhi.iso.date().safeParse('2024-01-15'),
  () => zod.iso.date().safeParse('2024-01-15')));

results.push(runBenchmark('z.iso.time()', 'ISO Formats',
  () => dhi.iso.time().safeParse('10:30:00'),
  () => zod.iso.time().safeParse('10:30:00')));

results.push(runBenchmark('z.iso.datetime()', 'ISO Formats',
  () => dhi.iso.datetime().safeParse('2024-01-15T10:30:00Z'),
  () => zod.iso.datetime().safeParse('2024-01-15T10:30:00Z')));

// === Object Validation ===
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

results.push(runBenchmark('Object (valid)', 'Objects',
  () => dhiUser.safeParse(validUser),
  () => zodUser.safeParse(validUser), 500_000));

// Nested object
const dhiNested = dhi.object({
  user: dhi.object({
    profile: dhi.object({ name: dhi.string(), bio: dhi.string() }),
    settings: dhi.object({ theme: dhi.enum(['light', 'dark']), notifications: dhi.boolean() }),
  }),
  metadata: dhi.object({ version: dhi.number(), tags: dhi.array(dhi.string()) }),
});
const zodNested = zod.object({
  user: zod.object({
    profile: zod.object({ name: zod.string(), bio: zod.string() }),
    settings: zod.object({ theme: zod.enum(['light', 'dark']), notifications: zod.boolean() }),
  }),
  metadata: zod.object({ version: zod.number(), tags: zod.array(zod.string()) }),
});
const nestedData = {
  user: { profile: { name: 'Alice', bio: 'Dev' }, settings: { theme: 'dark' as const, notifications: true } },
  metadata: { version: 2, tags: ['admin'] },
};

results.push(runBenchmark('Nested Object', 'Objects',
  () => dhiNested.safeParse(nestedData),
  () => zodNested.safeParse(nestedData), 200_000));

// === Coercion ===
results.push(runBenchmark('z.coerce.string()', 'Coercion',
  () => dhi.coerce.string().safeParse(42),
  () => zod.coerce.string().safeParse(42)));

results.push(runBenchmark('z.coerce.number()', 'Coercion',
  () => dhi.coerce.number().safeParse('42'),
  () => zod.coerce.number().safeParse('42')));

results.push(runBenchmark('z.coerce.boolean()', 'Coercion',
  () => dhi.coerce.boolean().safeParse(1),
  () => zod.coerce.boolean().safeParse(1)));

// === StringBool ===
results.push(runBenchmark('z.stringbool()', 'StringBool',
  () => dhi.stringbool().safeParse('true'),
  () => zod.stringbool().safeParse('true')));

// === Arrays ===
const dhiArr = dhi.array(dhi.number());
const zodArr = zod.array(zod.number());
const numArr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

results.push(runBenchmark('Array<number>', 'Arrays',
  () => dhiArr.safeParse(numArr),
  () => zodArr.safeParse(numArr), 500_000));

// === Unions ===
const dhiUnion = dhi.union([dhi.string(), dhi.number(), dhi.boolean()]);
const zodUnion = zod.union([zod.string(), zod.number(), zod.boolean()]);

results.push(runBenchmark('Union', 'Unions',
  () => dhiUnion.safeParse('hello'),
  () => zodUnion.safeParse('hello')));

const dhiDiscrim = dhi.discriminatedUnion('type', [
  dhi.object({ type: dhi.literal('a'), value: dhi.string() }),
  dhi.object({ type: dhi.literal('b'), count: dhi.number() }),
]);
const zodDiscrim = zod.discriminatedUnion('type', [
  zod.object({ type: zod.literal('a'), value: zod.string() }),
  zod.object({ type: zod.literal('b'), count: zod.number() }),
]);

results.push(runBenchmark('DiscriminatedUnion', 'Unions',
  () => dhiDiscrim.safeParse({ type: 'b', count: 42 }),
  () => zodDiscrim.safeParse({ type: 'b', count: 42 }), 500_000));

// === Optional/Nullable ===
const dhiOpt = dhi.string().optional();
const zodOpt = zod.string().optional();

results.push(runBenchmark('Optional', 'Modifiers',
  () => dhiOpt.safeParse(undefined),
  () => zodOpt.safeParse(undefined)));

const dhiNull = dhi.string().nullable();
const zodNull = zod.string().nullable();

results.push(runBenchmark('Nullable', 'Modifiers',
  () => dhiNull.safeParse(null),
  () => zodNull.safeParse(null)));

// === Output ===
const output = {
  timestamp: new Date().toISOString(),
  runtime: typeof Bun !== 'undefined' ? 'Bun' : 'Node',
  results,
  summary: {
    totalBenchmarks: results.length,
    averageSpeedup: results.reduce((sum, r) => sum + r.speedup, 0) / results.length,
    maxSpeedup: Math.max(...results.map(r => r.speedup)),
    minSpeedup: Math.min(...results.map(r => r.speedup)),
  }
};

writeFileSync('benchmark-results.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
