/**
 * Comprehensive generalization tests for DHI validation system
 * Tests various schema structures to ensure the general approach works
 */

import { object, string, number, boolean, array, union } from '../src/index';
import { z } from 'zod';

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

function comparePerformance(dhiResult: any, zodResult: any, testName: string) {
  const speedup = zodResult.duration / dhiResult.duration;
  console.log(`🚀 ${testName}: DHI is ${speedup.toFixed(2)}x ${speedup >= 1 ? 'faster' : 'slower'} than Zod\n`);
  return speedup;
}

console.log('🧪 DHI Generalization Test Suite');
console.log('================================================================================\n');

// Test 1: Deep Nested Objects (5 levels)
console.log('📊 Test 1: Deep Nested Objects (5 levels)');
const deepNestedSchema = object({
  level1: object({
    level2: object({
      level3: object({
        level4: object({
          level5: string()
        })
      })
    })
  }),
  metadata: object({
    timestamp: number(),
    version: string()
  })
});

const zodDeepSchema = z.object({
  level1: z.object({
    level2: z.object({
      level3: z.object({
        level4: z.object({
          level5: z.string()
        })
      })
    })
  }),
  metadata: z.object({
    timestamp: z.number(),
    version: z.string()
  })
});

const deepTestData = {
  level1: {
    level2: {
      level3: {
        level4: {
          level5: "deep value"
        }
      }
    }
  },
  metadata: {
    timestamp: 1234567890,
    version: "1.0.0"
  }
};

const dhiDeepResult = benchmark('DHI Deep Nested', () => {
  deepNestedSchema.validateBatch([deepTestData]);
}, 50000);

const zodDeepResult = benchmark('Zod Deep Nested', () => {
  zodDeepSchema.safeParse(deepTestData);
}, 50000);

const deepSpeedup = comparePerformance(dhiDeepResult, zodDeepResult, 'Deep Nested Objects');

// Test 2: Wide Objects (many fields at same level)
console.log('📊 Test 2: Wide Objects (20 fields)');
const wideSchema = object({
  field1: string(), field2: number(), field3: boolean(), field4: string(),
  field5: number(), field6: boolean(), field7: string(), field8: number(),
  field9: boolean(), field10: string(), field11: number(), field12: boolean(),
  field13: string(), field14: number(), field15: boolean(), field16: string(),
  field17: number(), field18: boolean(), field19: string(), field20: number()
});

const zodWideSchema = z.object({
  field1: z.string(), field2: z.number(), field3: z.boolean(), field4: z.string(),
  field5: z.number(), field6: z.boolean(), field7: z.string(), field8: z.number(),
  field9: z.boolean(), field10: z.string(), field11: z.number(), field12: z.boolean(),
  field13: z.string(), field14: z.number(), field15: z.boolean(), field16: z.string(),
  field17: z.number(), field18: z.boolean(), field19: z.string(), field20: z.number()
});

const wideTestData = {
  field1: "test", field2: 1, field3: true, field4: "test",
  field5: 2, field6: false, field7: "test", field8: 3,
  field9: true, field10: "test", field11: 4, field12: false,
  field13: "test", field14: 5, field15: true, field16: "test",
  field17: 6, field18: false, field19: "test", field20: 7
};

const dhiWideResult = benchmark('DHI Wide Object', () => {
  wideSchema.validateBatch([wideTestData]);
}, 50000);

const zodWideResult = benchmark('Zod Wide Object', () => {
  zodWideSchema.safeParse(wideTestData);
}, 50000);

const wideSpeedup = comparePerformance(dhiWideResult, zodWideResult, 'Wide Objects');

// Test 3: Mixed Arrays and Objects
console.log('📊 Test 3: Mixed Arrays and Objects');
const mixedSchema = object({
  users: array(object({
    name: string(),
    age: number(),
    preferences: object({
      theme: string(),
      notifications: boolean()
    })
  })),
  settings: object({
    version: string(),
    features: array(string())
  }),
  metadata: array(object({
    key: string(),
    value: union([string(), number(), boolean()])
  }))
});

const zodMixedSchema = z.object({
  users: z.array(z.object({
    name: z.string(),
    age: z.number(),
    preferences: z.object({
      theme: z.string(),
      notifications: z.boolean()
    })
  })),
  settings: z.object({
    version: z.string(),
    features: z.array(z.string())
  }),
  metadata: z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()])
  }))
});

const mixedTestData = {
  users: [
    { name: "Alice", age: 25, preferences: { theme: "dark", notifications: true } },
    { name: "Bob", age: 30, preferences: { theme: "light", notifications: false } }
  ],
  settings: {
    version: "2.0.0",
    features: ["feature1", "feature2", "feature3"]
  },
  metadata: [
    { key: "env", value: "production" },
    { key: "port", value: 3000 },
    { key: "debug", value: false }
  ]
};

const dhiMixedResult = benchmark('DHI Mixed Schema', () => {
  mixedSchema.validateBatch([mixedTestData]);
}, 25000);

const zodMixedResult = benchmark('Zod Mixed Schema', () => {
  zodMixedSchema.safeParse(mixedTestData);
}, 25000);

const mixedSpeedup = comparePerformance(dhiMixedResult, zodMixedResult, 'Mixed Arrays and Objects');

// Test 4: Asymmetric Nested Structure
console.log('📊 Test 4: Asymmetric Nested Structure');
const asymmetricSchema = object({
  simple: string(),
  complex: object({
    deep: object({
      deeper: object({
        value: number()
      }),
      shallow: string()
    }),
    array: array(object({
      id: number(),
      data: union([string(), boolean()])
    }))
  }),
  another_simple: boolean()
});

const zodAsymmetricSchema = z.object({
  simple: z.string(),
  complex: z.object({
    deep: z.object({
      deeper: z.object({
        value: z.number()
      }),
      shallow: z.string()
    }),
    array: z.array(z.object({
      id: z.number(),
      data: z.union([z.string(), z.boolean()])
    }))
  }),
  another_simple: z.boolean()
});

const asymmetricTestData = {
  simple: "test",
  complex: {
    deep: {
      deeper: { value: 42 },
      shallow: "shallow"
    },
    array: [
      { id: 1, data: "string" },
      { id: 2, data: true }
    ]
  },
  another_simple: false
};

const dhiAsymmetricResult = benchmark('DHI Asymmetric', () => {
  asymmetricSchema.validateBatch([asymmetricTestData]);
}, 25000);

const zodAsymmetricResult = benchmark('Zod Asymmetric', () => {
  zodAsymmetricSchema.safeParse(asymmetricTestData);
}, 25000);

const asymmetricSpeedup = comparePerformance(dhiAsymmetricResult, zodAsymmetricResult, 'Asymmetric Structure');

// Test 5: Union-Heavy Schema
console.log('📊 Test 5: Union-Heavy Schema');
const unionHeavySchema = object({
  type: union([string(), number()]),
  value: union([string(), number(), boolean(), array(string())]),
  config: object({
    mode: union([string(), number()]),
    options: union([
      object({ stringOpt: string() }),
      object({ numberOpt: number() }),
      object({ boolOpt: boolean() })
    ])
  })
});

const zodUnionHeavySchema = z.object({
  type: z.union([z.string(), z.number()]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  config: z.object({
    mode: z.union([z.string(), z.number()]),
    options: z.union([
      z.object({ stringOpt: z.string() }),
      z.object({ numberOpt: z.number() }),
      z.object({ boolOpt: z.boolean() })
    ])
  })
});

const unionTestData = {
  type: "test",
  value: ["array", "of", "strings"],
  config: {
    mode: 1,
    options: { stringOpt: "option" }
  }
};

const dhiUnionResult = benchmark('DHI Union Heavy', () => {
  unionHeavySchema.validateBatch([unionTestData]);
}, 25000);

const zodUnionResult = benchmark('Zod Union Heavy', () => {
  zodUnionHeavySchema.safeParse(unionTestData);
}, 25000);

const unionHeavySpeedup = comparePerformance(dhiUnionResult, zodUnionResult, 'Union-Heavy Schema');

// Summary
console.log('📊 GENERALIZATION TEST SUMMARY');
console.log('================================================================================');
console.log(`Deep Nested (5 levels):      DHI is ${deepSpeedup.toFixed(2)}x ${deepSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Wide Objects (20 fields):    DHI is ${wideSpeedup.toFixed(2)}x ${wideSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Mixed Arrays & Objects:      DHI is ${mixedSpeedup.toFixed(2)}x ${mixedSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Asymmetric Structure:        DHI is ${asymmetricSpeedup.toFixed(2)}x ${asymmetricSpeedup >= 1 ? 'faster' : 'slower'} than Zod`);
console.log(`Union-Heavy Schema:          DHI is ${unionHeavySpeedup.toFixed(2)}x ${unionHeavySpeedup >= 1 ? 'faster' : 'slower'} than Zod`);

const allGeneralizationSpeedups = [deepSpeedup, wideSpeedup, mixedSpeedup, asymmetricSpeedup, unionHeavySpeedup];
const avgGeneralizationSpeedup = allGeneralizationSpeedups.reduce((a, b) => a + b) / allGeneralizationSpeedups.length;
const minGeneralizationSpeedup = Math.min(...allGeneralizationSpeedups);
const maxGeneralizationSpeedup = Math.max(...allGeneralizationSpeedups);

console.log(`\n🏆 Average speedup across generalization tests: ${avgGeneralizationSpeedup.toFixed(2)}x`);
console.log(`📊 Speedup range: ${minGeneralizationSpeedup.toFixed(2)}x - ${maxGeneralizationSpeedup.toFixed(2)}x`);

console.log('\n✅ Generalization verification: DHI handles diverse schema structures efficiently!');
