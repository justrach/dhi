import { z } from 'zod';
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
            }),
            lastContact: z.date(),
            alternateEmails: z.array(z.string())
        }),
        metadata: z.object({
            createdAt: z.date(),
            updatedAt: z.date(),
            tags: z.array(z.string()),
            settings: z.object({
                isPublic: z.boolean(),
                notifications: z.boolean(),
                preferences: z.record(z.unknown())
            }),
            flags: z.record(z.boolean())
        }),
        friends: z.array(z.string()),
        status: z.enum(['active', 'inactive', 'banned']),
        loginCount: z.bigint(),
        uniqueKey: z.symbol(),
        lastLoginAttempt: z.date().nullable(),
        deletedAt: z.date().optional(),
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
        ZodUserSchema.safeParse(testData[i]);
    }

    console.log(`\nBenchmarking complex validations with new types (${testData.length.toLocaleString()} items):`);
    
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

    // Add chart creation
    const { createCanvas } = require('canvas');
    const { Chart } = require('chart.js/auto');

    // Create canvas
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const dhiColor = 'rgba(183, 228, 229, 0.8)'; // Light blue/turquoise from DHI logo
    const zodColor = 'rgba(255, 99, 132, 0.8)';  // Keeping Zod's red color

    // Create validations per second chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['DHI', 'Zod'],
            datasets: [{
                label: 'Validations per Second',
                data: [
                    testData.length / (dhiTime / 1000),
                    testData.length / (zodTime / 1000)
                ],
                backgroundColor: [dhiColor, zodColor]
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'DHI vs Zod Performance Comparison',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Validations per Second'
                    }
                }
            }
        }
    });

    // Create execution time chart
    const timeCanvas = createCanvas(width, height);
    const timeCtx = timeCanvas.getContext('2d');

    new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: ['DHI', 'Zod'],
            datasets: [{
                label: 'Execution Time (ms)',
                data: [dhiTime, zodTime],
                backgroundColor: [dhiColor, zodColor]
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'DHI vs Zod Execution Time Comparison',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (milliseconds)'
                    }
                }
            }
        }
    });

    // Save both charts
    const fs = require('fs');
    const vpsBuffer = canvas.toBuffer('image/png');
    const timeBuffer = timeCanvas.toBuffer('image/png');
    fs.writeFileSync('benchmark-validations-per-second.png', vpsBuffer);
    fs.writeFileSync('benchmark-execution-time.png', timeBuffer);
}

runBenchmark().catch(console.error); 