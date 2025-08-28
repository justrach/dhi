import { object, string, number, boolean, optional, type ObjectSchema, type Infer } from '../src/typed';
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

// Allow smaller, quicker runs via environment variables
const ITERATIONS = Number.parseInt(process.env.DHI_BENCH_ITERATIONS || '', 10) || 3;
const BENCH_SIZE = Number.parseInt(process.env.DHI_BENCH_SIZE || '', 10) || 10000;

// Type-safe schema definitions
interface User {
  name: string;
  age: number;
  email: string;
  active: boolean;
}

interface UserOptional {
  name: string;
  age?: number;
  email: string;
  active: boolean;
}

// DHI TypeScript-first schemas with compile-time type checking
const userSchema: ObjectSchema<User> = object({
  name: string(),
  age: number(),
  email: string(),
  active: boolean()
});

const userOptionalSchema: ObjectSchema<UserOptional> = object({
  name: string(),
  age: optional(number()),
  email: string(),
  active: boolean()
});

// Zod schemas for comparison
const zodUserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string(),
  active: z.boolean()
});

const zodUserOptionalSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  email: z.string(),
  active: z.boolean()
});

// Test data generators
function generateUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `User${i}`,
    age: 20 + (i % 50),
    email: `user${i}@example.com`,
    active: i % 2 === 0
  }));
}

function generateUsersOptional(count: number): (UserOptional | { name: string; email: string; active: boolean })[] {
  return Array.from({ length: count }, (_, i) => {
    const base = {
      name: `User${i}`,
      email: `user${i}@example.com`,
      active: i % 2 === 0
    };
    
    // 50% have age, 50% don't
    if (i % 2 === 0) {
      return { ...base, age: 20 + (i % 50) };
    }
    return base;
  });
}

function generateMixedValidInvalid(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    if (i % 4 === 0) return { name: 123, age: "invalid", active: "yes" }; // Invalid
    if (i % 4 === 1) return { name: `User${i}`, age: 25 }; // Missing fields
    if (i % 4 === 2) return { name: `User${i}`, age: 25, active: true, extra: "field" }; // Extra fields
    return { name: `User${i}`, age: 25, email: `user${i}@test.com`, active: true }; // Valid
  });
}

async function runTypedAPIBenchmarks() {
  console.log('🚀 DHI TypeScript-First API Performance Benchmark\n');
  
  const scenarios = [
    {
      name: 'Simple 4-Field Required Schema',
      dataSize: BENCH_SIZE,
      data: generateUsers(BENCH_SIZE),
      dhiSchema: userSchema,
      zodSchema: zodUserSchema
    },
    {
      name: 'Simple 4-Field with Optional',
      dataSize: BENCH_SIZE,
      data: generateUsersOptional(BENCH_SIZE),
      dhiSchema: userOptionalSchema,
      zodSchema: zodUserOptionalSchema
    },
    {
      name: 'Mixed Valid/Invalid Data',
      dataSize: BENCH_SIZE,
      data: generateMixedValidInvalid(BENCH_SIZE),
      dhiSchema: userSchema,
      zodSchema: zodUserSchema
    }
  ];

  const results: any[] = [];

  for (const scenario of scenarios) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    console.log(`📦 Data size: ${scenario.dataSize.toLocaleString()} items`);
    
    // Warmup
    console.log('🔥 Warming up...');
    scenario.dhiSchema.validateBatch(scenario.data.slice(0, 1000));
    scenario.data.slice(0, 1000).map(item => scenario.zodSchema.safeParse(item));
    
    console.log('⚡ Running DHI TypeScript-First API benchmark...');
    const dhiStats = measurePerformance(() => {
      scenario.dhiSchema.validateBatch(scenario.data);
    }, ITERATIONS);
    
    console.log('⚡ Running Zod benchmark...');
    const zodStats = measurePerformance(() => {
      scenario.data.map(item => scenario.zodSchema.safeParse(item));
    }, ITERATIONS);
    
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
        throughput: dhiThroughput
      },
      zod: {
        mean: zodStats.mean,
        median: zodStats.median,
        p95: zodStats.p95,
        p99: zodStats.p99,
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
    console.log(`🚀 DHI TypeScript-First is ${speedupFactor.toFixed(2)}x faster than Zod`);
  }

  // Summary
  console.log('\n\n📊 TYPESCRIPT-FIRST API BENCHMARK SUMMARY');
  console.log('=' .repeat(80));
  
  results.forEach(result => {
    console.log(`\n${result.scenario}:`);
    console.log(`  Data Size: ${result.dataSize.toLocaleString()}`);
    console.log(`  DHI:  ${result.dhi.mean.toFixed(2)}ms (${result.dhi.throughput.toLocaleString()} ops/sec)`);
    console.log(`  Zod:  ${result.zod.mean.toFixed(2)}ms (${result.zod.throughput.toLocaleString()} ops/sec)`);
    console.log(`  Speedup: ${result.speedup.toFixed(2)}x`);
  });
  
  const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
  console.log(`\n🏆 Average speedup across all scenarios: ${avgSpeedup.toFixed(2)}x`);
  
  const minSpeedup = Math.min(...results.map(r => r.speedup));
  const maxSpeedup = Math.max(...results.map(r => r.speedup));
  console.log(`📊 Speedup range: ${minSpeedup.toFixed(2)}x - ${maxSpeedup.toFixed(2)}x`);
  
  return results;
}

// Type checking examples
type InferredUser = Infer<typeof userSchema>; // User
type InferredUserOptional = Infer<typeof userOptionalSchema>; // UserOptional

// Compile-time type safety demonstration
function demonstrateTypeSafety() {
  console.log('\n🔒 TypeScript Compile-Time Type Safety:');
  
  // ✅ This works - schema matches interface
  const validSchema: ObjectSchema<User> = object({
    name: string(),
    age: number(),
    email: string(),
    active: boolean()
  });
  
  // ❌ This would cause a compile-time error:
  // const invalidSchema: ObjectSchema<User> = object({
  //   name: number(), // Type error: number is not assignable to string
  //   age: string(),  // Type error: string is not assignable to number
  // });
  
  console.log('✅ Schema type checking enforced at compile time');
  console.log('✅ Full IntelliSense support for schema definitions');
  console.log('✅ No runtime type mismatches possible');
}

// Run the benchmark
runTypedAPIBenchmarks()
  .then(() => demonstrateTypeSafety())
  .catch(console.error);
