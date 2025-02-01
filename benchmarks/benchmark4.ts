import { Hono } from 'hono';
import { z } from 'zod';
import { createType } from '../src';

const app = new Hono();

// Create validators once at startup
let DhiOrderSchema: any;
let ZodOrderSchema: any;

async function setupValidators() {
    // Common sub-schemas
    const string = await createType<string>();
    const number = await createType<number>();
    const boolean = await createType<boolean>();

    // Complex nested schemas
    const GeoLocationSchema = (await createType<any>()).object({
        latitude: number.number(),
        longitude: number.number(),
        accuracy: number.number(),
        timestamp: number.number()
    });

    const AddressSchema = (await createType<any>()).object({
        street: string.string(),
        city: string.string(),
        state: string.string(),
        country: string.string(),
        postalCode: string.string(),
        location: GeoLocationSchema
    });

    const PaymentDetailsSchema = (await createType<any>()).object({
        cardType: string.string(),
        lastFourDigits: string.string(),
        expiryMonth: number.number(),
        expiryYear: number.number(),
        billingAddress: AddressSchema
    });

    const OrderItemSchema = (await createType<any>()).object({
        productId: string.string(),
        name: string.string(),
        quantity: number.number(),
        price: number.number(),
        metadata: (await createType<any>()).object({
            color: string.string(),
            size: string.string(),
            weight: number.number(),
            tags: (await createType<string[]>()).array(string.string())
        })
    });

    const DhiOrderSchema = (await createType<any>()).object({
        orderId: string.string(),
        userId: string.string(),
        status: string.string(),
        createdAt: number.number(),
        updatedAt: number.number(),
        items: (await createType<any[]>()).array(OrderItemSchema),
        shippingAddress: AddressSchema,
        billingAddress: AddressSchema,
        payment: PaymentDetailsSchema,
        metadata: (await createType<any>()).object({
            platform: string.string(),
            userAgent: string.string(),
            sessionId: string.string(),
            preferences: (await createType<any>()).object({
                giftWrap: boolean.boolean(),
                insurance: boolean.boolean(),
                notifications: (await createType<any>()).object({
                    email: boolean.boolean(),
                    sms: boolean.boolean(),
                    push: boolean.boolean()
                })
            })
        })
    });

    // Equivalent Zod schema
    const ZodOrderSchema = z.object({
        orderId: z.string(),
        userId: z.string(),
        status: z.string(),
        createdAt: z.number(),
        updatedAt: z.number(),
        items: z.array(z.object({
            productId: z.string(),
            name: z.string(),
            quantity: z.number(),
            price: z.number(),
            metadata: z.object({
                color: z.string(),
                size: z.string(),
                weight: z.number(),
                tags: z.array(z.string())
            })
        })),
        shippingAddress: z.object({
            street: z.string(),
            city: z.string(),
            state: z.string(),
            country: z.string(),
            postalCode: z.string(),
            location: z.object({
                latitude: z.number(),
                longitude: z.number(),
                accuracy: z.number(),
                timestamp: z.number()
            })
        }),
        billingAddress: z.object({
            street: z.string(),
            city: z.string(),
            state: z.string(),
            country: z.string(),
            postalCode: z.string(),
            location: z.object({
                latitude: z.number(),
                longitude: z.number(),
                accuracy: z.number(),
                timestamp: z.number()
            })
        }),
        payment: z.object({
            cardType: z.string(),
            lastFourDigits: z.string(),
            expiryMonth: z.number(),
            expiryYear: z.number(),
            billingAddress: z.object({
                street: z.string(),
                city: z.string(),
                state: z.string(),
                country: z.string(),
                postalCode: z.string(),
                location: z.object({
                    latitude: z.number(),
                    longitude: z.number(),
                    accuracy: z.number(),
                    timestamp: z.number()
                })
            })
        }),
        metadata: z.object({
            platform: z.string(),
            userAgent: z.string(),
            sessionId: z.string(),
            preferences: z.object({
                giftWrap: z.boolean(),
                insurance: z.boolean(),
                notifications: z.object({
                    email: z.boolean(),
                    sms: z.boolean(),
                    push: z.boolean()
                })
            })
        })
    });

    return { DhiOrderSchema, ZodOrderSchema };
}

function generateOrder(orderId: string) {
    return {
        orderId,
        userId: `user_${Math.random().toString(36).slice(2)}`,
        status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: Array.from({ length: 1 + Math.floor(Math.random() * 5) }, (_, i) => ({
            productId: `prod_${Math.random().toString(36).slice(2)}`,
            name: `Product ${i}`,
            quantity: 1 + Math.floor(Math.random() * 5),
            price: Math.floor(Math.random() * 10000) / 100,
            metadata: {
                color: ['red', 'blue', 'green'][Math.floor(Math.random() * 3)],
                size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
                weight: Math.floor(Math.random() * 1000) / 100,
                tags: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, 
                    () => ['new', 'sale', 'trending', 'limited'][Math.floor(Math.random() * 4)])
            }
        })),
        shippingAddress: {
            street: `${Math.floor(Math.random() * 1000)} Main St`,
            city: "New York",
            state: "NY",
            country: "USA",
            postalCode: "10001",
            location: {
                latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                accuracy: Math.floor(Math.random() * 100),
                timestamp: Date.now()
            }
        },
        billingAddress: {
            street: `${Math.floor(Math.random() * 1000)} Main St`,
            city: "New York",
            state: "NY",
            country: "USA",
            postalCode: "10001",
            location: {
                latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                accuracy: Math.floor(Math.random() * 100),
                timestamp: Date.now()
            }
        },
        payment: {
            cardType: ['visa', 'mastercard', 'amex'][Math.floor(Math.random() * 3)],
            lastFourDigits: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
            expiryMonth: 1 + Math.floor(Math.random() * 12),
            expiryYear: 2024 + Math.floor(Math.random() * 5),
            billingAddress: {
                street: `${Math.floor(Math.random() * 1000)} Main St`,
                city: "New York",
                state: "NY",
                country: "USA",
                postalCode: "10001",
                location: {
                    latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                    longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                    accuracy: Math.floor(Math.random() * 100),
                    timestamp: Date.now()
                }
            }
        },
        metadata: {
            platform: ['web', 'ios', 'android'][Math.floor(Math.random() * 3)],
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            sessionId: Math.random().toString(36).slice(2),
            preferences: {
                giftWrap: Math.random() < 0.3,
                insurance: Math.random() < 0.5,
                notifications: {
                    email: Math.random() < 0.8,
                    sms: Math.random() < 0.4,
                    push: Math.random() < 0.6
                }
            }
        }
    };
}

// Initialize validators and run benchmark
setupValidators().then(schemas => {
    DhiOrderSchema = schemas.DhiOrderSchema;
    ZodOrderSchema = schemas.ZodOrderSchema;
    DhiOrderSchema.setDebug(false);

    // Run benchmark after validators are ready
    main().catch(console.error);
});

// Setup routes with cached validators
app.post('/api/dhi/orders', async (c) => {
    const body = await c.req.json();
    const result = DhiOrderSchema.validate(body);
    return c.json({ success: result.success });
});

app.post('/api/zod/orders', async (c) => {
    const body = await c.req.json();
    const result = ZodOrderSchema.safeParse(body);
    return c.json({ success: result.success });
});

// Server export at top level
export default {
    port: 3000,
    fetch: app.fetch,
};

async function main() {
    console.log('\nStarting benchmark...');
    const iterations = 1000000;
    const batchSize = 100000;
    const validOrders = Array.from({ length: iterations }, (_, i) => 
        generateOrder(`order_${i}`)
    );

    console.log(`\nBenchmarking ${iterations.toLocaleString()} complex order validations:`);

    // DHI Benchmark
    console.log('\nDHI Progress:');
    const dhiStart = performance.now();
    let processedDhi = 0;
    
    for (let i = 0; i < iterations; i += batchSize) {
        const batch = validOrders.slice(i, i + batchSize);
        const batchStart = performance.now();
        DhiOrderSchema.validate_batch(batch);
        const batchTime = performance.now() - batchStart;
        processedDhi += batch.length;
        
        const speed = (batch.length / (batchTime / 1000)).toFixed(0);
        const progress = ((processedDhi / iterations) * 100).toFixed(1);
        console.log(`${progress}% complete - Current speed: ${speed.toLocaleString()} validations/sec`);
    }
    const dhiTime = performance.now() - dhiStart;

    // Zod Benchmark
    console.log('\nZod Progress:');
    const zodStart = performance.now();
    let processedZod = 0;
    
    for (let i = 0; i < iterations; i += batchSize) {
        const batch = validOrders.slice(i, i + batchSize);
        const batchStart = performance.now();
        batch.forEach(order => ZodOrderSchema.safeParse(order));
        const batchTime = performance.now() - batchStart;
        processedZod += batch.length;
        
        const speed = (batch.length / (batchTime / 1000)).toFixed(0);
        const progress = ((processedZod / iterations) * 100).toFixed(1);
        console.log(`${progress}% complete - Current speed: ${speed.toLocaleString()} validations/sec`);
    }
    const zodTime = performance.now() - zodStart;

    console.log('\nFinal Results:');
    console.log(`DHI: ${dhiTime.toFixed(2)}ms`);
    console.log(`Zod: ${zodTime.toFixed(2)}ms`);
    console.log(`\nAverage validations per second:`);
    console.log(`DHI: ${(iterations / (dhiTime / 1000)).toFixed(0).toLocaleString()}`);
    console.log(`Zod: ${(iterations / (zodTime / 1000)).toFixed(0).toLocaleString()}`);
} 