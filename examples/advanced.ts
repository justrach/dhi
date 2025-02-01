import { dhi } from '../src';

async function example() {
    // String validations
    const emailSchema = await dhi.string()
        .email()
        .min(5)
        .max(100);

    // Number validations
    const ageSchema = await dhi.number()
        .int()
        .positive()
        .min(0)
        .max(150);

    // Enum type
    const RoleSchema = await dhi.enum('admin', 'user', 'guest');

    // Union type
    const StringOrNumber = await dhi.union(
        await dhi.string(),
        await dhi.number()
    );

    // Tuple type
    const CoordinatesSchema = await dhi.tuple(
        await dhi.number(),
        await dhi.number()
    );

    // Complex object with all features
    const UserSchema = await dhi.object({
        id: (await dhi.string()).uuid(),
        email: (await dhi.string()).email(),
        age: (await dhi.number()).int().min(0),
        role: RoleSchema,
        coordinates: CoordinatesSchema,
        tags: await dhi.array(await dhi.string()),
        metadata: await dhi.record<string, any>(await dhi.any()),
        preferences: await dhi.object({
            theme: await dhi.enum('light', 'dark'),
            notifications: await dhi.boolean()
        }).optional(),
    });

    // Transform example
    const DateStringSchema = await dhi.transform(
        await dhi.string(),
        (str) => new Date(str)
    );

    // Refinement example
    const EvenNumberSchema = await dhi.refine(
        await dhi.number(),
        (n) => n % 2 === 0,
        'Number must be even'
    );

    // Validation examples
    const validUser = {
        id: 'c8d8e8f0-e8f0-4f0e-8f0e-8f0e8f0e8f0e',
        email: 'test@example.com',
        age: 25,
        role: 'admin',
        coordinates: [10, 20],
        tags: ['developer', 'typescript'],
        metadata: {
            lastLogin: '2024-01-01',
            visits: 42
        },
        preferences: {
            theme: 'dark',
            notifications: true
        }
    };

    const result = await UserSchema.validate(validUser);
    console.log('Validation result:', result);

    // Batch validation with progress
    const users = Array.from({ length: 1000 }, () => validUser);
    console.log('\nBatch validating 1000 users...');
    const results = UserSchema.validate_batch(users);
    console.log('Batch validation complete:', results);
}

example().catch(console.error); 