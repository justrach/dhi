import init, { DhiCore } from '../dist/dhi_core.js';

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
    private core!: DhiCore;
    private initialized: boolean = false;
    private typeString: string = '';

    private constructor() {
        this.initialized = false;
    }

    static async create<T>(): Promise<DhiType<T>> {
        if (!wasmInitialized) {
            await init();
            wasmInitialized = true;
        }
        const type = new DhiType<T>();
        type.core = new DhiCore();
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
        
        for (const [key, type] of Object.entries(shape)) {
            if (!(type instanceof DhiType)) {
                throw new Error(`Invalid type for field ${key}`);
            }
            this.core.add_field(key, type.typeString, true);
        }
        
        this.typeString = "object";
        return this as unknown as DhiType<U>;
    }

    optional(): DhiType<T | undefined> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.set_optional(true);
        return this as unknown as DhiType<T | undefined>;
    }

    nullable(): DhiType<T | null> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.core.set_nullable(true);
        return this as unknown as DhiType<T | null>;
    }

    validate(value: unknown): ValidationResult<T> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        
        try {
            const flattenedValue = this.flattenObject(value as Record<string, any>);
            const isValid = this.core.validate(flattenedValue);
            if (isValid) {
                return {
                    success: true,
                    data: value as T
                };
            } else {
                return {
                    success: false,
                    errors: [{
                        path: "",
                        message: "Validation failed"
                    }]
                };
            }
        } catch (error) {
            return {
                success: false,
                errors: [{
                    path: "",
                    message: error instanceof Error ? error.message : "Unknown error"
                }]
            };
        }
    }

    private flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
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
            // Flatten all objects in the batch
            const flattenedValues = values.map(v => 
                this.flattenObject(v as Record<string, any>)
            );
            const results = this.core.validate_batch(flattenedValues as any);
            
            return Array.from(results).map((isValid, i) => {
                if (isValid) {
                    return {
                        success: true,
                        data: values[i] as T
                    };
                } else {
                    return {
                        success: false,
                        errors: [{
                            path: "",
                            message: "Validation failed"
                        }]
                    };
                }
            });
        } catch (error) {
            return values.map(() => ({
                success: false,
                errors: [{
                    path: "",
                    message: error instanceof Error ? error.message : "Unknown error"
                }]
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
        this.typeString = 'date';
        return this as unknown as DhiType<Date>;
    }

    bigint(): DhiType<bigint> {
        this.typeString = 'bigint';
        return this as unknown as DhiType<bigint>;
    }

    symbol(): DhiType<symbol> {
        this.typeString = 'symbol';
        return this as unknown as DhiType<symbol>;
    }

    // Empty types
    undefined(): DhiType<undefined> {
        this.typeString = 'undefined';
        return this as unknown as DhiType<undefined>;
    }

    null(): DhiType<null> {
        this.typeString = 'null';
        return this as unknown as DhiType<null>;
    }

    void(): DhiType<void> {
        this.typeString = 'void';
        return this as unknown as DhiType<void>;
    }

    // Catch-all types
    any(): DhiType<any> {
        this.typeString = 'any';
        return this as unknown as DhiType<any>;
    }

    unknown(): DhiType<unknown> {
        this.typeString = 'unknown';
        return this as unknown as DhiType<unknown>;
    }

    // Never type
    never(): DhiType<never> {
        this.typeString = 'never';
        return this as unknown as DhiType<never>;
    }

    record<K extends string, V>(valueType: DhiType<V>): DhiType<Record<K, V>> {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.typeString = 'record';
        this.core.set_value_type(valueType.typeString);
        return this as unknown as DhiType<Record<K, V>>;
    }

    // Add method to set type string
    setTypeString(type: string): this {
        if (!this.initialized) throw new Error("DhiType not initialized");
        this.typeString = type;
        return this;
    }
}