/**
 * Benchmark: dhi vs Zod for AI Tool Validation
 *
 * This benchmark measures how fast each library validates
 * typical LLM tool call arguments - a critical path for AI agents.
 *
 * Run: bun run benchmark-tools.ts
 */

import { z as dhi } from '../../schema';
import { z as zod } from 'zod';

function bench(fn: () => void, iterations: number = 500_000): number {
  // Warmup
  for (let i = 0; i < 10000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  return (iterations / elapsed) * 1000;
}

interface Result {
  name: string;
  dhi: number;
  zod: number;
  speedup: number;
}

const results: Result[] = [];

function compare(name: string, dhiFn: () => void, zodFn: () => void, iterations = 500_000) {
  const dhiOps = bench(dhiFn, iterations);
  const zodOps = bench(zodFn, iterations);
  const speedup = dhiOps / zodOps;
  results.push({ name, dhi: dhiOps, zod: zodOps, speedup });

  const dhiStr = (dhiOps / 1e6).toFixed(2);
  const zodStr = (zodOps / 1e6).toFixed(2);
  console.log(
    `  ${name.padEnd(35)} dhi: ${dhiStr.padStart(6)}M  zod: ${zodStr.padStart(6)}M  ${speedup.toFixed(1)}x faster`
  );
}

console.log('='.repeat(80));
console.log('  AI Tool Validation Benchmark: dhi vs Zod');
console.log('  (Typical LLM tool call argument validation)');
console.log('='.repeat(80));
console.log('');

// ============================================================================
// SIMPLE TOOL SCHEMAS (most common)
// ============================================================================
console.log('--- Simple Tool Schemas ---');

// Weather tool (very common)
const dhiWeather = dhi.object({
  location: dhi.string().min(1),
  unit: dhi.enum(['celsius', 'fahrenheit']),
});
const zodWeather = zod.object({
  location: zod.string().min(1),
  unit: zod.enum(['celsius', 'fahrenheit']),
});
const weatherData = { location: 'San Francisco', unit: 'celsius' as const };
compare('Weather tool (valid)',
  () => dhiWeather.safeParse(weatherData),
  () => zodWeather.safeParse(weatherData)
);

// Search tool
const dhiSearch = dhi.object({
  query: dhi.string().min(1).max(500),
  maxResults: dhi.number().int().positive().max(100).optional(),
  category: dhi.string().optional(),
});
const zodSearch = zod.object({
  query: zod.string().min(1).max(500),
  maxResults: zod.number().int().positive().max(100).optional(),
  category: zod.string().optional(),
});
const searchData = { query: 'best restaurants in tokyo', maxResults: 10, category: 'food' };
compare('Search tool (valid)',
  () => dhiSearch.safeParse(searchData),
  () => zodSearch.safeParse(searchData)
);

// Calculator tool
const dhiCalc = dhi.object({
  expression: dhi.string().min(1),
  precision: dhi.number().int().min(0).max(15).default(2),
});
const zodCalc = zod.object({
  expression: zod.string().min(1),
  precision: zod.number().int().min(0).max(15).default(2),
});
const calcData = { expression: '2 + 2 * 3', precision: 4 };
compare('Calculator tool (valid)',
  () => dhiCalc.safeParse(calcData),
  () => zodCalc.safeParse(calcData)
);

console.log('');

// ============================================================================
// COMPLEX TOOL SCHEMAS (agentic workflows)
// ============================================================================
console.log('--- Complex Tool Schemas (Agentic) ---');

// Database query tool
const dhiDbQuery = dhi.object({
  table: dhi.enum(['users', 'orders', 'products', 'logs']),
  select: dhi.array(dhi.string()).min(1),
  where: dhi.array(dhi.object({
    field: dhi.string(),
    op: dhi.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'in']),
    value: dhi.union([dhi.string(), dhi.number(), dhi.boolean(), dhi.array(dhi.string())]),
  })).optional(),
  orderBy: dhi.object({
    field: dhi.string(),
    direction: dhi.enum(['asc', 'desc']),
  }).optional(),
  limit: dhi.number().int().positive().max(1000).default(100),
  offset: dhi.number().int().min(0).default(0),
});
const zodDbQuery = zod.object({
  table: zod.enum(['users', 'orders', 'products', 'logs']),
  select: zod.array(zod.string()).min(1),
  where: zod.array(zod.object({
    field: zod.string(),
    op: zod.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'in']),
    value: zod.union([zod.string(), zod.number(), zod.boolean(), zod.array(zod.string())]),
  })).optional(),
  orderBy: zod.object({
    field: zod.string(),
    direction: zod.enum(['asc', 'desc']),
  }).optional(),
  limit: zod.number().int().positive().max(1000).default(100),
  offset: zod.number().int().min(0).default(0),
});
const dbQueryData = {
  table: 'users' as const,
  select: ['id', 'name', 'email', 'created_at'],
  where: [
    { field: 'status', op: 'eq' as const, value: 'active' },
    { field: 'age', op: 'gte' as const, value: 18 },
  ],
  orderBy: { field: 'created_at', direction: 'desc' as const },
  limit: 50,
};
compare('Database query tool (valid)',
  () => dhiDbQuery.safeParse(dbQueryData),
  () => zodDbQuery.safeParse(dbQueryData),
  200_000
);

// Code execution tool
const dhiCodeExec = dhi.object({
  language: dhi.enum(['javascript', 'typescript', 'python', 'bash']),
  code: dhi.string().min(1).max(10000),
  stdin: dhi.string().optional(),
  nodeEnv: dhi.string().optional(),
  timeout: dhi.number().int().positive().max(60000).default(5000),
  memoryLimit: dhi.number().int().positive().max(512).default(128),
});
const zodCodeExec = zod.object({
  language: zod.enum(['javascript', 'typescript', 'python', 'bash']),
  code: zod.string().min(1).max(10000),
  stdin: zod.string().optional(),
  nodeEnv: zod.string().optional(),
  timeout: zod.number().int().positive().max(60000).default(5000),
  memoryLimit: zod.number().int().positive().max(512).default(128),
});
const codeExecData = {
  language: 'typescript' as const,
  code: 'console.log("Hello, World!");',
  nodeEnv: 'production',
  timeout: 10000,
};
compare('Code execution tool (valid)',
  () => dhiCodeExec.safeParse(codeExecData),
  () => zodCodeExec.safeParse(codeExecData)
);

// File operations (discriminated union)
const dhiFileOps = dhi.discriminatedUnion('operation', [
  dhi.object({
    operation: dhi.literal('read'),
    path: dhi.string().min(1),
    encoding: dhi.enum(['utf8', 'base64', 'binary']).default('utf8'),
  }),
  dhi.object({
    operation: dhi.literal('write'),
    path: dhi.string().min(1),
    content: dhi.string(),
    mode: dhi.enum(['overwrite', 'append']).default('overwrite'),
  }),
  dhi.object({
    operation: dhi.literal('delete'),
    path: dhi.string().min(1),
    recursive: dhi.boolean().default(false),
  }),
]);
const zodFileOps = zod.discriminatedUnion('operation', [
  zod.object({
    operation: zod.literal('read'),
    path: zod.string().min(1),
    encoding: zod.enum(['utf8', 'base64', 'binary']).default('utf8'),
  }),
  zod.object({
    operation: zod.literal('write'),
    path: zod.string().min(1),
    content: zod.string(),
    mode: zod.enum(['overwrite', 'append']).default('overwrite'),
  }),
  zod.object({
    operation: zod.literal('delete'),
    path: zod.string().min(1),
    recursive: zod.boolean().default(false),
  }),
]);
const fileOpsData = { operation: 'write' as const, path: '/tmp/test.txt', content: 'Hello!' };
compare('File ops (discriminated union)',
  () => dhiFileOps.safeParse(fileOpsData),
  () => zodFileOps.safeParse(fileOpsData)
);

console.log('');

// ============================================================================
// INVALID INPUT HANDLING (LLM hallucinations)
// ============================================================================
console.log('--- Invalid Input Handling (LLM Hallucinations) ---');

const invalidWeather = { location: '', unit: 'kelvin' }; // Invalid
compare('Weather tool (invalid)',
  () => dhiWeather.safeParse(invalidWeather),
  () => zodWeather.safeParse(invalidWeather)
);

const invalidDbQuery = {
  table: 'invalid_table',
  select: [],
  limit: -5,
};
compare('Database query (invalid)',
  () => dhiDbQuery.safeParse(invalidDbQuery),
  () => zodDbQuery.safeParse(invalidDbQuery),
  200_000
);

const invalidFileOps = { operation: 'copy', path: '' }; // Invalid discriminator
compare('File ops (invalid discriminator)',
  () => dhiFileOps.safeParse(invalidFileOps),
  () => zodFileOps.safeParse(invalidFileOps)
);

console.log('');

// ============================================================================
// BATCH VALIDATION (agent loops)
// ============================================================================
console.log('--- Batch Validation (Agent Loop Simulation) ---');

// Simulate validating 1000 tool calls (typical in long-running agent)
const toolCalls = Array.from({ length: 1000 }, (_, i) => ({
  location: `City ${i}`,
  unit: i % 2 === 0 ? 'celsius' : 'fahrenheit',
}));

const dhiBatchStart = performance.now();
for (const call of toolCalls) {
  dhiWeather.safeParse(call);
}
const dhiBatchTime = performance.now() - dhiBatchStart;

const zodBatchStart = performance.now();
for (const call of toolCalls) {
  zodWeather.safeParse(call);
}
const zodBatchTime = performance.now() - zodBatchStart;

console.log(`  1000 tool calls:  dhi: ${dhiBatchTime.toFixed(2)}ms  zod: ${zodBatchTime.toFixed(2)}ms  ${(zodBatchTime / dhiBatchTime).toFixed(1)}x faster`);

console.log('');

// ============================================================================
// SUMMARY
// ============================================================================
console.log('='.repeat(80));
console.log('');

const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
const validResults = results.filter(r => !r.name.includes('invalid'));
const invalidResults = results.filter(r => r.name.includes('invalid'));

const avgValidSpeedup = validResults.reduce((sum, r) => sum + r.speedup, 0) / validResults.length;
const avgInvalidSpeedup = invalidResults.reduce((sum, r) => sum + r.speedup, 0) / invalidResults.length;

console.log('  SUMMARY - dhi vs Zod for AI Tool Validation');
console.log('  ' + '-'.repeat(50));
console.log(`  Average speedup (all):     ${avgSpeedup.toFixed(1)}x faster`);
console.log(`  Average speedup (valid):   ${avgValidSpeedup.toFixed(1)}x faster`);
console.log(`  Average speedup (invalid): ${avgInvalidSpeedup.toFixed(1)}x faster`);
console.log('');
console.log('  Why this matters for AI agents:');
console.log('  - Faster validation = lower latency per tool call');
console.log('  - Better invalid handling = faster error recovery');
console.log('  - Built-in JSON Schema = no extra dependencies');
console.log('');
console.log('='.repeat(80));
