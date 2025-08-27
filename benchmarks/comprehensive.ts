import { createType } from '../src/index';
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
      dhiSchema: await (async () => {
        const tStr = await createType<string>(); tStr.string();
        const tNum = await createType<number>(); tNum.number();
        const tBool = await createType<boolean>(); tBool.boolean();
        return (await createType<any>()).object({
          name: tStr,
          age: tNum,
          email: tStr,
          active: tBool
        });
      })(),
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
      dhiSchema: await (async () => {
        const tNum = await createType<number>(); tNum.number();
        const tStr = await createType<string>(); tStr.string();
        const tBool = await createType<boolean>(); tBool.boolean();

        const tPreferences = (await createType<any>()).object({
          theme: tStr,
          notifications: tBool
        });

        const tProfile = (await createType<any>()).object({
          age: tNum,
          preferences: tPreferences
        });

        const tUser = (await createType<any>()).object({
          name: tStr,
          profile: tProfile
        });

        const tId = await createType<number>(); tId.number();
        const tTags = (await createType<any>()).array(tStr);
        const tMetadata = (await createType<any>()).object({
          created: tStr,
          tags: tTags
        });

        return (await createType<any>()).object({
          id: tId,
          user: tUser,
          metadata: tMetadata
        });
      })(),
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
      dhiSchema: await (async () => {
        const tId = await createType<number>(); tId.number();
        const tNum = await createType<number>(); tNum.number();
        const tStr = await createType<string>(); tStr.string();
        const tScores = (await createType<any>()).array(tNum);
        const tTags = (await createType<any>()).array(tStr);
        const tMatrix = (await createType<any>()).array((await createType<any>()).array(tNum));
        return (await createType<any>()).object({
          id: tId,
          scores: tScores,
          tags: tTags,
          matrix: tMatrix
        });
      })(),
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
      dhiSchema: await (async () => {
        const tStr = await createType<string>(); tStr.string();
        const tNum = await createType<number>(); tNum.number();
        const tBool = await createType<boolean>(); tBool.boolean();
        return (await createType<any>()).object({
          name: tStr,
          age: tNum,
          active: tBool
        });
      })(),
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
    scenario.dhiSchema.validate_batch(testData.slice(0, 1000));
    testData.slice(0, 1000).map(item => scenario.zodSchema.safeParse(item));
    
    console.log('⚡ Running DHI benchmark...');
    const dhiStats = measurePerformance(() => {
      scenario.dhiSchema.validate_batch(testData);
    }, 10);
    
    console.log('⚡ Running Zod benchmark...');
    const zodStats = measurePerformance(() => {
      testData.map(item => scenario.zodSchema.safeParse(item));
    }, 10);
    
    const dhiThroughput = scenario.dataSize / (dhiStats.mean / 1000);
    const zodThroughput = scenario.dataSize / (zodStats.mean / 1000);
    const speedupFactor = dhiThroughput / zodThroughput;
    
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
      speedup: speedupFactor
    };
    
    results.push(result);
    
    console.log(`\n📈 Results for ${scenario.name}:`);
    console.log(`DHI  - Mean: ${dhiStats.mean.toFixed(2)}ms, P95: ${dhiStats.p95.toFixed(2)}ms, P99: ${dhiStats.p99.toFixed(2)}ms`);
    console.log(`Zod  - Mean: ${zodStats.mean.toFixed(2)}ms, P95: ${zodStats.p95.toFixed(2)}ms, P99: ${zodStats.p99.toFixed(2)}ms`);
    console.log(`DHI Throughput: ${dhiThroughput.toLocaleString()} validations/sec`);
    console.log(`Zod Throughput: ${zodThroughput.toLocaleString()} validations/sec`);
    console.log(`🚀 DHI is ${speedupFactor.toFixed(2)}x faster than Zod`);
  }

  // Summary
  console.log('\n\n📊 COMPREHENSIVE BENCHMARK SUMMARY');
  console.log('=' .repeat(80));
  
  results.forEach(result => {
    console.log(`\n${result.scenario}:`);
    console.log(`  Data Size: ${result.dataSize.toLocaleString()}`);
    console.log(`  DHI:  ${result.dhi.mean.toFixed(2)}ms ± ${result.dhi.stdDev.toFixed(2)}ms (${result.dhi.throughput.toLocaleString()} ops/sec)`);
    console.log(`  Zod:  ${result.zod.mean.toFixed(2)}ms ± ${result.zod.stdDev.toFixed(2)}ms (${result.zod.throughput.toLocaleString()} ops/sec)`);
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
