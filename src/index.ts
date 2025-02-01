import { DhiType } from './core';
import init from '../dist/dhi_core.js';

// Initialize WASM once at startup
let initialized = init().then(() => {
    console.log('DHI initialized');
});

// Pre-initialize common types
const types = {
    string: DhiType.create<string>().then(t => t.string()),
    number: DhiType.create<number>().then(t => t.number()),
    boolean: DhiType.create<boolean>().then(t => t.boolean()),
    date: DhiType.create<Date>().then(t => t.date()),
    bigint: DhiType.create<bigint>().then(t => t.bigint()),
    symbol: DhiType.create<symbol>().then(t => t.symbol()),
    undefined: DhiType.create<undefined>().then(t => t.undefined()),
    null: DhiType.create<null>().then(t => t.null()),
    void: DhiType.create<void>().then(t => t.void()),
    any: DhiType.create<any>().then(t => t.any()),
    unknown: DhiType.create<unknown>().then(t => t.unknown()),
    never: DhiType.create<never>().then(t => t.never()),
};

// Create the dhi object with synchronous-looking methods
export const dhi = {
    // Primitives
    string: () => types.string,
    number: () => types.number,
    boolean: () => types.boolean,
    date: () => types.date,
    bigint: () => types.bigint,
    symbol: () => types.symbol,

    // Empty types
    undefined: () => types.undefined,
    null: () => types.null,
    void: () => types.void,

    // Catch-all types
    any: () => types.any,
    unknown: () => types.unknown,
    never: () => types.never,

    // Complex types
    array: <T>(schema: Promise<DhiType<T>>) => 
        schema.then((s: DhiType<T>) => DhiType.create<T[]>().then(t => t.array(s))),
    
    object: <T extends Record<string, any>>(shape: { [K in keyof T]: Promise<DhiType<T[K]>> }) =>
        Promise.all(
            Object.entries(shape).map(([k, v]) => 
                v.then((t: DhiType<T[keyof T]>) => [k, t] as const)
            )
        ).then(entries => 
            DhiType.create<T>().then(t => t.object(Object.fromEntries(entries)))
        ),
    
    record: <K extends string, V>(valueType: Promise<DhiType<V>>) =>
        valueType.then((t: DhiType<V>) => 
            DhiType.create<Record<K, V>>().then(r => r.record(t))
        ),

    // Enum type
    enum: <T extends [string, ...string[]]>(...values: T) =>
        DhiType.create<T[number]>().then((t: DhiType<T[number]>) => 
            t.setTypeString(`enum:${values.join(',')}`)
        ),

    // Utilities
    optional: <T>(schema: Promise<DhiType<T>>) => 
        schema.then((s: DhiType<T>) => s.optional()),
    
    nullable: <T>(schema: Promise<DhiType<T>>) => 
        schema.then((s: DhiType<T>) => s.nullable()),

    // Helper to create custom types
    create: DhiType.create,
};

// Type definitions for better DX
export type {
    DhiType,
    ValidationResult,
    ValidationError
} from './core';

// Example usage:
/*
const UserSchema = await dhi.object({
    name: await dhi.string(),
    age: await dhi.number(),
    isAdmin: await dhi.boolean(),
    tags: await dhi.array(await dhi.string())
});

// Validate
const result = UserSchema.validate({
    name: "John",
    age: 30,
    isAdmin: true,
    tags: ["admin", "user"]
});
*/ 