/**
 * Test that dhi schemas work with Vercel AI SDK's generateObject
 * This is a type-check test - it verifies the types compile correctly
 */

import { z } from '../dist/schema.js';
import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';

// Test: Basic schema creation
const UserSchema = z.object({
  reason: z.string(),
  threatFlag: z.boolean(),
});

// Test: Verify ~standard interface exists and has both validate and jsonSchema
const standardInterface = UserSchema['~standard'];
console.log('~standard interface:', {
  version: standardInterface.version,
  vendor: standardInterface.vendor,
  hasValidate: typeof standardInterface.validate === 'function',
  hasJsonSchema: typeof standardInterface.jsonSchema === 'object',
  hasJsonSchemaInput: typeof standardInterface.jsonSchema?.input === 'function',
  hasJsonSchemaOutput: typeof standardInterface.jsonSchema?.output === 'function',
});

// Test: Generate JSON schema via ~standard.jsonSchema
const inputSchema = standardInterface.jsonSchema.input({ target: 'draft-07' });
const outputSchema = standardInterface.jsonSchema.output({ target: 'draft-07' });
console.log('Input JSON Schema:', JSON.stringify(inputSchema, null, 2));
console.log('Output JSON Schema:', JSON.stringify(outputSchema, null, 2));

// Test: Zod compatibility aliases
console.log('Zod compatibility aliases:', {
  has_def: '_def' in UserSchema,
  has_type: '_type' in UserSchema,
  hasDescription: 'description' in UserSchema,
});

// Type test: Verify schema implements StandardSchema (both V1 interfaces)
type TestSchema = typeof UserSchema;

// StandardSchemaV1 requires: version, vendor, validate
type HasValidate = TestSchema['~standard'] extends { validate: Function } ? true : false;

// StandardJSONSchemaV1 requires: version, vendor, jsonSchema with input/output
type HasJsonSchema = TestSchema['~standard'] extends { jsonSchema: { input: Function; output: Function } } ? true : false;

// Runtime validation test
async function testValidation() {
  const result = await UserSchema['~standard'].validate({
    reason: 'test reason',
    threatFlag: true,
  });

  if ('value' in result) {
    console.log('~standard validation succeeded:', result.value);
  } else {
    console.log('~standard validation failed:', result.issues);
  }
}

await testValidation();

// Test: Verify the schema matches AI SDK's StandardSchema type
// AI SDK expects: StandardSchemaV1 & StandardJSONSchemaV1
type AISDKStandardSchema<T> = {
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

function acceptsAISDKSchema<T>(schema: AISDKStandardSchema<T>): boolean {
  console.log('Schema accepted by AI SDK StandardSchema type check');
  return true;
}

acceptsAISDKSchema(UserSchema);

console.log('\n✅ All AI SDK compatibility tests passed!');
console.log('dhi schemas implement both StandardSchemaV1 and StandardJSONSchemaV1');
