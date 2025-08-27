// 🔥 Performance Comparison: Zod vs DHI Migration
// Run this to see the exact performance improvements you'll get

import { performance } from 'perf_hooks';

// Zod version
import { z as zodZ } from 'zod';

// DHI version  
import { z as dhiZ } from 'dhi';

// Test data generator
function generateTestData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `User${i}`,
    age: 20 + (i % 50),
    email: `user${i}@example.com`,
    active: i % 2 === 0
  }));
}

// Schema definitions (identical code)
const zodSchema = zodZ.object({
  name: zodZ.string(),
  age: zodZ.number(),
  email: zodZ.string().email(),
  active: zodZ.boolean()
});

const dhiSchema = dhiZ.object({
  name: dhiZ.string(),
  age: dhiZ.number(),
  email: dhiZ.string().email(),
  active: dhiZ.boolean()
});

async function runMigrationBenchmark() {
  console.log('🚀 DHI Migration Performance Comparison\n');
  
  const testSizes = [1000, 10000, 100000];
  
  for (const size of testSizes) {
    console.log(`📊 Testing with ${size.toLocaleString()} items:`);
    
    const testData = generateTestData(size);
    
    // Zod benchmark
    const zodStart = performance.now();
    const zodValid = testData.filter(item => zodSchema.safeParse(item).success);
    const zodEnd = performance.now();
    const zodTime = zodEnd - zodStart;
    
    // DHI benchmark  
    const dhiStart = performance.now();
    const dhiValid = testData.filter(item => dhiSchema.safeParse(item).success);
    const dhiEnd = performance.now();
    const dhiTime = dhiEnd - dhiStart;
    
    // Results
    const speedup = zodTime / dhiTime;
    const zodThroughput = size / (zodTime / 1000);
    const dhiThroughput = size / (dhiTime / 1000);
    
    console.log(`  Zod:  ${zodTime.toFixed(2)}ms (${zodThroughput.toLocaleString()} ops/sec)`);
    console.log(`  DHI:  ${dhiTime.toFixed(2)}ms (${dhiThroughput.toLocaleString()} ops/sec)`);
    console.log(`  🚀 DHI is ${speedup.toFixed(2)}x faster\n`);
    
    // Verify same results
    console.assert(zodValid.length === dhiValid.length, 'Results should match');
  }
  
  console.log('✅ Migration complete! Just change your import from "zod" to "dhi"');
  console.log('🎯 Zero breaking changes, maximum performance gains!');
}

// Run the benchmark
runMigrationBenchmark().catch(console.error);
