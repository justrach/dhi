/**
 * Comprehensive benchmark suite comparing DHI against Zod 4 performance claims
 * Based on Zod 4 release notes benchmarks and performance improvements
 */

import { z } from 'zod';
import { object, array } from '../src/typed';
import { string, number, boolean } from '../src/index';

// Benchmark configuration
const ITERATIONS = {
  STRING_PARSING: 1_000_000,
  ARRAY_PARSING: 100_000,
  OBJECT_PARSING: 100_000,
  EMAIL_VALIDATION: 500_000,
  TEMPLATE_LITERALS: 200_000,
  RECURSIVE_OBJECTS: 50_000,
  DISCRIMINATED_UNIONS: 100_000,
  REFINEMENTS: 200_000
};

// Utility functions
function benchmark(name: string, fn: () => void, iterations: number) {
  // Warmup
  for (let i = 0; i < Math.min(1000, iterations / 10); i++) {
    fn();
  }
  
  const times: number[] = [];
  const runs = 5;
  
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    times.push(end - start);
  }
  
  const mean = times.reduce((a, b) => a + b) / times.length;
  const sorted = times.sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const throughput = (iterations / mean) * 1000;
  
  console.log(`📊 ${name}:`);
  console.log(`  Mean: ${mean.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);
  console.log(`  Throughput: ${throughput.toLocaleString()} ops/sec`);
  
  return { mean, p95, throughput };
}

function comparePerformance(dhiResult: any, zodResult: any, testName: string) {
  const speedup = zodResult.mean / dhiResult.mean;
  console.log(`🚀 DHI is ${speedup.toFixed(2)}x ${speedup >= 1 ? 'faster' : 'slower'} than Zod for ${testName}\n`);
  return speedup;
}

console.log('🚀 DHI vs Zod 4 Comprehensive Performance Benchmark Suite\n');

// 1. String Parsing (Zod 4 claims 14x improvement)
console.log('📈 Test 1: String Parsing Performance');
const testString = "hello@example.com";

const dhiStringResult = benchmark('DHI String Parse', () => {
  string().validate(testString);
}, ITERATIONS.STRING_PARSING);

const zodStringResult = benchmark('Zod String Parse', () => {
  z.string().parse(testString);
}, ITERATIONS.STRING_PARSING);

const stringSpeedup = comparePerformance(dhiStringResult, zodStringResult, 'String Parsing');

// 2. Array Parsing (Zod 4 claims 7x improvement)
console.log('📈 Test 2: Array Parsing Performance');
const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const dhiArrayResult = benchmark('DHI Array Parse', () => {
  array(number()).validate(testArray);
}, ITERATIONS.ARRAY_PARSING);

const zodArrayResult = benchmark('Zod Array Parse', () => {
  z.array(z.number()).parse(testArray);
}, ITERATIONS.ARRAY_PARSING);

const arraySpeedup = comparePerformance(dhiArrayResult, zodArrayResult, 'Array Parsing');

// 3. Object Parsing (Zod 4 claims 6.5x improvement)
console.log('📈 Test 3: Object Parsing Performance (Moltar benchmark style)');
const testObject = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  active: true,
  score: 95.5
};

const dhiObjectSchema = object({
  name: string(),
  age: number(),
  email: string(),
  active: boolean(),
  score: number()
});

const zodObjectSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string(),
  active: z.boolean(),
  score: z.number()
});

const dhiObjectResult = benchmark('DHI Object Parse', () => {
  dhiObjectSchema.validate(testObject);
}, ITERATIONS.OBJECT_PARSING);

const zodObjectResult = benchmark('Zod Object Parse', () => {
  zodObjectSchema.parse(testObject);
}, ITERATIONS.OBJECT_PARSING);

const objectSpeedup = comparePerformance(dhiObjectResult, zodObjectResult, 'Object Parsing');

// 4. String Validation Performance (instead of email)
console.log('📈 Test 4: String Validation Performance');
const testStrings = [
  "user@example.com",
  "test.email+tag@domain.co.uk", 
  "invalid-email",
  "another@test.org"
];

const dhiStringValidationResult = benchmark('DHI String Validation', () => {
  for (const str of testStrings) {
    try {
      string().validate(str);
    } catch {}
  }
}, ITERATIONS.EMAIL_VALIDATION / 4);

const zodStringValidationResult = benchmark('Zod String Validation', () => {
  for (const str of testStrings) {
    z.string().safeParse(str);
  }
}, ITERATIONS.EMAIL_VALIDATION / 4);

const stringValidationSpeedup = comparePerformance(dhiStringValidationResult, zodStringValidationResult, 'String Validation');

// 5. Complex Nested Objects (Our specialty!)
console.log('📈 Test 5: Complex Nested Objects Performance');
const complexObject = {
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
    created: "2024-01-01",
    tags: ["important", "user", "active"]
  }
};

const dhiNestedSchema = object({
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

const zodNestedSchema = z.object({
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
});

const dhiNestedResult = benchmark('DHI Nested Object Parse', () => {
  dhiNestedSchema.validate(complexObject);
}, ITERATIONS.OBJECT_PARSING);

const zodNestedResult = benchmark('Zod Nested Object Parse', () => {
  zodNestedSchema.parse(complexObject);
}, ITERATIONS.OBJECT_PARSING);

const nestedSpeedup = comparePerformance(dhiNestedResult, zodNestedResult, 'Nested Objects');

// 6. Union Types Performance
console.log('📈 Test 6: Union Types Performance');
const unionValues = ["string", 42, true, "another"];

const dhiUnionSchema = union([string(), number(), boolean()]);
const zodUnionSchema = z.union([z.string(), z.number(), z.boolean()]);

const dhiUnionResult = benchmark('DHI Union Parse', () => {
  for (const value of unionValues) {
    try {
      dhiUnionSchema.validate(value);
    } catch {}
  }
}, ITERATIONS.DISCRIMINATED_UNIONS / 4);

const zodUnionResult = benchmark('Zod Union Parse', () => {
  for (const value of unionValues) {
    zodUnionSchema.safeParse(value);
  }
}, ITERATIONS.DISCRIMINATED_UNIONS / 4);

const unionSpeedup = comparePerformance(dhiUnionResult, zodUnionResult, 'Union Types');

// 7. Large Array Performance
console.log('📈 Test 7: Large Array Performance');
const largeArray = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  active: i % 2 === 0
}));

const dhiLargeArraySchema = array(object({
  id: number(),
  name: string(),
  active: boolean()
}));

const zodLargeArraySchema = z.array(z.object({
  id: z.number(),
  name: z.string(),
  active: z.boolean()
}));

const dhiLargeArrayResult = benchmark('DHI Large Array Parse', () => {
  dhiLargeArraySchema.validate(largeArray);
}, 1000);

const zodLargeArrayResult = benchmark('Zod Large Array Parse', () => {
  zodLargeArraySchema.parse(largeArray);
}, 1000);

const largeArraySpeedup = comparePerformance(dhiLargeArrayResult, zodLargeArrayResult, 'Large Arrays');

// 8. Mixed Valid/Invalid Data Performance
console.log('📈 Test 8: Mixed Valid/Invalid Data Performance');
const mixedData = [
  { name: "Valid", age: 25 },
  { name: "Invalid", age: "not a number" },
  { name: "Another Valid", age: 30 },
  { name: 123, age: 25 }, // invalid name
  { name: "Valid Again", age: 35 }
];

const dhiMixedSchema = object({
  name: string(),
  age: number()
});

const zodMixedSchema = z.object({
  name: z.string(),
  age: z.number()
});

const dhiMixedResult = benchmark('DHI Mixed Data Validation', () => {
  for (const item of mixedData) {
    try {
      dhiMixedSchema.validate(item);
    } catch {}
  }
}, ITERATIONS.REFINEMENTS / 5);

const zodMixedResult = benchmark('Zod Mixed Data Validation', () => {
  for (const item of mixedData) {
    zodMixedSchema.safeParse(item);
  }
}, ITERATIONS.REFINEMENTS / 5);

const mixedSpeedup = comparePerformance(dhiMixedResult, zodMixedResult, 'Mixed Valid/Invalid Data');

// Summary
console.log('📊 COMPREHENSIVE BENCHMARK SUMMARY');
console.log('================================================================================');
console.log(`String Parsing:           DHI is ${stringSpeedup.toFixed(2)}x ${stringSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Array Parsing:            DHI is ${arraySpeedup.toFixed(2)}x ${arraySpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Object Parsing:           DHI is ${objectSpeedup.toFixed(2)}x ${objectSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Email Validation:         DHI is ${emailSpeedup.toFixed(2)}x ${emailSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Nested Objects:           DHI is ${nestedSpeedup.toFixed(2)}x ${nestedSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Union Types:              DHI is ${unionSpeedup.toFixed(2)}x ${unionSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Large Arrays:             DHI is ${largeArraySpeedup.toFixed(2)}x ${largeArraySpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Mixed Valid/Invalid Data: DHI is ${mixedSpeedup.toFixed(2)}x ${mixedSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);

const allSpeedups = [stringSpeedup, arraySpeedup, objectSpeedup, emailSpeedup, nestedSpeedup, unionSpeedup, largeArraySpeedup, mixedSpeedup];
const averageSpeedup = allSpeedups.reduce((a, b) => a + b) / allSpeedups.length;
const minSpeedup = Math.min(...allSpeedups);
const maxSpeedup = Math.max(...allSpeedups);

console.log(`\n🏆 Average speedup across all scenarios: ${averageSpeedup.toFixed(2)}x`);
console.log(`📊 Speedup range: ${minSpeedup.toFixed(2)}x - ${maxSpeedup.toFixed(2)}x`);

// Performance comparison with Zod 4 claims
console.log('\n🎯 COMPARISON WITH ZOD 4 PERFORMANCE CLAIMS:');
console.log('================================================================================');
console.log('Zod 4 Release Claims vs DHI Performance:');
console.log(`• String parsing: Zod 4 claims 14x improvement, DHI achieves ${stringSpeedup.toFixed(1)}x vs current Zod`);
console.log(`• Array parsing: Zod 4 claims 7x improvement, DHI achieves ${arraySpeedup.toFixed(1)}x vs current Zod`);
console.log(`• Object parsing: Zod 4 claims 6.5x improvement, DHI achieves ${objectSpeedup.toFixed(1)}x vs current Zod`);
console.log(`• Nested objects: Zod 4 no specific claims, DHI achieves ${nestedSpeedup.toFixed(1)}x vs current Zod`);
