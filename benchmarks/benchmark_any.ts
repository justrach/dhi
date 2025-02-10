import { dhi } from '../src';
import { z } from 'zod';

async function runAnyBenchmark() {
    // Create schemas that accept any type
    const DhiAnySchema = await dhi.object({
        anyField: dhi.any(),
        anyArray: dhi.array(dhi.any()),
        anyRecord: dhi.record(dhi.any()),
        mixedFields: dhi.object({
            required: dhi.any(),
            optional: dhi.any(),
            nested: dhi.object({
                anything: dhi.any(),
                array: dhi.array(dhi.any())
            })
        })
    });

    const ZodAnySchema = z.object({
        anyField: z.any(),
        anyArray: z.array(z.any()),
        anyRecord: z.record(z.any()),
        mixedFields: z.object({
            required: z.any(),
            optional: z.any().optional(),
            nested: z.object({
                anything: z.any(),
                array: z.array(z.any())
            })
        })
    });

    // Generate diverse test data
    const testData = Array.from({ length: 1000_000 }, (_, i) => ({
        anyField: i % 2 ? "string" : i % 3 ? 123 : true,
        anyArray: [
            "string",
            123,
            true,
            { nested: "object" },
            [1, 2, 3],
            null,
            undefined
        ],
        anyRecord: {
            key1: "value",
            key2: 123,
            key3: { nested: true },
            key4: [1, 2, 3]
        },
        mixedFields: {
            required: { complex: "object", with: ["array", "values"] },
            optional: i % 2 ? undefined : "present",
            nested: {
                anything: new Date(),
                array: [Symbol("test"), BigInt(123), new Set([1, 2, 3])]
            }
        }
    }));

    // Warm up
    for (let i = 0; i < 100; i++) {
        DhiAnySchema.validate(testData[i]);
        ZodAnySchema.safeParse(testData[i]);
    }

    console.log(`\nBenchmarking any type validations (${testData.length.toLocaleString()} items):`);
    
    // DHI Benchmark
    const dhiStart = performance.now();
    const dhiResults = DhiAnySchema.validate_batch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    // Zod Benchmark
    const zodStart = performance.now();
    const zodResults = testData.map(item => ZodAnySchema.safeParse(item));
    const zodTime = performance.now() - zodStart;

    console.log('\nResults:');
    console.log(`DHI: ${dhiTime.toFixed(2)}ms`);
    console.log(`Zod: ${zodTime.toFixed(2)}ms`);
    console.log(`\nValidations per second:`);
    console.log(`DHI: ${(testData.length / (dhiTime / 1000)).toFixed(0).toLocaleString()}`);
    console.log(`Zod: ${(testData.length / (zodTime / 1000)).toFixed(0).toLocaleString()}`);
    console.log(`\nDHI is ${(zodTime / dhiTime).toFixed(1)}x faster than Zod for any type validation`);
}

runAnyBenchmark().catch(console.error); 