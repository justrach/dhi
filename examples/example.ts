import { dhi } from '../src';

async function runBenchmark() {
    // Create complex nested schemas with new types
    const DhiAddressSchema = dhi.object({
        street: dhi.string(),
        city: dhi.string(),
        country: dhi.string(),
        zipCode: dhi.string(),
        coordinates: dhi.object({
            lat: dhi.number(),
            lng: dhi.number()
        })
    });

    const DhiContactSchema = dhi.object({
        email: dhi.string(),
        phone: dhi.string(),
        address: DhiAddressSchema,
        lastContact: dhi.date(),
        alternateEmails: dhi.array(dhi.string())
    });

    const DhiMetadataSchema = dhi.object({
        createdAt: dhi.date(),
        updatedAt: dhi.date(),
        tags: dhi.array(dhi.string()),
        settings: dhi.object({
            isPublic: dhi.boolean(),
            notifications: dhi.boolean(),
            preferences: dhi.record<string, unknown>(dhi.unknown())
        }),
        flags: dhi.record<string, boolean>(dhi.boolean())
    });

    const DhiUserSchema = await dhi.object({
        id: dhi.string(),
        name: dhi.string(),
        age: dhi.number(),
        isAdmin: dhi.boolean(),
        contact: DhiContactSchema,
        metadata: DhiMetadataSchema,
        friends: dhi.array(dhi.string()),
        status: dhi.enum('active', 'inactive', 'banned'),
        loginCount: dhi.bigint(),
        uniqueKey: dhi.symbol(),
        lastLoginAttempt: dhi.nullable(dhi.date()),
        deletedAt: dhi.optional(dhi.date()),
        posts: dhi.array(
            dhi.object({
                id: dhi.string(),
                title: dhi.string(),
                content: dhi.string(),
                likes: dhi.number(),
                comments: dhi.array(
                    dhi.object({
                        id: dhi.string(),
                        text: dhi.string(),
                        author: dhi.string()
                    })
                )
            })
        )
    });

    // Turn off debug mode
    DhiUserSchema.setDebug(false);

    // Create equivalent Zod schema
   
    // Generate complex test data
    const testData = Array.from({ length: 1000_000 }, (_, i) => ({
        id: `user_${i}`,
        name: `User ${i}`,
        age: 20 + Math.floor(Math.random() * 50),
        isAdmin: Math.random() < 0.1,
        contact: {
            email: `user${i}@example.com`,
            phone: `+1${Math.floor(Math.random() * 10000000000)}`,
            address: {
                street: `${Math.floor(Math.random() * 1000)} Main St`,
                city: "New York",
                country: "USA",
                zipCode: "10001",
                coordinates: {
                    lat: Math.random() * 180 - 90,
                    lng: Math.random() * 360 - 180
                }
            },
            lastContact: new Date(),
            alternateEmails: [`alt${i}@example.com`]
        },
        metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: Array.from(
                { length: 1 + Math.floor(Math.random() * 4) },
                (_, j) => `tag${j}`
            ),
            settings: {
                isPublic: Math.random() < 0.5,
                notifications: Math.random() < 0.5,
                preferences: {
                    theme: Math.random() < 0.5 ? "light" : "dark",
                    language: "en",
                    timezone: "UTC"
                }
            },
            flags: {
                premium: Math.random() < 0.2,
                verified: Math.random() < 0.8
            }
        },
        friends: Array.from(
            { length: Math.floor(Math.random() * 10) },
            (_, j) => `friend_${j}`
        ),
        status: ['active', 'inactive', 'banned'][Math.floor(Math.random() * 3)] as any,
        loginCount: BigInt(Math.floor(Math.random() * 1000)),
        uniqueKey: Symbol('user'),
        lastLoginAttempt: Math.random() < 0.8 ? new Date() : null,
        deletedAt: Math.random() < 0.2 ? new Date() : undefined,
        posts: Array.from(
            { length: Math.floor(Math.random() * 5) },
            (_, j) => ({
                id: `post_${j}`,
                title: `Post ${j}`,
                content: `Content ${j}`,
                likes: Math.floor(Math.random() * 100),
                comments: Array.from(
                    { length: Math.floor(Math.random() * 3) },
                    (_, k) => ({
                        id: `comment_${k}`,
                        text: `Comment ${k}`,
                        author: `author_${k}`
                    })
                )
            })
        )
    }));

    // Warm up
    for (let i = 0; i < 100; i++) {
        DhiUserSchema.validate(testData[i]);
    }

    console.log(`\nBenchmarking complex validations with new types (${testData.length.toLocaleString()} items):`);
    
    // DHI Benchmark
    const dhiStart = performance.now();
    const dhiResults = DhiUserSchema.validate_batch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    // Zod Benchmark
    const zodStart = performance.now();
    const zodTime = performance.now() - zodStart;

    console.log('\nResults:');
    console.log(`DHI: ${dhiTime.toFixed(2)}ms`);
    console.log(`\nValidations per second:`);
    console.log(`DHI: ${(testData.length / (dhiTime / 1000)).toFixed(0).toLocaleString()}`);
}

runBenchmark().catch(console.error); 