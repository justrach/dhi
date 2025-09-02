import { object, string, number, boolean, array, createHybridValidator, dhi } from '../src/index';
import { z } from 'zod';

// Performance measurement utilities
function measurePerformance(fn: () => void, iterations: number = 10): {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
} {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];
  
  const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, median, p95, p99, min, max, stdDev };
}

// Test data generators
function generateSimpleUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `User${i}`,
    age: 20 + (i % 50),
    email: `user${i}@example.com`,
    active: i % 2 === 0
  }));
}

function generateNestedData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    user: {
      name: `User${i}`,
      profile: {
        age: 20 + (i % 50),
        preferences: {
          theme: i % 2 === 0 ? 'dark' : 'light',
          notifications: true
        }
      }
    },
    metadata: {
      created: new Date().toISOString(),
      tags: [`tag${i % 5}`, `category${i % 3}`]
    }
  }));
}

function generateArrayHeavyData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    scores: Array.from({ length: 10 }, (_, j) => i + j),
    tags: Array.from({ length: 5 }, (_, j) => `tag${i + j}`),
    matrix: Array.from({ length: 3 }, () => 
      Array.from({ length: 3 }, (_, k) => k + i)
    )
  }));
}

function generateMixedInvalidData(count: number) {
  return Array.from({ length: count }, (_, i) => {
    if (i % 4 === 0) return { name: 123, age: "invalid", active: "yes" }; // Invalid
    if (i % 4 === 1) return { name: `User${i}`, age: 25 }; // Missing fields
    if (i % 4 === 2) return { name: `User${i}`, age: 25, active: true, extra: "field" }; // Extra fields
    return { name: `User${i}`, age: 25, active: true }; // Valid
  });
}

async function runComprehensiveBenchmarks() {
  console.log('🚀 DHI Comprehensive Performance Benchmark Suite\n');
  
  // Test scenarios
  const scenarios = [
    {
      name: 'Simple 4-Field Schema (Current benchmark2.ts)',
      dataSize: 1000000,
      generator: generateSimpleUsers,
      dhiSchema: object({
        name: string(),
        age: number(),
        email: string(),
        active: boolean()
      }),
      buildWasm: async () => {
        const s = await dhi.string();
        const n = await dhi.number();
        const b = await dhi.boolean();
        const e = await dhi.string();
        return await dhi.object({ name: s, age: n, email: e, active: b });
      },
      zodSchema: z.object({
        name: z.string(),
        age: z.number(),
        email: z.string(),
        active: z.boolean()
      })
    },
    {
      name: 'Nested Object Schema',
      dataSize: 100000,
      generator: generateNestedData,
      dhiSchema: object({
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
      }),
      buildWasm: async () => {
        const id = await dhi.number();
        const name = await dhi.string();
        const age = await dhi.number();
        const theme = await dhi.string();
        const notifications = await dhi.boolean();
        const created = await dhi.string();
        const tag = await dhi.string();
        const tags = await dhi.array(tag);
        const prefs = await dhi.object({ theme, notifications });
        const profile = await dhi.object({ age, preferences: prefs });
        const user = await dhi.object({ name, profile });
        const metadata = await dhi.object({ created, tags });
        return await dhi.object({ id, user, metadata });
      },
      zodSchema: z.object({
        id: z.number(),
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            preferences: z.object({
              theme: z.string(),
              notifications: z.boolean()
            })
          })
        }),
        metadata: z.object({
          created: z.string(),
          tags: z.array(z.string())
        })
      })
    },
    {
      name: 'Array-Heavy Schema',
      dataSize: 50000,
      generator: generateArrayHeavyData,
      dhiSchema: object({
        id: number(),
        scores: array(number()),
        tags: array(string()),
        matrix: array(array(number()))
      }),
      buildWasm: async () => {
        const id = await dhi.number();
        const num = await dhi.number();
        const str = await dhi.string();
        const arrNum = await dhi.array(num);
        const arrStr = await dhi.array(str);
        const arrArrNum = await dhi.array(arrNum);
        return await dhi.object({ id, scores: arrNum, tags: arrStr, matrix: arrArrNum });
      },
      zodSchema: z.object({
        id: z.number(),
        scores: z.array(z.number()),
        tags: z.array(z.string()),
        matrix: z.array(z.array(z.number()))
      })
    },
    {
      name: 'Mixed Valid/Invalid Data',
      dataSize: 500000,
      generator: generateMixedInvalidData,
      dhiSchema: object({
        name: string(),
        age: number(),
        active: boolean()
      }),
      buildWasm: async () => {
        const name = await dhi.string();
        const age = await dhi.number();
        const active = await dhi.boolean();
        return await dhi.object({ name, age, active });
      },
      zodSchema: z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean()
      })
    }
  ];

  const results: any[] = [];

  for (const scenario of scenarios) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    console.log(`📦 Data size: ${scenario.dataSize.toLocaleString()} items`);
    
    const testData = scenario.generator(scenario.dataSize);
    
    // Warmup
    console.log('🔥 Warming up...');
    scenario.dhiSchema.validateBatch(testData.slice(0, 1000));
    testData.slice(0, 1000).map(item => scenario.zodSchema.safeParse(item));
    
    const wasmSchema = await scenario.buildWasm?.();

    console.log('⚡ Running DHI (typed) benchmark...');
    const dhiStats = measurePerformance(() => {
      scenario.dhiSchema.validateBatch(testData);
    }, 10);

    let wasmStats: any | null = null;
    let hybridStats: any | null = null;
    if (wasmSchema) {
      console.log('⚡ Running DHI (WASM) benchmark...');
      wasmStats = measurePerformance(() => {
        wasmSchema.validate_batch(testData);
      }, 10);

      console.log('⚡ Running Hybrid benchmark...');
      const hybrid = createHybridValidator(scenario.dhiSchema as any, wasmSchema as any, { threshold: 0.3, sample: 200 });
      hybridStats = measurePerformance(() => {
        hybrid.validateBatch(testData);
      }, 10);
    }

    console.log('⚡ Running Zod benchmark...');
    const zodStats = measurePerformance(() => {
      testData.map(item => scenario.zodSchema.safeParse(item));
    }, 10);
    
    const dhiThroughput = scenario.dataSize / (dhiStats.mean / 1000);
    const zodThroughput = scenario.dataSize / (zodStats.mean / 1000);
    const speedupFactor = dhiThroughput / zodThroughput;
    const wasmThroughput = wasmStats ? scenario.dataSize / (wasmStats.mean / 1000) : null;
    const hybridThroughput = hybridStats ? scenario.dataSize / (hybridStats.mean / 1000) : null;
    
    const result = {
      scenario: scenario.name,
      dataSize: scenario.dataSize,
      dhi: {
        mean: dhiStats.mean,
        median: dhiStats.median,
        p95: dhiStats.p95,
        p99: dhiStats.p99,
        min: dhiStats.min,
        max: dhiStats.max,
        stdDev: dhiStats.stdDev,
        throughput: dhiThroughput
      },
      zod: {
        mean: zodStats.mean,
        median: zodStats.median,
        p95: zodStats.p95,
        p99: zodStats.p99,
        min: zodStats.min,
        max: zodStats.max,
        stdDev: zodStats.stdDev,
        throughput: zodThroughput
      },
      wasm: wasmStats && {
        mean: wasmStats.mean,
        median: wasmStats.median,
        p95: wasmStats.p95,
        p99: wasmStats.p99,
        min: wasmStats.min,
        max: wasmStats.max,
        stdDev: wasmStats.stdDev,
        throughput: wasmThroughput
      },
      hybrid: hybridStats && {
        mean: hybridStats.mean,
        median: hybridStats.median,
        p95: hybridStats.p95,
        p99: hybridStats.p99,
        min: hybridStats.min,
        max: hybridStats.max,
        stdDev: hybridStats.stdDev,
        throughput: hybridThroughput
      },
      speedup: speedupFactor
    };
    
    results.push(result);
    
    console.log(`\n📈 Results for ${scenario.name}:`);
    console.log(`DHI (typed)  - Mean: ${dhiStats.mean.toFixed(2)}ms, P95: ${dhiStats.p95.toFixed(2)}ms, P99: ${dhiStats.p99.toFixed(2)}ms`);
    if (wasmStats) console.log(`DHI (WASM)   - Mean: ${wasmStats.mean.toFixed(2)}ms, P95: ${wasmStats.p95.toFixed(2)}ms, P99: ${wasmStats.p99.toFixed(2)}ms`);
    if (hybridStats) console.log(`Hybrid       - Mean: ${hybridStats.mean.toFixed(2)}ms, P95: ${hybridStats.p95.toFixed(2)}ms, P99: ${hybridStats.p99.toFixed(2)}ms`);
    console.log(`Zod  - Mean: ${zodStats.mean.toFixed(2)}ms, P95: ${zodStats.p95.toFixed(2)}ms, P99: ${zodStats.p99.toFixed(2)}ms`);
    console.log(`DHI (typed) Throughput: ${dhiThroughput.toLocaleString()} validations/sec`);
    if (wasmStats) console.log(`DHI (WASM)  Throughput: ${wasmThroughput!.toLocaleString()} validations/sec`);
    if (hybridStats) console.log(`Hybrid      Throughput: ${hybridThroughput!.toLocaleString()} validations/sec`);
    console.log(`Zod Throughput: ${zodThroughput.toLocaleString()} validations/sec`);
    console.log(`🚀 DHI is ${speedupFactor.toFixed(2)}x faster than Zod`);
  }

  // Summary
  console.log('\n\n📊 COMPREHENSIVE BENCHMARK SUMMARY');
  console.log('=' .repeat(80));
  
  results.forEach(result => {
    console.log(`\n${result.scenario}:`);
    console.log(`  Data Size: ${result.dataSize.toLocaleString()}`);
    console.log(`  DHI (typed): ${result.dhi.mean.toFixed(2)}ms ± ${result.dhi.stdDev.toFixed(2)}ms (${result.dhi.throughput.toLocaleString()} ops/sec)`);
    if (result.wasm) console.log(`  DHI (WASM): ${result.wasm.mean.toFixed(2)}ms ± ${result.wasm.stdDev.toFixed(2)}ms (${result.wasm.throughput.toLocaleString()} ops/sec)`);
    if (result.hybrid) console.log(`  Hybrid:     ${result.hybrid.mean.toFixed(2)}ms ± ${result.hybrid.stdDev.toFixed(2)}ms (${result.hybrid.throughput.toLocaleString()} ops/sec)`);
    console.log(`  Zod:        ${result.zod.mean.toFixed(2)}ms ± ${result.zod.stdDev.toFixed(2)}ms (${result.zod.throughput.toLocaleString()} ops/sec)`);
    console.log(`  Speedup: ${result.speedup.toFixed(2)}x`);
  });
  
  const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
  console.log(`\n🏆 Average speedup across all scenarios: ${avgSpeedup.toFixed(2)}x`);
  
  const minSpeedup = Math.min(...results.map(r => r.speedup));
  const maxSpeedup = Math.max(...results.map(r => r.speedup));
  console.log(`📊 Speedup range: ${minSpeedup.toFixed(2)}x - ${maxSpeedup.toFixed(2)}x`);
  
  return results;
}

// Run the comprehensive benchmark
runComprehensiveBenchmarks().catch(console.error);
