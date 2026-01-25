/**
 * Benchmark: JSON Schema Generation
 * Compares dhi.toJsonSchema() vs zod-to-json-schema
 *
 * Key difference: dhi has BUILT-IN JSON Schema generation
 * Zod requires an external library (zod-to-json-schema)
 */

import { z as dhi } from "../schema";
import { z as zod } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

console.log("=".repeat(70));
console.log("  JSON Schema Generation Benchmark: dhi vs Zod + zod-to-json-schema");
console.log("=".repeat(70));
console.log();

// Test schemas of varying complexity
const iterations = 10_000;

// Simple schema
const dhiSimple = dhi.object({
  name: dhi.string(),
  age: dhi.number(),
});

const zodSimple = zod.object({
  name: zod.string(),
  age: zod.number(),
});

// Medium complexity schema
const dhiMedium = dhi.object({
  id: dhi.string().uuid(),
  name: dhi.string().min(1).max(100),
  email: dhi.string().email(),
  age: dhi.number().int().positive(),
  active: dhi.boolean(),
  tags: dhi.array(dhi.string()),
});

const zodMedium = zod.object({
  id: zod.string().uuid(),
  name: zod.string().min(1).max(100),
  email: zod.string().email(),
  age: zod.number().int().positive(),
  active: zod.boolean(),
  tags: zod.array(zod.string()),
});

// Complex nested schema
const dhiComplex = dhi.object({
  user: dhi.object({
    id: dhi.string().uuid(),
    profile: dhi.object({
      firstName: dhi.string().min(1),
      lastName: dhi.string().min(1),
      bio: dhi.string().max(500).optional(),
    }),
    settings: dhi.object({
      theme: dhi.enum(["light", "dark", "system"]),
      notifications: dhi.boolean(),
      language: dhi.string().default("en"),
    }),
  }),
  posts: dhi.array(dhi.object({
    id: dhi.string(),
    title: dhi.string().min(1).max(200),
    content: dhi.string(),
    published: dhi.boolean(),
    tags: dhi.array(dhi.string()).max(10),
  })),
  metadata: dhi.object({
    createdAt: dhi.string().datetime(),
    updatedAt: dhi.string().datetime().optional(),
    version: dhi.number().int().positive(),
  }),
});

const zodComplex = zod.object({
  user: zod.object({
    id: zod.string().uuid(),
    profile: zod.object({
      firstName: zod.string().min(1),
      lastName: zod.string().min(1),
      bio: zod.string().max(500).optional(),
    }),
    settings: zod.object({
      theme: zod.enum(["light", "dark", "system"]),
      notifications: zod.boolean(),
      language: zod.string().default("en"),
    }),
  }),
  posts: zod.array(zod.object({
    id: zod.string(),
    title: zod.string().min(1).max(200),
    content: zod.string(),
    published: zod.boolean(),
    tags: zod.array(zod.string()).max(10),
  })),
  metadata: zod.object({
    createdAt: zod.string().datetime(),
    updatedAt: zod.string().datetime().optional(),
    version: zod.number().int().positive(),
  }),
});

function benchmark(name: string, fn: () => void, iters: number): number {
  // Warmup
  for (let i = 0; i < 100; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iters; i++) {
    fn();
  }
  const end = performance.now();
  const totalMs = end - start;
  const opsPerSec = (iters / totalMs) * 1000;
  return opsPerSec;
}

console.log("📊 Simple Schema (2 fields)");
console.log("-".repeat(50));

const dhiSimpleOps = benchmark("dhi", () => dhiSimple.toJsonSchema(), iterations);
const zodSimpleOps = benchmark("zod", () => zodToJsonSchema(zodSimple), iterations);

console.log(`  dhi.toJsonSchema():       ${dhiSimpleOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
console.log(`  zodToJsonSchema(schema):  ${zodSimpleOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
const simpleSpeedup = dhiSimpleOps / zodSimpleOps;
console.log(`  ${simpleSpeedup >= 1 ? `dhi is ${simpleSpeedup.toFixed(1)}x faster` : `zod-to-json-schema is ${(1/simpleSpeedup).toFixed(1)}x faster`}`);
console.log();

console.log("📊 Medium Schema (6 fields with constraints)");
console.log("-".repeat(50));

const dhiMediumOps = benchmark("dhi", () => dhiMedium.toJsonSchema(), iterations);
const zodMediumOps = benchmark("zod", () => zodToJsonSchema(zodMedium), iterations);

console.log(`  dhi.toJsonSchema():       ${dhiMediumOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
console.log(`  zodToJsonSchema(schema):  ${zodMediumOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
const mediumSpeedup = dhiMediumOps / zodMediumOps;
console.log(`  ${mediumSpeedup >= 1 ? `dhi is ${mediumSpeedup.toFixed(1)}x faster` : `zod-to-json-schema is ${(1/mediumSpeedup).toFixed(1)}x faster`}`);
console.log();

console.log("📊 Complex Nested Schema (3 levels deep, ~20 fields)");
console.log("-".repeat(50));

const dhiComplexOps = benchmark("dhi", () => dhiComplex.toJsonSchema(), iterations);
const zodComplexOps = benchmark("zod", () => zodToJsonSchema(zodComplex), iterations);

console.log(`  dhi.toJsonSchema():       ${dhiComplexOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
console.log(`  zodToJsonSchema(schema):  ${zodComplexOps.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/sec`);
const complexSpeedup = dhiComplexOps / zodComplexOps;
console.log(`  ${complexSpeedup >= 1 ? `dhi is ${complexSpeedup.toFixed(1)}x faster` : `zod-to-json-schema is ${(1/complexSpeedup).toFixed(1)}x faster`}`);
console.log();

console.log("=".repeat(70));
console.log("  Summary");
console.log("=".repeat(70));
console.log();
console.log("  ✅ dhi: Built-in JSON Schema generation via .toJsonSchema() / .json()");
console.log("  ❌ Zod: Requires external library (zod-to-json-schema)");
console.log();

const avgSpeedup = (simpleSpeedup + mediumSpeedup + complexSpeedup) / 3;
if (avgSpeedup >= 1) {
  console.log(`  Average: dhi is ${avgSpeedup.toFixed(1)}x faster`);
} else {
  console.log(`  Average: zod-to-json-schema is ${(1/avgSpeedup).toFixed(1)}x faster`);
  console.log();
  console.log("  Note: zod-to-json-schema is highly optimized, but requires:");
  console.log("    - Extra dependency (~50KB)");
  console.log("    - Separate import and function call");
}
console.log();

// Verify correctness
console.log("📋 Sample dhi JSON Schema output:");
console.log(JSON.stringify(dhiMedium.toJsonSchema(), null, 2));
