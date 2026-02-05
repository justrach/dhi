/**
 * Strict type check for AI SDK generateObject compatibility
 * This test verifies dhi schemas satisfy the FlexibleSchema type
 */

import { z } from '../dist/schema.js';

// The exact schema from flag.ts
const schema = z.object({
  reason: z.string(),
  threatFlag: z.boolean(),
});

// AI SDK's FlexibleSchema is a union of:
// - Schema<T> (internal)
// - LazySchema<T> (function)
// - ZodSchema<T> (z3 or z4)
// - StandardSchema<T> (StandardSchemaV1 & StandardJSONSchemaV1)

// dhi implements StandardSchema, which requires:
// 1. ~standard.version: 1
// 2. ~standard.vendor: string
// 3. ~standard.validate: function
// 4. ~standard.jsonSchema: { input: function, output: function }

// Type assertion: verify schema implements StandardSchema
type StandardSchemaV1<T> = {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Promise<{ value: T } | { issues: ReadonlyArray<{ message: string }> }>;
    readonly jsonSchema: {
      readonly input: (options: { target: string }) => Record<string, unknown>;
      readonly output: (options: { target: string }) => Record<string, unknown>;
    };
  };
};

// This line will fail to compile if dhi doesn't satisfy StandardSchema
const standardSchema: StandardSchemaV1<{ reason: string; threatFlag: boolean }> = schema;

// Verify all properties exist at runtime
console.log('Schema satisfies StandardSchemaV1:');
console.log('  ~standard.version:', standardSchema['~standard'].version);
console.log('  ~standard.vendor:', standardSchema['~standard'].vendor);
console.log('  ~standard.validate:', typeof standardSchema['~standard'].validate);
console.log('  ~standard.jsonSchema.input:', typeof standardSchema['~standard'].jsonSchema.input);
console.log('  ~standard.jsonSchema.output:', typeof standardSchema['~standard'].jsonSchema.output);

// Test the jsonSchema methods
const inputSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });
const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

console.log('\nJSON Schema output:');
console.log(JSON.stringify(inputSchema, null, 2));

// Test validation
const result = await standardSchema['~standard'].validate({ reason: 'test', threatFlag: true });
console.log('\nValidation result:', result);

console.log('\n✅ dhi schema fully implements StandardSchemaV1 (required by AI SDK generateObject)');
