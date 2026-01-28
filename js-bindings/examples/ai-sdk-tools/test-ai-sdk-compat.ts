/**
 * Test: Verify dhi's full AI SDK compatibility
 *
 * The AI SDK's isSchema() check requires:
 * 1. Symbol.for("vercel.ai.schema") === true
 * 2. "jsonSchema" property exists
 * 3. "validate" property exists
 */
import { z } from '../../schema';

const schemaSymbol = Symbol.for("vercel.ai.schema");

// AI SDK's isSchema function (copied from @ai-sdk/ui-utils)
function isSchema(value: any): boolean {
  return typeof value === "object" &&
    value !== null &&
    schemaSymbol in value &&
    value[schemaSymbol] === true &&
    "jsonSchema" in value &&
    "validate" in value;
}

console.log('='.repeat(60));
console.log('  Testing dhi AI SDK Full Compatibility');
console.log('='.repeat(60));
console.log('');

const UserSchema = z.object({
  name: z.string().min(1).describe("User's name"),
  email: z.string().email(),
  age: z.number().int().positive(),
});

// Test 1: Symbol marker exists
console.log('Test 1: Symbol.for("vercel.ai.schema") marker');
const hasSymbol = schemaSymbol in UserSchema;
const symbolValue = hasSymbol ? (UserSchema as any)[schemaSymbol] : undefined;
console.log('  Has symbol:', hasSymbol);
console.log('  Symbol value:', symbolValue);
console.log('  Result:', symbolValue === true ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 2: jsonSchema getter exists
console.log('Test 2: jsonSchema getter');
const hasJsonSchema = 'jsonSchema' in UserSchema;
const jsonSchema = (UserSchema as any).jsonSchema;
console.log('  Has jsonSchema:', hasJsonSchema);
console.log('  jsonSchema type:', typeof jsonSchema);
console.log('  Result:', hasJsonSchema && typeof jsonSchema === 'object' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 3: validate function exists
console.log('Test 3: validate function');
const hasValidate = 'validate' in UserSchema;
const validate = (UserSchema as any).validate;
console.log('  Has validate:', hasValidate);
console.log('  validate type:', typeof validate);
console.log('  Result:', hasValidate && typeof validate === 'function' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 4: validate function works correctly
console.log('Test 4: validate function works');
const validData = { name: 'Alice', email: 'alice@example.com', age: 25 };
const invalidData = { name: '', email: 'invalid', age: -5 };

const validResult = validate.call(UserSchema, validData);
const invalidResult = validate.call(UserSchema, invalidData);

console.log('  Valid data result:', validResult.success);
console.log('  Invalid data result:', invalidResult.success);
console.log('  Result:', validResult.success === true && invalidResult.success === false ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 5: isSchema() function passes
console.log('Test 5: AI SDK isSchema() check');
const passesIsSchema = isSchema(UserSchema);
console.log('  isSchema(UserSchema):', passesIsSchema);
console.log('  Result:', passesIsSchema ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 6: Test with various schema types
console.log('Test 6: Various schema types pass isSchema()');
const schemas = [
  { name: 'z.string()', schema: z.string() },
  { name: 'z.number()', schema: z.number() },
  { name: 'z.boolean()', schema: z.boolean() },
  { name: 'z.array(z.string())', schema: z.array(z.string()) },
  { name: 'z.enum(["a", "b"])', schema: z.enum(['a', 'b']) },
  { name: 'z.object({}).optional()', schema: z.object({}).optional() },
  { name: 'z.union([z.string(), z.number()])', schema: z.union([z.string(), z.number()]) },
];

let allPass = true;
for (const { name, schema } of schemas) {
  const passes = isSchema(schema);
  console.log(`  ${name}: ${passes ? '✅' : '❌'}`);
  if (!passes) allPass = false;
}
console.log('  Result:', allPass ? '✅ PASS' : '❌ FAIL');
console.log('');

console.log('='.repeat(60));
console.log('  All compatibility tests completed!');
console.log('='.repeat(60));
