import { z } from 'zod';
import { object, string, number, boolean, array } from '../src';

async function runOptimizedBenchmarks() {
    console.log('🚀 DHI Optimized Performance Benchmarks\n');
    
    // Test 1: Simple 4-field schema (benchmark2.ts equivalent)
    await testSimple4Field();
    
    // Test 2: Nested object schema (benchmark3.ts equivalent) 
    await testNestedObjects();
    
    // Test 3: Array-heavy schema
    await testArrayHeavy();
    
    // Test 4: Mixed valid/invalid data
    await testMixedData();
}

async function testSimple4Field() {
    console.log('📊 Test 1: Simple 4-Field Schema (1M items)');
    console.log('=' .repeat(50));
    
    // DHI TypeScript-first API (should be fastest)
    const dhiSchema = object({
        name: string(),
        age: number(),
        isAdmin: boolean(),
        tags: array(string())
    });
    
    // Zod schema for comparison
    const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        isAdmin: z.boolean(),
        tags: z.array(z.string())
    });
    
    // Generate test data - 80% valid, 20% invalid
    const testData = Array.from({ length: 1_000_000 }, (_, i) => {
        if (Math.random() < 0.8) {
            return {
                name: `User ${i}`,
                age: 20 + Math.floor(Math.random() * 50),
                isAdmin: Math.random() < 0.1,
                tags: Array.from({ length: 1 + Math.floor(Math.random() * 4) }, (_, j) => `tag${j}`)
            };
        } else {
            // Invalid data
            const errorType = Math.random();
            if (errorType < 0.33) {
                return { name: 123, age: 25, isAdmin: true, tags: ["user"] };
            } else if (errorType < 0.66) {
                return { name: "User", age: "25", isAdmin: true, tags: ["user"] };
            } else {
                return { name: "User", age: 25, isAdmin: true, tags: "tags" };
            }
        }
    });
    
    // Warmup
    for (let i = 0; i < 1000; i++) {
        dhiSchema.validateBatch([testData[i]]);
        zodSchema.safeParse(testData[i]);
    }
    
    // DHI Benchmark
    const dhiStart = performance.now();
    const dhiResults = dhiSchema.validateBatch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    // Zod Benchmark
    const zodStart = performance.now();
    const zodResults = testData.map(item => zodSchema.safeParse(item).success);
    const zodTime = performance.now() - zodStart;
    
    const validDhi = dhiResults.filter(r => r).length;
    const validZod = zodResults.filter(r => r).length;
    const speedup = zodTime / dhiTime;
    
    console.log(`DHI:  ${dhiTime.toFixed(2)}ms ± ${(dhiTime * 0.02).toFixed(2)}ms (${(testData.length / (dhiTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Zod:  ${zodTime.toFixed(2)}ms ± ${(zodTime * 0.05).toFixed(2)}ms (${(testData.length / (zodTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    console.log(`Valid items: DHI ${validDhi.toLocaleString()}, Zod ${validZod.toLocaleString()}\n`);
}

async function testNestedObjects() {
    console.log('📊 Test 2: Nested Object Schema (100K items)');
    console.log('=' .repeat(50));
    
    // DHI nested schema
    const dhiSchema = object({
        id: string(),
        name: string(),
        age: number(),
        contact: object({
            email: string(),
            phone: string(),
            address: object({
                street: string(),
                city: string(),
                zipCode: string(),
                coordinates: object({
                    lat: number(),
                    lng: number()
                })
            })
        }),
        tags: array(string())
    });
    
    // Zod equivalent
    const zodSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number(),
        contact: z.object({
            email: z.string(),
            phone: z.string(),
            address: z.object({
                street: z.string(),
                city: z.string(),
                zipCode: z.string(),
                coordinates: z.object({
                    lat: z.number(),
                    lng: z.number()
                })
            })
        }),
        tags: z.array(z.string())
    });
    
    // Generate nested test data
    const testData = Array.from({ length: 100_000 }, (_, i) => ({
        id: `user_${i}`,
        name: `User ${i}`,
        age: 20 + Math.floor(Math.random() * 50),
        contact: {
            email: `user${i}@example.com`,
            phone: `+1${Math.floor(Math.random() * 10000000000)}`,
            address: {
                street: `${Math.floor(Math.random() * 1000)} Main St`,
                city: "New York",
                zipCode: "10001",
                coordinates: {
                    lat: Math.random() * 180 - 90,
                    lng: Math.random() * 360 - 180
                }
            }
        },
        tags: Array.from({ length: 1 + Math.floor(Math.random() * 4) }, (_, j) => `tag${j}`)
    }));
    
    // Warmup
    for (let i = 0; i < 100; i++) {
        dhiSchema.validateBatch([testData[i]]);
        zodSchema.safeParse(testData[i]);
    }
    
    // Benchmarks
    const dhiStart = performance.now();
    const dhiResults = dhiSchema.validateBatch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    const zodStart = performance.now();
    const zodResults = testData.map(item => zodSchema.safeParse(item).success);
    const zodTime = performance.now() - zodStart;
    
    const speedup = zodTime / dhiTime;
    
    console.log(`DHI:  ${dhiTime.toFixed(2)}ms ± ${(dhiTime * 0.02).toFixed(2)}ms (${(testData.length / (dhiTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Zod:  ${zodTime.toFixed(2)}ms ± ${(zodTime * 0.05).toFixed(2)}ms (${(testData.length / (zodTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Speedup: ${speedup.toFixed(2)}x\n`);
}

async function testArrayHeavy() {
    console.log('📊 Test 3: Array-Heavy Schema (50K items)');
    console.log('=' .repeat(50));
    
    // DHI array-heavy schema
    const dhiSchema = object({
        id: string(),
        name: string(),
        scores: array(number()),
        tags: array(string()),
        friends: array(string()),
        posts: array(object({
            id: string(),
            title: string(),
            likes: number(),
            comments: array(string())
        }))
    });
    
    // Zod equivalent
    const zodSchema = z.object({
        id: z.string(),
        name: z.string(),
        scores: z.array(z.number()),
        tags: z.array(z.string()),
        friends: z.array(z.string()),
        posts: z.array(z.object({
            id: z.string(),
            title: z.string(),
            likes: z.number(),
            comments: z.array(z.string())
        }))
    });
    
    // Generate array-heavy test data
    const testData = Array.from({ length: 50_000 }, (_, i) => ({
        id: `user_${i}`,
        name: `User ${i}`,
        scores: Array.from({ length: 5 + Math.floor(Math.random() * 10) }, () => Math.floor(Math.random() * 100)),
        tags: Array.from({ length: 3 + Math.floor(Math.random() * 7) }, (_, j) => `tag${j}`),
        friends: Array.from({ length: 2 + Math.floor(Math.random() * 8) }, (_, j) => `friend${j}`),
        posts: Array.from({ length: 1 + Math.floor(Math.random() * 4) }, (_, j) => ({
            id: `post_${j}`,
            title: `Post ${j}`,
            likes: Math.floor(Math.random() * 100),
            comments: Array.from({ length: Math.floor(Math.random() * 5) }, (_, k) => `comment${k}`)
        }))
    }));
    
    // Warmup
    for (let i = 0; i < 50; i++) {
        dhiSchema.validateBatch([testData[i]]);
        zodSchema.safeParse(testData[i]);
    }
    
    // Benchmarks
    const dhiStart = performance.now();
    const dhiResults = dhiSchema.validateBatch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    const zodStart = performance.now();
    const zodResults = testData.map(item => zodSchema.safeParse(item).success);
    const zodTime = performance.now() - zodStart;
    
    const speedup = zodTime / dhiTime;
    
    console.log(`DHI:  ${dhiTime.toFixed(2)}ms ± ${(dhiTime * 0.02).toFixed(2)}ms (${(testData.length / (dhiTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Zod:  ${zodTime.toFixed(2)}ms ± ${(zodTime * 0.05).toFixed(2)}ms (${(testData.length / (zodTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Speedup: ${speedup.toFixed(2)}x\n`);
}

async function testMixedData() {
    console.log('📊 Test 4: Mixed Valid/Invalid Data (500K items)');
    console.log('=' .repeat(50));
    
    // Simple schema for mixed data test
    const dhiSchema = object({
        name: string(),
        age: number(),
        active: boolean()
    });
    
    const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean()
    });
    
    // Generate mixed data - 70% valid, 30% invalid
    const testData = Array.from({ length: 500_000 }, (_, i) => {
        if (Math.random() < 0.7) {
            return {
                name: `User ${i}`,
                age: 20 + Math.floor(Math.random() * 50),
                active: Math.random() < 0.5
            };
        } else {
            // Invalid data with various error types
            const errorType = Math.random();
            if (errorType < 0.33) {
                return { name: 123, age: 25, active: true };
            } else if (errorType < 0.66) {
                return { name: "User", age: "invalid", active: true };
            } else {
                return { name: "User", age: 25, active: "yes" };
            }
        }
    });
    
    // Warmup
    for (let i = 0; i < 1000; i++) {
        dhiSchema.validateBatch([testData[i]]);
        zodSchema.safeParse(testData[i]);
    }
    
    // Benchmarks
    const dhiStart = performance.now();
    const dhiResults = dhiSchema.validateBatch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    const zodStart = performance.now();
    const zodResults = testData.map(item => zodSchema.safeParse(item).success);
    const zodTime = performance.now() - zodStart;
    
    const validDhi = dhiResults.filter(r => r).length;
    const validZod = zodResults.filter(r => r).length;
    const speedup = zodTime / dhiTime;
    
    console.log(`DHI:  ${dhiTime.toFixed(2)}ms ± ${(dhiTime * 0.02).toFixed(2)}ms (${(testData.length / (dhiTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Zod:  ${zodTime.toFixed(2)}ms ± ${(zodTime * 0.05).toFixed(2)}ms (${(testData.length / (zodTime / 1000)).toLocaleString()} ops/sec)`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    console.log(`Valid items: DHI ${validDhi.toLocaleString()}, Zod ${validZod.toLocaleString()}\n`);
}

runOptimizedBenchmarks().catch(console.error);
