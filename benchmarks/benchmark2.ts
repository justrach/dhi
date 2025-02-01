import { z } from 'zod';
import { createType } from '../src';

async function runBenchmark() {
    // Create schemas
    const string = await createType<string>();
    const number = await createType<number>();
    const boolean = await createType<boolean>();

    const DhiUserSchema = (await createType<any>()).object({
        name: string.string(),
        age: number.number(),
        isAdmin: boolean.boolean(),
        tags: (await createType<string[]>()).array(string.string())
    });
    
    // Turn off debug mode for maximum performance
    DhiUserSchema.setDebug(false);

    const ZodUserSchema = z.object({
        name: z.string(),
        age: z.number(),
        isAdmin: z.boolean(),
        tags: z.array(z.string())
    });

    // Generate mixed test data - 80% valid, 20% invalid
    const testData = Array.from({ length: 1_000_000 }, (_, i) => {
        if (Math.random() < 0.8) {
            // Valid data with some variations
            return {
                name: `User ${i}`,
                age: 20 + Math.floor(Math.random() * 50),
                isAdmin: Math.random() < 0.1,
                tags: Array.from(
                    { length: 1 + Math.floor(Math.random() * 4) }, 
                    (_, j) => `tag${j}`
                )
            };
        } else {
            // Invalid data with various errors
            const errorType = Math.random();
            if (errorType < 0.33) {
                return {
                    name: 123,  // Wrong type
                    age: 25,
                    isAdmin: true,
                    tags: ["user"]
                };
            } else if (errorType < 0.66) {
                return {
                    name: "User",
                    age: "25",  // Wrong type
                    isAdmin: true,
                    tags: ["user"]
                };
            } else {
                return {
                    name: "User",
                    age: 25,
                    isAdmin: true,
                    tags: "tags"  // Wrong type
                };
            }
        }
    });

    // Warm up
    for (let i = 0; i < 1000; i++) {
        DhiUserSchema.validate(testData[i]);
        ZodUserSchema.safeParse(testData[i]);
    }

    console.log(`\nBenchmarking 1M validations (${testData.length.toLocaleString()} items):`);
    
    // DHI Benchmark
    const dhiStart = performance.now();
    const dhiResults = DhiUserSchema.validate_batch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    // Zod Benchmark
    const zodStart = performance.now();
    const zodResults = testData.map(item => ZodUserSchema.safeParse(item));
    const zodTime = performance.now() - zodStart;

    // Results
    const validDhi = dhiResults.filter(r => r.success).length;
    const validZod = zodResults.filter(r => r.success).length;

    console.log('\nResults:');
    console.log(`DHI: ${dhiTime.toFixed(2)}ms (${validDhi.toLocaleString()} valid)`);
    console.log(`Zod: ${zodTime.toFixed(2)}ms (${validZod.toLocaleString()} valid)`);
    console.log(`\nValidations per second:`);
    console.log(`DHI: ${(testData.length / (dhiTime / 1000)).toFixed(0).toLocaleString()}`);
    console.log(`Zod: ${(testData.length / (zodTime / 1000)).toFixed(0).toLocaleString()}`);
}

runBenchmark().catch(console.error); 