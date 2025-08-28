import { object, string, number, boolean, array, union } from '../src/typed_optimized';
import { z } from 'zod';

// TARGETED BENCHMARK: Mixed Arrays & Objects, Asymmetric Structure, Union-Heavy Schemas

// Mixed Arrays & Objects Schema (DHI currently 0.25x slower)
const mixedArrayObjectDHI = object({
  id: string(),
  tags: array(union([string(), number()])),
  metadata: object({
    created: number(),
    flags: array(boolean()),
    nested: object({
      values: array(union([string(), number(), boolean()]))
    })
  })
});

const mixedArrayObjectZod = z.object({
  id: z.string(),
  tags: z.array(z.union([z.string(), z.number()])),
  metadata: z.object({
    created: z.number(),
    flags: z.array(z.boolean()),
    nested: z.object({
      values: z.array(z.union([z.string(), z.number(), z.boolean()]))
    })
  })
});

// Asymmetric Structure Schema (DHI currently 0.21x slower)
const asymmetricStructureDHI = object({
  // Simple primitive fields
  id: string(),
  active: boolean(),
  count: number(),
  
  // Complex nested structure
  profile: object({
    user: object({
      name: string(),
      settings: object({
        theme: union([string(), boolean()]),
        notifications: array(object({
          type: string(),
          enabled: boolean(),
          config: union([string(), number(), object({
            advanced: boolean(),
            rules: array(string())
          })])
        }))
      })
    })
  }),
  
  // Mixed complexity
  permissions: array(union([string(), object({
    role: string(),
    scope: array(string())
  })]))
});

const asymmetricStructureZod = z.object({
  id: z.string(),
  active: z.boolean(),
  count: z.number(),
  profile: z.object({
    user: z.object({
      name: z.string(),
      settings: z.object({
        theme: z.union([z.string(), z.boolean()]),
        notifications: z.array(z.object({
          type: z.string(),
          enabled: z.boolean(),
          config: z.union([z.string(), z.number(), z.object({
            advanced: z.boolean(),
            rules: z.array(z.string())
          })])
        }))
      })
    })
  }),
  permissions: z.array(z.union([z.string(), z.object({
    role: z.string(),
    scope: z.array(z.string())
  })]))
});

// Union-Heavy Schema (DHI currently 0.20x slower)
const unionHeavyDHI = object({
  data: union([
    string(),
    number(),
    boolean(),
    array(string()),
    array(number()),
    object({
      type: string(),
      value: union([string(), number(), boolean()])
    }),
    object({
      nested: object({
        deep: union([
          string(),
          array(union([string(), number()])),
          object({
            final: union([string(), number(), boolean(), array(string())])
          })
        ])
      })
    })
  ]),
  fallback: union([
    string(),
    number(),
    object({
      alt: union([boolean(), array(string()), number()])
    })
  ])
});

const unionHeavyZod = z.object({
  data: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.object({
      type: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()])
    }),
    z.object({
      nested: z.object({
        deep: z.union([
          z.string(),
          z.array(z.union([z.string(), z.number()])),
          z.object({
            final: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
          })
        ])
      })
    })
  ]),
  fallback: z.union([
    z.string(),
    z.number(),
    z.object({
      alt: z.union([z.boolean(), z.array(z.string()), z.number()])
    })
  ])
});

// Test data generators
function generateMixedArrayObjectData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    tags: [
      `tag-${i}`,
      i * 2,
      `category-${i % 5}`,
      i % 3
    ],
    metadata: {
      created: Date.now() + i,
      flags: [true, false, i % 2 === 0],
      nested: {
        values: [`val-${i}`, i, i % 2 === 0, `nested-${i % 3}`]
      }
    }
  }));
}

function generateAsymmetricStructureData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i}`,
    active: i % 2 === 0,
    count: i * 10,
    profile: {
      user: {
        name: `User ${i}`,
        settings: {
          theme: i % 3 === 0 ? "dark" : true,
          notifications: [
            {
              type: "email",
              enabled: true,
              config: i % 4 === 0 ? "daily" : {
                advanced: true,
                rules: [`rule-${i}`, `filter-${i % 3}`]
              }
            }
          ]
        }
      }
    },
    permissions: i % 2 === 0 ? ["read", "write"] : [
      {
        role: "admin",
        scope: [`scope-${i}`, "global"]
      }
    ]
  }));
}

function generateUnionHeavyData(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const dataVariants = [
      `string-${i}`,
      i * 100,
      i % 2 === 0,
      [`array-${i}`, `item-${i % 3}`],
      [i, i + 1, i + 2],
      {
        type: "object",
        value: i % 3 === 0 ? `val-${i}` : i
      },
      {
        nested: {
          deep: i % 4 === 0 ? `deep-${i}` : {
            final: i % 5 === 0 ? [`final-${i}`] : i
          }
        }
      }
    ];
    
    const fallbackVariants = [
      `fallback-${i}`,
      i * 50,
      {
        alt: i % 3 === 0 ? true : [`alt-${i}`]
      }
    ];
    
    return {
      data: dataVariants[i % dataVariants.length],
      fallback: fallbackVariants[i % fallbackVariants.length]
    };
  });
}

// Benchmark runner
async function runOptimizationBenchmarks() {
  console.log('🚀 DHI Optimization Benchmarks - Targeting Performance Gaps\n');
  
  const batchSizes = [1000, 10000, 100000];
  
  for (const batchSize of batchSizes) {
    console.log(`\n📊 Batch Size: ${batchSize.toLocaleString()}`);
    console.log('='.repeat(50));
    
    // Mixed Arrays & Objects Benchmark
    console.log('\n🔄 Mixed Arrays & Objects (Target: 4x improvement)');
    const mixedData = generateMixedArrayObjectData(batchSize);
    
    const mixedDHIStart = performance.now();
    const mixedDHIResults = mixedArrayObjectDHI.validateBatch(mixedData);
    const mixedDHITime = performance.now() - mixedDHIStart;
    
    const mixedZodStart = performance.now();
    const mixedZodResults = mixedData.map(item => mixedArrayObjectZod.safeParse(item).success);
    const mixedZodTime = performance.now() - mixedZodStart;
    
    const mixedSpeedup = mixedZodTime / mixedDHITime;
    console.log(`  DHI: ${mixedDHITime.toFixed(2)}ms | Zod: ${mixedZodTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${mixedSpeedup.toFixed(2)}x ${mixedSpeedup >= 1 ? '✅' : '❌'}`);
    console.log(`  Validation Rate: ${(batchSize / mixedDHITime * 1000).toFixed(0)} items/sec`);
    
    // Asymmetric Structure Benchmark
    console.log('\n🏗️ Asymmetric Structure (Target: 5x improvement)');
    const asymmetricData = generateAsymmetricStructureData(batchSize);
    
    const asymmetricDHIStart = performance.now();
    const asymmetricDHIResults = asymmetricStructureDHI.validateBatch(asymmetricData);
    const asymmetricDHITime = performance.now() - asymmetricDHIStart;
    
    const asymmetricZodStart = performance.now();
    const asymmetricZodResults = asymmetricData.map(item => asymmetricStructureZod.safeParse(item).success);
    const asymmetricZodTime = performance.now() - asymmetricZodStart;
    
    const asymmetricSpeedup = asymmetricZodTime / asymmetricDHITime;
    console.log(`  DHI: ${asymmetricDHITime.toFixed(2)}ms | Zod: ${asymmetricZodTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${asymmetricSpeedup.toFixed(2)}x ${asymmetricSpeedup >= 1 ? '✅' : '❌'}`);
    console.log(`  Validation Rate: ${(batchSize / asymmetricDHITime * 1000).toFixed(0)} items/sec`);
    
    // Union-Heavy Schema Benchmark
    console.log('\n🔀 Union-Heavy Schema (Target: 5x improvement)');
    const unionData = generateUnionHeavyData(batchSize);
    
    const unionDHIStart = performance.now();
    const unionDHIResults = unionHeavyDHI.validateBatch(unionData);
    const unionDHITime = performance.now() - unionDHIStart;
    
    const unionZodStart = performance.now();
    const unionZodResults = unionData.map(item => unionHeavyZod.safeParse(item).success);
    const unionZodTime = performance.now() - unionZodStart;
    
    const unionSpeedup = unionZodTime / unionDHITime;
    console.log(`  DHI: ${unionDHITime.toFixed(2)}ms | Zod: ${unionZodTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${unionSpeedup.toFixed(2)}x ${unionSpeedup >= 1 ? '✅' : '❌'}`);
    console.log(`  Validation Rate: ${(batchSize / unionDHITime * 1000).toFixed(0)} items/sec`);
    
    // Overall Performance Summary
    const overallSpeedup = (mixedSpeedup + asymmetricSpeedup + unionSpeedup) / 3;
    console.log(`\n📈 Overall Average Speedup: ${overallSpeedup.toFixed(2)}x`);
    
    // Verify correctness with detailed analysis
    const mixedDHIValid = mixedDHIResults.filter(r => r).length;
    const mixedZodValid = mixedZodResults.filter(r => r).length;
    const asymmetricDHIValid = asymmetricDHIResults.filter(r => r).length;
    const asymmetricZodValid = asymmetricZodResults.filter(r => r).length;
    const unionDHIValid = unionDHIResults.filter(r => r).length;
    const unionZodValid = unionZodResults.filter(r => r).length;
    
    console.log(`\n✅ Validation Correctness:`);
    console.log(`  Mixed Arrays: DHI ${mixedDHIValid}/${batchSize}, Zod ${mixedZodValid}/${batchSize} ${mixedDHIValid === mixedZodValid ? '✅' : '❌'}`);
    console.log(`  Asymmetric: DHI ${asymmetricDHIValid}/${batchSize}, Zod ${asymmetricZodValid}/${batchSize} ${asymmetricDHIValid === asymmetricZodValid ? '✅' : '❌'}`);
    console.log(`  Union-Heavy: DHI ${unionDHIValid}/${batchSize}, Zod ${unionZodValid}/${batchSize} ${unionDHIValid === unionZodValid ? '✅' : '❌'}`);
  }
}

// Debug single validation
function debugValidation() {
  console.log('🔍 Debugging DHI Validation Issues\n');
  
  // Test simple mixed array object
  const testData = {
    id: "test-1",
    tags: ["tag-1", 42],
    metadata: {
      created: 1234567890,
      flags: [true, false],
      nested: {
        values: ["val-1", 123, true]
      }
    }
  };
  
  console.log('Test data:', JSON.stringify(testData, null, 2));
  
  try {
    const dhiResult = mixedArrayObjectDHI.validate(testData);
    console.log('✅ DHI validate() succeeded:', dhiResult);
  } catch (error) {
    console.log('❌ DHI validate() failed:', error.message);
  }
  
  const dhiBatchResult = mixedArrayObjectDHI.validateBatch([testData]);
  console.log('DHI validateBatch():', dhiBatchResult);
  
  const zodResult = mixedArrayObjectZod.safeParse(testData);
  console.log('Zod result:', zodResult.success, zodResult.success ? 'SUCCESS' : zodResult.error);
}

// Run benchmarks
if (require.main === module) {
  runOptimizationBenchmarks().catch(console.error);
}

export { runOptimizationBenchmarks };
