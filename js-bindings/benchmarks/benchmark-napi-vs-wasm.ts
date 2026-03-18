/**
 * Benchmark: N-API native addon vs WASM for dhi validation
 *
 * Tests key validators side-by-side to measure N-API overhead vs WASM.
 * Uses 100k iterations per test, reports median of 3 runs and ops/sec.
 *
 * Run with: bun run benchmarks/benchmark-napi-vs-wasm.ts
 * (after running `npm run build:napi` first to build the native addon)
 */

import { z as zWasm } from "../schema.ts";

// Dynamically import the N-API version (may fail if addon not built)
let zNapi: typeof zWasm | null = null;
try {
  const mod = await import("../schema-napi.ts");
  zNapi = mod.z;
} catch (e) {
  console.error("N-API addon not available. Run `npm run build:napi` first.");
  console.error((e as Error).message);
  process.exit(1);
}

// ============================================================================
// Benchmark harness
// ============================================================================

const ITERATIONS = 100_000;
const RUNS = 3;

function bench(name: string, fn: () => void, iters = ITERATIONS): number {
  // Warmup
  for (let i = 0; i < Math.min(1000, iters); i++) fn();

  const times: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    const start = performance.now();
    for (let i = 0; i < iters; i++) fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(RUNS / 2)]; // median
}

function opsPerSec(ms: number, iters = ITERATIONS): number {
  return Math.round((iters / ms) * 1000);
}

function formatOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M/sec`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K/sec`;
  return `${ops}/sec`;
}

// ============================================================================
// Test cases
// ============================================================================

interface BenchCase {
  name: string;
  wasmFn: () => void;
  napiFn: () => void;
  iters?: number;
}

// Build schema instances once (outside the benchmark loop)
const wasmEmailSchema = zWasm.string().email();
const napiEmailSchema = zNapi!.string().email();

const wasmUrlSchema = zWasm.string().url();
const napiUrlSchema = zNapi!.string().url();

const wasmUuidSchema = zWasm.string().uuid();
const napiUuidSchema = zNapi!.string().uuid();

const wasmIpv4Schema = zWasm.string().ip({ version: "v4" });
const napiIpv4Schema = zNapi!.string().ip({ version: "v4" });

const wasmDatetimeSchema = zWasm.string().datetime();
const napiDatetimeSchema = zNapi!.string().datetime();

const wasmNumberSchema = zWasm.number().int().positive().max(1000);
const napiNumberSchema = zNapi!.number().int().positive().max(1000);

const wasmObjectSchema = zWasm.object({
  name: zWasm.string().min(1).max(100),
  email: zWasm.string().email(),
  age: zWasm.number().int().positive().max(150),
  website: zWasm.string().url().optional(),
});

const napiObjectSchema = zNapi!.object({
  name: zNapi!.string().min(1).max(100),
  email: zNapi!.string().email(),
  age: zNapi!.number().int().positive().max(150),
  website: zNapi!.string().url().optional(),
});

const testUser = {
  name: "Alice Smith",
  email: "alice@example.com",
  age: 30,
  website: "https://alice.dev",
};

const cases: BenchCase[] = [
  {
    name: "email validation",
    wasmFn: () => wasmEmailSchema.safeParse("user@example.com"),
    napiFn: () => napiEmailSchema.safeParse("user@example.com"),
  },
  {
    name: "url validation",
    wasmFn: () => wasmUrlSchema.safeParse("https://example.com/path"),
    napiFn: () => napiUrlSchema.safeParse("https://example.com/path"),
  },
  {
    name: "uuid validation",
    wasmFn: () => wasmUuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000"),
    napiFn: () => napiUuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000"),
  },
  {
    name: "ipv4 validation",
    wasmFn: () => wasmIpv4Schema.safeParse("192.168.1.100"),
    napiFn: () => napiIpv4Schema.safeParse("192.168.1.100"),
  },
  {
    name: "datetime validation",
    wasmFn: () => wasmDatetimeSchema.safeParse("2024-01-15T10:30:00Z"),
    napiFn: () => napiDatetimeSchema.safeParse("2024-01-15T10:30:00Z"),
  },
  {
    name: "number (int + positive + max)",
    wasmFn: () => wasmNumberSchema.safeParse(42),
    napiFn: () => napiNumberSchema.safeParse(42),
  },
  {
    name: "object (4 fields, email + url)",
    wasmFn: () => wasmObjectSchema.safeParse(testUser),
    napiFn: () => napiObjectSchema.safeParse(testUser),
    iters: 50_000,
  },
];

// ============================================================================
// Run benchmarks
// ============================================================================

console.log("\n=== dhi: N-API native addon vs WASM benchmark ===");
console.log(`Iterations: ${ITERATIONS.toLocaleString()} per test (${RUNS} runs, median reported)\n`);

const COL_NAME = 28;
const COL_VAL = 14;

const header = [
  "Test".padEnd(COL_NAME),
  "WASM".padStart(COL_VAL),
  "N-API".padStart(COL_VAL),
  "Speedup".padStart(COL_VAL),
].join("  ");
console.log(header);
console.log("-".repeat(header.length));

for (const c of cases) {
  const iters = c.iters ?? ITERATIONS;
  const wasmMs = bench(c.name + " [wasm]", c.wasmFn, iters);
  const napiMs = bench(c.name + " [napi]", c.napiFn, iters);

  const wasmOps = opsPerSec(wasmMs, iters);
  const napiOps = opsPerSec(napiMs, iters);
  const speedup = napiOps / wasmOps;
  const speedupStr = speedup >= 1
    ? `${speedup.toFixed(2)}x faster`
    : `${(1 / speedup).toFixed(2)}x slower`;

  console.log([
    c.name.padEnd(COL_NAME),
    formatOps(wasmOps).padStart(COL_VAL),
    formatOps(napiOps).padStart(COL_VAL),
    speedupStr.padStart(COL_VAL),
  ].join("  "));
}

console.log("\nDone.");
