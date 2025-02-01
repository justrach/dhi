import { dhi } from '../src';

async function example() {
    // Primitive types
    const stringSchema = await dhi.string();
    const numberSchema = await dhi.number();
    const booleanSchema = await dhi.boolean();
    const dateSchema = await dhi.date();
    const bigintSchema = await dhi.bigint();
    const symbolSchema = await dhi.symbol();

    // Empty types
    const undefinedSchema = await dhi.undefined();
    const nullSchema = await dhi.null();
    const voidSchema = await dhi.void();

    // Catch-all types
    const anySchema = await dhi.any();
    const unknownSchema = await dhi.unknown();

    // Never type
    const neverSchema = await dhi.never();

    // Complex types
    const arraySchema = await dhi.array(await dhi.string());
    const recordSchema = await dhi.record<string, number>(await dhi.number());

    // Object with optional and nullable fields
    const UserSchema = await dhi.object({
        id: await dhi.string(),
        name: await dhi.string(),
        age: await dhi.optional(await dhi.number()),
        email: await dhi.nullable(await dhi.string()),
        createdAt: await dhi.date(),
        metadata: await dhi.record<string, any>(await dhi.any()),
        tags: await dhi.array(await dhi.string()),
        settings: await dhi.object({
            theme: await dhi.string(),
            notifications: await dhi.boolean(),
            preferences: await dhi.record<string, unknown>(await dhi.unknown())
        })
    });

    // Validation examples
    const validUser = {
        id: "123",
        name: "John Doe",
        age: 30, // optional
        email: null, // nullable
        createdAt: new Date(),
        metadata: {
            lastLogin: "2024-01-01",
            visits: 42
        },
        tags: ["user", "premium"],
        settings: {
            theme: "dark",
            notifications: true,
            preferences: {
                language: "en",
                timezone: "UTC"
            }
        }
    };

    const result = UserSchema.validate(validUser);
    console.log("Validation result:", result);

    // Batch validation
    const users = Array.from({ length: 1000 }, () => validUser);
    const results = UserSchema.validate_batch(users);
    console.log("Batch validation results:", results);
}

example().catch(console.error); 