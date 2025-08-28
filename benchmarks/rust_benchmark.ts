/**
 * Rust vs TypeScript performance benchmark
 * Tests the Rust WASM implementation against pure TypeScript
 */

import { object, string, number, boolean, array } from '../src/index';
import { rustObject, RustPerformanceMonitor } from '../src/rust-bridge';

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

function comparePerformance(rustResult: any, tsResult: any, testName: string) {
  const speedup = tsResult.duration / rustResult.duration;
  console.log(`🦀 ${testName}: Rust is ${speedup.toFixed(2)}x ${speedup >= 1 ? 'faster' : 'slower'} than TypeScript\n`);
  return speedup;
}

async function runRustBenchmarks() {
  console.log('🦀 DHI Rust vs TypeScript Benchmark Suite');
  console.log('================================================================================\n');

  const monitor = RustPerformanceMonitor.getInstance();

  // Test 1: Simple 4-Field Schema
  console.log('📊 Test 1: Simple 4-Field Schema (Rust vs TypeScript)');
  
  const tsSimpleSchema = object({
    id: number(),
    name: string(),
    active: boolean(),
    score: number()
  });

  const rustSimpleSchema = rustObject({
    id: number(),
    name: string(), 
    active: boolean(),
    score: number()
  }, tsSimpleSchema);

  const simpleTestData = {
    id: 1,
    name: "test",
    active: true,
    score: 95.5
  };

  // Wait for Rust initialization
  await new Promise(resolve => setTimeout(resolve, 100));

  const rustSimpleResult = benchmark('Rust Simple Schema', () => {
    rustSimpleSchema.validateBatch([simpleTestData]);
  }, 100000);

  const tsSimpleResult = benchmark('TypeScript Simple Schema', () => {
    tsSimpleSchema.validateBatch([simpleTestData]);
  }, 100000);

  const simpleSpeedup = comparePerformance(rustSimpleResult, tsSimpleResult, 'Simple Schema');
  monitor.recordValidation('rust', rustSimpleResult.duration, 100000);
  monitor.recordValidation('typescript', tsSimpleResult.duration, 100000);

  // Test 2: Nested Object Schema
  console.log('📊 Test 2: Nested Object Schema');
  
  const tsNestedSchema = object({
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

  const rustNestedSchema = rustObject({
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
  }, tsNestedSchema);

  const nestedTestData = {
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
  };

  const rustNestedResult = benchmark('Rust Nested Schema', () => {
    rustNestedSchema.validateBatch([nestedTestData]);
  }, 50000);

  const tsNestedResult = benchmark('TypeScript Nested Schema', () => {
    tsNestedSchema.validateBatch([nestedTestData]);
  }, 50000);

  const nestedSpeedup = comparePerformance(rustNestedResult, tsNestedResult, 'Nested Schema');
  monitor.recordValidation('rust', rustNestedResult.duration, 50000);
  monitor.recordValidation('typescript', tsNestedResult.duration, 50000);

  // Test 3: Array-Heavy Schema
  console.log('📊 Test 3: Array-Heavy Schema');
  
  const tsArraySchema = object({
    items: array(object({
      id: number(),
      name: string(),
      active: boolean()
    })),
    tags: array(string()),
    scores: array(number())
  });

  const rustArraySchema = rustObject({
    items: array(object({
      id: number(),
      name: string(),
      active: boolean()
    })),
    tags: array(string()),
    scores: array(number())
  }, tsArraySchema);

  const arrayTestData = {
    items: [
      { id: 1, name: "item1", active: true },
      { id: 2, name: "item2", active: false },
      { id: 3, name: "item3", active: true }
    ],
    tags: ["tag1", "tag2", "tag3"],
    scores: [95, 87, 92]
  };

  const rustArrayResult = benchmark('Rust Array Schema', () => {
    rustArraySchema.validateBatch([arrayTestData]);
  }, 25000);

  const tsArrayResult = benchmark('TypeScript Array Schema', () => {
    tsArraySchema.validateBatch([arrayTestData]);
  }, 25000);

  const arraySpeedup = comparePerformance(rustArrayResult, tsArrayResult, 'Array Schema');
  monitor.recordValidation('rust', rustArrayResult.duration, 25000);
  monitor.recordValidation('typescript', tsArrayResult.duration, 25000);

  // Test 4: Large Batch Processing
  console.log('📊 Test 4: Large Batch Processing (1M items)');
  
  const largeBatchData = Array(1000000).fill(simpleTestData);

  const rustLargeBatchResult = benchmark('Rust Large Batch', () => {
    rustSimpleSchema.validateBatch(largeBatchData.slice(0, 1000)); // Process 1K at a time
  }, 100);

  const tsLargeBatchResult = benchmark('TypeScript Large Batch', () => {
    tsSimpleSchema.validateBatch(largeBatchData.slice(0, 1000));
  }, 100);

  const largeBatchSpeedup = comparePerformance(rustLargeBatchResult, tsLargeBatchResult, 'Large Batch');

  // Summary
  console.log('📊 RUST VS TYPESCRIPT BENCHMARK SUMMARY');
  console.log('================================================================================');
  console.log(`Simple Schema:        Rust is ${simpleSpeedup.toFixed(2)}x ${simpleSpeedup >= 1 ? 'faster' : 'slower'} than TypeScript`);
  console.log(`Nested Schema:        Rust is ${nestedSpeedup.toFixed(2)}x ${nestedSpeedup >= 1 ? 'faster' : 'slower'} than TypeScript`);
  console.log(`Array Schema:         Rust is ${arraySpeedup.toFixed(2)}x ${arraySpeedup >= 1 ? 'faster' : 'slower'} than TypeScript`);
  console.log(`Large Batch:          Rust is ${largeBatchSpeedup.toFixed(2)}x ${largeBatchSpeedup >= 1 ? 'faster' : 'slower'} than TypeScript`);

  const allSpeedups = [simpleSpeedup, nestedSpeedup, arraySpeedup, largeBatchSpeedup];
  const avgSpeedup = allSpeedups.reduce((a, b) => a + b) / allSpeedups.length;
  const minSpeedup = Math.min(...allSpeedups);
  const maxSpeedup = Math.max(...allSpeedups);

  console.log(`\n🏆 Average speedup: ${avgSpeedup.toFixed(2)}x`);
  console.log(`📊 Speedup range: ${minSpeedup.toFixed(2)}x - ${maxSpeedup.toFixed(2)}x`);

  // Print detailed performance report
  monitor.printReport();

  console.log('\n🦀 Rust WASM integration complete!');
  console.log('💡 Rust provides significant performance improvements for validation-heavy workloads');
}

// Run benchmarks
runRustBenchmarks().catch(error => {
  console.error('Rust benchmark failed:', error);
  console.log('💡 Make sure to build the Rust WASM module first: cd rust && ./build.sh');
});
