import { z } from 'zod';
import { createType } from '../src';

async function runBenchmark() {
    // Create schemas
    const string = await createType<string>();
    const number = await createType<number>();
    const boolean = await createType<boolean>();

    // Create nested schemas
    const AddressSchema = (await createType<any>()).object({
        street: string.string(),
        city: string.string(),
        country: string.string(),
        zipCode: string.string(),
        coordinates: (await createType<any>()).object({
            lat: number.number(),
            lng: number.number()
        })
    });

    const ContactSchema = (await createType<any>()).object({
        email: string.string(),
        phone: string.string(),
        address: AddressSchema
    });

    const MetadataSchema = (await createType<any>()).object({
        createdAt: string.string(),
        updatedAt: string.string(),
        tags: (await createType<string[]>()).array(string.string()),
        settings: (await createType<any>()).object({
            isPublic: boolean.boolean(),
            notifications: boolean.boolean(),
            preferences: (await createType<any>()).object({
                theme: string.string(),
                language: string.string(),
                timezone: string.string()
            })
        })
    });

    const DhiUserSchema = (await createType<any>()).object({
        id: string.string(),
        name: string.string(),
        age: number.number(),
        isAdmin: boolean.boolean(),
        contact: ContactSchema,
        metadata: MetadataSchema,
        friends: (await createType<any>()).array(string.string()),
        posts: (await createType<any>()).array(
            (await createType<any>()).object({
                id: string.string(),
                title: string.string(),
                content: string.string(),
                likes: number.number(),
                comments: (await createType<any>()).array(
                    (await createType<any>()).object({
                        id: string.string(),
                        text: string.string(),
                        author: string.string()
                    })
                )
            })
        )
    });

    // Turn off debug mode
    DhiUserSchema.setDebug(false);

    // Create equivalent Zod schema
    const ZodUserSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number(),
        isAdmin: z.boolean(),
        contact: z.object({
            email: z.string(),
            phone: z.string(),
            address: z.object({
                street: z.string(),
                city: z.string(),
                country: z.string(),
                zipCode: z.string(),
                coordinates: z.object({
                    lat: z.number(),
                    lng: z.number()
                })
            })
        }),
        metadata: z.object({
            createdAt: z.string(),
            updatedAt: z.string(),
            tags: z.array(z.string()),
            settings: z.object({
                isPublic: z.boolean(),
                notifications: z.boolean(),
                preferences: z.object({
                    theme: z.string(),
                    language: z.string(),
                    timezone: z.string()
                })
            })
        }),
        friends: z.array(z.string()),
        posts: z.array(z.object({
            id: z.string(),
            title: z.string(),
            content: z.string(),
            likes: z.number(),
            comments: z.array(z.object({
                id: z.string(),
                text: z.string(),
                author: z.string()
            }))
        }))
    });

    // Generate complex test data
    const testData = Array.from({ length: 100_000 }, (_, i) => ({
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
            }
        },
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
            }
        },
        friends: Array.from(
            { length: Math.floor(Math.random() * 10) },
            (_, j) => `friend_${j}`
        ),
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
        ZodUserSchema.safeParse(testData[i]);
    }

    console.log(`\nBenchmarking complex validations (${testData.length.toLocaleString()} items):`);
    
    // DHI Benchmark
    const dhiStart = performance.now();
    const dhiResults = DhiUserSchema.validate_batch(testData);
    const dhiTime = performance.now() - dhiStart;
    
    // Zod Benchmark
    const zodStart = performance.now();
    const zodResults = testData.map(item => ZodUserSchema.safeParse(item));
    const zodTime = performance.now() - zodStart;

    console.log('\nResults:');
    console.log(`DHI: ${dhiTime.toFixed(2)}ms`);
    console.log(`Zod: ${zodTime.toFixed(2)}ms`);
    console.log(`\nValidations per second:`);
    console.log(`DHI: ${(testData.length / (dhiTime / 1000)).toFixed(0).toLocaleString()}`);
    console.log(`Zod: ${(testData.length / (zodTime / 1000)).toFixed(0).toLocaleString()}`);
}

runBenchmark().catch(console.error); 