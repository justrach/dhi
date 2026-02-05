/**
 * Test that dhi schemas work with Vercel AI SDK's generateObject
 * This test mimics the exact usage pattern from the user's flag.ts file
 */

import { z } from '../dist/schema.js';
import { generateObject, type CoreMessage } from 'ai';

// This is the exact pattern from the user's flag.ts
const schema = z.object({
  reason: z.string(),
  threatFlag: z.boolean(),
});

// Type inference should work
type SchemaOutput = z.infer<typeof schema>;

// Verify the inferred type is correct
const _typeCheck: SchemaOutput = {
  reason: 'test',
  threatFlag: true,
};

console.log('Schema created successfully');
console.log('Type inference working:', typeof _typeCheck);

// The critical test: Can we pass dhi schema to generateObject's type signature?
// We don't actually call it (no model), but TypeScript should accept the types

// This type-checks the generateObject signature compatibility
async function mockUsage() {
  // This line would be the actual usage - TypeScript should not complain about schema type
  // const result = await generateObject({
  //   schema,
  //   model: someModel,
  //   messages: [],
  // });

  // For type checking purposes, verify schema satisfies FlexibleSchema
  const schemaForAI: Parameters<typeof generateObject>[0]['schema'] = schema;
  console.log('Schema type-checks for generateObject:', schemaForAI !== undefined);
}

await mockUsage();

console.log('\n✅ dhi schema is type-compatible with generateObject!');
