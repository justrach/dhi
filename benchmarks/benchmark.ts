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

    const ZodUserSchema = z.object({
        name: z.string(),
        age: z.number(),
        isAdmin: z.boolean(),
        tags: z.array(z.string())
    });

    // Test data
    const validUsers = Array.from({ length: 10000 }, () => ({
        name: "John Doe",
        age: 30,
        isAdmin: true,
        tags: ["user", "premium"]
    }));

    const invalidUsers = Array.from({ length: 10000 }, () => ({
        name: 123,
        age: "30",
        isAdmin: "yes",
        tags: "tags"
    }));

    // Benchmark valid data
    console.time("DHI Valid");
    DhiUserSchema.validate_batch(validUsers);
    console.timeEnd("DHI Valid");

    console.time("Zod Valid");
    for (const user of validUsers) {
        ZodUserSchema.safeParse(user);
    }
    console.timeEnd("Zod Valid");

    // Benchmark invalid data
    console.time("DHI Invalid");
    DhiUserSchema.validate_batch(invalidUsers);
    console.timeEnd("DHI Invalid");

    console.time("Zod Invalid");
    for (const user of invalidUsers) {
        ZodUserSchema.safeParse(user);
    }
    console.timeEnd("Zod Invalid");
}

runBenchmark().catch(console.error); 