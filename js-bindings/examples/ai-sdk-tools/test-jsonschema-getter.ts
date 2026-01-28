/**
 * Test: Verify dhi's jsonSchema getter for AI SDK compatibility
 */
import { z } from '../../schema';

// Test basic schema
const UserSchema = z.object({
  name: z.string().min(1).describe("User's name"),
  email: z.string().email(),
  age: z.number().int().positive(),
});

console.log('='.repeat(60));
console.log('  Testing dhi jsonSchema getter for AI SDK compatibility');
console.log('='.repeat(60));
console.log('');

// Test 1: jsonSchema getter exists
console.log('Test 1: jsonSchema getter exists');
console.log('  typeof UserSchema.jsonSchema:', typeof UserSchema.jsonSchema);
console.log('  Result:', typeof UserSchema.jsonSchema === 'object' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 2: jsonSchema returns valid schema
console.log('Test 2: jsonSchema returns valid JSON Schema');
const schema = UserSchema.jsonSchema;
console.log('  schema.type:', schema.type);
console.log('  schema.properties:', Object.keys(schema.properties || {}));
console.log('  Result:', schema.type === 'object' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 3: Same as toJsonSchema()
console.log('Test 3: jsonSchema getter matches toJsonSchema() method');
const method = UserSchema.toJsonSchema();
const getter = UserSchema.jsonSchema;
const matches = JSON.stringify(method) === JSON.stringify(getter);
console.log('  Matches:', matches ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 4: Works with nested schemas
const ComplexSchema = z.object({
  user: z.object({
    name: z.string(),
    role: z.enum(['admin', 'user']),
  }),
  items: z.array(z.number()),
});

console.log('Test 4: Works with nested schemas');
const complexJsonSchema = ComplexSchema.jsonSchema;
console.log('  Has user property:', 'user' in (complexJsonSchema.properties || {}));
console.log('  Has items property:', 'items' in (complexJsonSchema.properties || {}));
console.log('  Result:', complexJsonSchema.type === 'object' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 5: Output the full schema
console.log('Test 5: Full JSON Schema output');
console.log(JSON.stringify(UserSchema.jsonSchema, null, 2));
console.log('');

console.log('='.repeat(60));
console.log('  All tests completed!');
console.log('='.repeat(60));
