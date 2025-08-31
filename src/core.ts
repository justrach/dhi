import { ensureWasmInitialized, isWasmReady, getWasmModuleSync } from './wasm';

export type ValidationResult<T> = {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
};

export type ValidationError = {
    path: string;
    message: string;
};

let wasmInitialized = false;

export class DhiType<T> {
    private core!: any;
    private initialized: boolean = false;
    private typeString: string = '';
    private _isOptional: boolean = false;
    private _isNullable: boolean = false;
    private _fieldMeta?: Record<string, { optional: boolean; nullable: boolean }>;

    private constructor() {
        this.initialized = false;
    }

    static async create<T>(): Promise<DhiType<T>> {
        if (!wasmInitialized || !isWasmReady()) {
            await ensureWasmInitialized();
            wasmInitialized = true;
        }
        const type = new DhiType<T>();
        const mod = getWasmModuleSync();
        type.core = new mod.DhiCore();
        type.initialized = true;
        return type;
    }

    static createSync<T>(): DhiType<T> {
        if (!wasmInitialized || !isWasmReady()) {
            throw new Error("Dhi WASM not initialized. Await dhiReady before using sync APIs.");
        }
        const type = new DhiType<T>();
        const mod = getWasmModuleSync();
        type.core = new mod.DhiCore();
        type.initialized = true;
        return type;
    }

    string(): DhiType<string> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "string", true);
        this.typeString = "string";
        return this as unknown as DhiType<string>;
    }

    number(): DhiType<number> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "number", true);
        this.typeString = "number";
        return this as unknown as DhiType<number>;
    }

    boolean(): DhiType<boolean> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "boolean", true);
        this.typeString = "boolean";
        return this as unknown as DhiType<boolean>;
    }

    array<U>(itemType: DhiType<U>): DhiType<U[]> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", `Array<${itemType.typeString}>`, true);
        this.typeString = `Array<${itemType.typeString}>`;
        return this as unknown as DhiType<U[]>;
    }

    object<U extends Record<string, any>>(shape: { [K in keyof U]: DhiType<U[K]> }): DhiType<U> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this._fieldMeta = {};
        for (const [key, type] of Object.entries(shape)) {
            if (!(type instanceof DhiType)) {
                throw new Error(`Invalid type for field ${key}`);
            }
            const t = type as DhiType<any>;
            const required = !(t._isOptional || t._isNullable);
            this.core.add_field(key, t.typeString, required);
            this._fieldMeta[key] = { optional: !!t._isOptional, nullable: !!t._isNullable };
        }
        
        this.typeString = "object";
        return this as unknown as DhiType<U>;
    }

    optional(): DhiType<T | undefined> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        // Do not call into WASM here; object() will set required=false when adding this field
        this._isOptional = true;
        return this as unknown as DhiType<T | undefined>;
    }

    nullable(): DhiType<T | null> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        // Do not call into WASM here; object() will set required=false when adding this field
        this._isNullable = true;
        return this as unknown as DhiType<T | null>;
    }

    validate(value: unknown): ValidationResult<T> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        try {
            // Fast-path empty root kinds that may not require WASM
            if (this.typeString === 'undefined' || this.typeString === 'void') {
                const ok = (value === undefined);
                return ok
                    ? { success: true, data: value as T }
                    : { success: false, errors: [{ path: "", message: "Expected undefined" }] };
            }
            // For object-root schemas, validate the object directly.
            // For all other root schemas (primitives, arrays, record, enum, etc.),
            // we register a single field named "value" in WASM, so wrap the input.
            let input: any;
            if (this.typeString === 'object') {
                const obj = (value as Record<string, any>) || {};
                if (this._fieldMeta) {
                    const clone: Record<string, any> = { ...obj };
                    for (const [k, meta] of Object.entries(this._fieldMeta)) {
                        if (meta.nullable && clone.hasOwnProperty(k) && clone[k] === null) {
                            delete clone[k];
                        }
                    }
                    input = clone;
                } else {
                    input = obj;
                }
            } else {
                input = { value };
            }
            const isValid = this.core.validate(input);
            if (isValid) {
                return { success: true, data: value as T };
            }
            return {
                success: false,
                errors: [{ path: "", message: "Validation failed" }]
            };
        } catch (error) {
            return {
                success: false,
                errors: [{ path: "", message: error instanceof Error ? error.message : "Unknown error" }]
            };
        }
    }

    private flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
        // Not used for root validation anymore, but keep for potential future nested utilities
        return Object.keys(obj).reduce((acc: Record<string, any>, k: string) => {
            const pre = prefix.length ? prefix + '.' : '';
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                Object.assign(acc, this.flattenObject(obj[k], pre + k));
            } else {
                acc[pre + k] = obj[k];
            }
            return acc;
        }, {});
    }

    validate_batch(values: unknown[]): ValidationResult<T>[] {
        if (!this.initialized) throw new Error("DhiType not initialized");
        try {
            if (this.typeString === 'undefined' || this.typeString === 'void') {
                return values.map(v => v === undefined
                    ? { success: true, data: v as T }
                    : { success: false, errors: [{ path: "", message: "Expected undefined" }] }
                );
            }
            const inputs = this.typeString === 'object'
                ? (values as Record<string, any> [])
                : values.map(v => ({ value: v }));
            const results = this.core.validate_batch(inputs as any);
            return Array.from(results).map((isValid, i) => {
                if (isValid) {
                    return { success: true, data: values[i] as T };
                }
                return {
                    success: false,
                    errors: [{ path: "", message: "Validation failed" }]
                };
            });
        } catch (error) {
            return values.map(() => ({
                success: false,
                errors: [{ path: "", message: error instanceof Error ? error.message : "Unknown error" }]
            }));
        }
    }

    // Add method to toggle debug mode
    setDebug(debug: boolean): void {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.set_debug(debug);
    }

    // Primitive types
    date(): DhiType<Date> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "date", true);
        this.typeString = 'date';
        return this as unknown as DhiType<Date>;
    }

    bigint(): DhiType<bigint> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "bigint", true);
        this.typeString = 'bigint';
        return this as unknown as DhiType<bigint>;
    }

    symbol(): DhiType<symbol> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "symbol", true);
        this.typeString = 'symbol';
        return this as unknown as DhiType<symbol>;
    }

    // Empty types
    undefined(): DhiType<undefined> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "undefined", true);
        this.typeString = 'undefined';
        return this as unknown as DhiType<undefined>;
    }

    null(): DhiType<null> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "null", true);
        this.typeString = 'null';
        return this as unknown as DhiType<null>;
    }

    void(): DhiType<void> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "void", true);
        this.typeString = 'void';
        return this as unknown as DhiType<void>;
    }

    // Catch-all types
    any(): DhiType<any> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "any", true);
        this.typeString = "any";
        this.optional = () => {
            this.core.set_optional(true);
            return this as unknown as DhiType<any | undefined>;
        };
        return this as unknown as DhiType<any>;
    }

    unknown(): DhiType<unknown> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "unknown", true);
        this.typeString = 'unknown';
        return this as unknown as DhiType<unknown>;
    }

    // Never type
    never(): DhiType<never> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.add_field("value", "never", true);
        this.typeString = 'never';
        return this as unknown as DhiType<never>;
    }

    record<K extends string, V>(valueType: DhiType<V>): DhiType<Record<K, V>> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        // Use parser-friendly 'Record<inner>' so Rust builds FieldType::Record(inner)
        this.core.add_field("value", `Record<${valueType.typeString}>`, true);
        this.typeString = `Record<${valueType.typeString}>`;
        return this as unknown as DhiType<Record<K, V>>;
    }

    // Add method to set type string
    setTypeString(type: string): this {
        if (!this.initialized) throw new Error("DhiType not initialized");
        // Ensure a field exists for non-object roots
        this.core.add_field("value", type, true);
        this.typeString = type;
        return this;
    }
}

// Export the main API
export const dhi = {
    create: DhiType.create,
    // Primitive creators
    async string(): Promise<DhiType<string>> { return (await DhiType.create<string>()).string(); },
    async number(): Promise<DhiType<number>> { return (await DhiType.create<number>()).number(); },
    async boolean(): Promise<DhiType<boolean>> { return (await DhiType.create<boolean>()).boolean(); },
    async date(): Promise<DhiType<Date>> { return (await DhiType.create<Date>()).date(); },
    async bigint(): Promise<DhiType<bigint>> { return (await DhiType.create<bigint>()).bigint(); },
    async symbol(): Promise<DhiType<symbol>> { return (await DhiType.create<symbol>()).symbol(); },
    async undefined(): Promise<DhiType<undefined>> { return (await DhiType.create<undefined>()).undefined(); },
    async null(): Promise<DhiType<null>> { return (await DhiType.create<null>()).null(); },
    async void(): Promise<DhiType<void>> { return (await DhiType.create<void>()).void(); },
    async any(): Promise<DhiType<any>> { return (await DhiType.create<any>()).any(); },
    async unknown(): Promise<DhiType<unknown>> { return (await DhiType.create<unknown>()).unknown(); },
    async never(): Promise<DhiType<never>> { return (await DhiType.create<never>()).never(); },

    // Combinators/containers
    async array<T>(itemType: DhiType<T>): Promise<DhiType<T[]>> {
        return (await DhiType.create<T[]>()).array(itemType);
    },
    async object<U extends Record<string, any>>(shape: { [K in keyof U]: DhiType<U[K]> }): Promise<DhiType<U>> {
        return (await DhiType.create<U>()).object(shape);
    },
    async record<K extends string, V>(valueType: DhiType<V>): Promise<DhiType<Record<K, V>>> {
        return (await DhiType.create<Record<K, V>>()).record<K, V>(valueType);
    },
    async optional<T>(inner: DhiType<T>): Promise<DhiType<T | undefined>> {
        return inner.optional();
    },
    async nullable<T>(inner: DhiType<T>): Promise<DhiType<T | null>> {
        return inner.nullable();
    },
};

export function createType<T>(): Promise<DhiType<T>> {
    return DhiType.create<T>();
}
