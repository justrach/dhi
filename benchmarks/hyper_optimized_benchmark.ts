/**
 * Benchmark the new hyper-optimized TypeScript implementation
 */

import { object, string, number, boolean, array } from '../src/index';

// Benchmark helper
function benchmark(name: string, fn: () => void, iterations: number = 100000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const duration = end - start;
  const opsPerSec = (iterations / duration) * 1000;
  
  console.log(`${name}: ${duration.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
  return { duration, opsPerSec };
}

async function runHyperOptimizedBenchmarks() {
  console.log('🚀 DHI Hyper-Optimized TypeScript Benchmark Suite');
  console.log('================================================================================\n');

  // Test 1: Simple 4-Field Schema (the benchmark2.ts case)
  console.log('📊 Test 1: Simple 4-Field Schema (Hyper-Optimized)');
  
  const simpleSchema = object({
    id: number(),
    name: string(),
    active: boolean(),
    score: number()
  });

  const simpleTestData = Array(100000).fill({
    id: 1,
    name: "test",
    active: true,
    score: 95.5
  });

  const simpleResult = benchmark('DHI Hyper-Optimized Simple Schema', () => {
    simpleSchema.validateBatch(simpleTestData);
  }, 10);

  // Test 2: Nested Object Schema
  console.log('\n📊 Test 2: Nested Object Schema (Hyper-Optimized)');
  
  const nestedSchema = object({
    id: number(),
    user: object({
      name: string(),
      profile: object({
        age: number(),
        preferences: object({
          theme: string(),
          notifications: boolean()
        })
      })
    }),
    metadata: object({
      created: string(),
      tags: array(string())
    })
  });

  const nestedTestData = Array(50000).fill({
    id: 1,
    user: {
      name: "Alice",
      profile: {
        age: 28,
        preferences: {
          theme: "dark",
          notifications: true
        }
      }
    },
    metadata: {
      created: "2023-01-01",
      tags: ["user", "premium"]
    }
  });

  const nestedResult = benchmark('DHI Hyper-Optimized Nested Schema', () => {
    nestedSchema.validateBatch(nestedTestData);
  }, 10);

  // Test 3: Array-Heavy Schema
  console.log('\n📊 Test 3: Array-Heavy Schema (Hyper-Optimized)');
  
  const arraySchema = object({
    items: array(object({
      id: number(),
      name: string(),
      active: boolean()
    })),
    tags: array(string()),
    scores: array(number())
  });

  const arrayTestData = Array(25000).fill({
    items: [
      { id: 1, name: "item1", active: true },
      { id: 2, name: "item2", active: false },
      { id: 3, name: "item3", active: true }
    ],
    tags: ["tag1", "tag2", "tag3"],
    scores: [95, 87, 92]
  });

  const arrayResult = benchmark('DHI Hyper-Optimized Array Schema', () => {
    arraySchema.validateBatch(arrayTestData);
  }, 10);

  // Test 4: Large Batch Processing
  console.log('\n📊 Test 4: Large Batch Processing (1M items)');
  
  const largeBatchData = Array(1000000).fill({
    id: 1,
    name: "test",
    active: true,
    score: 95.5
  });

  const largeBatchResult = benchmark('DHI Hyper-Optimized Large Batch', () => {
    simpleSchema.validateBatch(largeBatchData.slice(0, 10000)); // Process 10K at a time
  }, 10);

  // Summary
  console.log('\n📊 HYPER-OPTIMIZED TYPESCRIPT BENCHMARK SUMMARY');
  console.log('================================================================================');
  console.log(`Simple Schema (100K items):   ${simpleResult.opsPerSec.toLocaleString()} ops/sec`);
  console.log(`Nested Schema (50K items):    ${nestedResult.opsPerSec.toLocaleString()} ops/sec`);
  console.log(`Array Schema (25K items):     ${arrayResult.opsPerSec.toLocaleString()} ops/sec`);
  console.log(`Large Batch (10K items):      ${largeBatchResult.opsPerSec.toLocaleString()} ops/sec`);

  console.log('\n🚀 Hyper-optimized TypeScript validation complete!');
  console.log('💡 Performance improvements from:');
  console.log('   • Pre-compiled validators (zero function call overhead)');
  console.log('   • Increased batch sizes (16 → 64 for better memory bandwidth)');
  console.log('   • Unrolled loops (4-8 items at once for instruction-level parallelism)');
  console.log('   • Memory prefetching (touch next batch for better cache performance)');
  console.log('   • Inline validation (direct type checks without function calls)');
  console.log('   • Early exit optimization (stop on first validation failure)');
}

// Run benchmarks
runHyperOptimizedBenchmarks().catch(error => {
  console.error('Hyper-optimized benchmark failed:', error);
});
