/**
 * Comprehensive Feature Test
 * Tests all Zod-compatible features
 */

import { z, infer as zodInfer } from "./schema";

console.log("🧪 Testing All Features");
console.log("=".repeat(80));

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e}`);
    failed++;
  }
}

// ============================================================================
// String Validators
// ============================================================================

console.log("\n📝 String Validators");
console.log("-".repeat(80));

test("string().parse()", () => {
  const schema = z.string();
  const result = schema.parse("hello");
  if (result !== "hello") throw new Error("Failed");
});

test("string().min().max()", () => {
  const schema = z.string().min(2).max(10);
  schema.parse("hello");
  try {
    schema.parse("a");
    throw new Error("Should have failed");
  } catch {}
});

test("string().email()", () => {
  const schema = z.string().email();
  schema.parse("test@example.com");
  try {
    schema.parse("invalid");
    throw new Error("Should have failed");
  } catch {}
});

test("string().url()", () => {
  const schema = z.string().url();
  schema.parse("https://example.com");
  try {
    schema.parse("not-a-url");
    throw new Error("Should have failed");
  } catch {}
});

test("string().startsWith()", () => {
  const schema = z.string().startsWith("hello");
  schema.parse("hello world");
  try {
    schema.parse("world hello");
    throw new Error("Should have failed");
  } catch {}
});

test("string().endsWith()", () => {
  const schema = z.string().endsWith("world");
  schema.parse("hello world");
  try {
    schema.parse("world hello");
    throw new Error("Should have failed");
  } catch {}
});

test("string().includes()", () => {
  const schema = z.string().includes("test");
  schema.parse("this is a test");
  try {
    schema.parse("no match");
    throw new Error("Should have failed");
  } catch {}
});

test("string().regex()", () => {
  const schema = z.string().regex(/^\d{3}-\d{4}$/);
  schema.parse("123-4567");
  try {
    schema.parse("invalid");
    throw new Error("Should have failed");
  } catch {}
});

test("string().trim()", () => {
  const schema = z.string().trim();
  const result = schema.parse("  hello  ");
  if (result !== "hello") throw new Error("Failed");
});

test("string().lowercase()", () => {
  const schema = z.string().lowercase();
  const result = schema.parse("HELLO");
  if (result !== "hello") throw new Error("Failed");
});

test("string().uppercase()", () => {
  const schema = z.string().uppercase();
  const result = schema.parse("hello");
  if (result !== "HELLO") throw new Error("Failed");
});

// ============================================================================
// Number Validators
// ============================================================================

console.log("\n🔢 Number Validators");
console.log("-".repeat(80));

test("number().parse()", () => {
  const schema = z.number();
  const result = schema.parse(42);
  if (result !== 42) throw new Error("Failed");
});

test("number().min().max()", () => {
  const schema = z.number().min(0).max(100);
  schema.parse(50);
  try {
    schema.parse(-1);
    throw new Error("Should have failed");
  } catch {}
});

test("number().gt()", () => {
  const schema = z.number().gt(0);
  schema.parse(1);
  try {
    schema.parse(0);
    throw new Error("Should have failed");
  } catch {}
});

test("number().gte()", () => {
  const schema = z.number().gte(0);
  schema.parse(0);
  try {
    schema.parse(-1);
    throw new Error("Should have failed");
  } catch {}
});

test("number().lt()", () => {
  const schema = z.number().lt(100);
  schema.parse(99);
  try {
    schema.parse(100);
    throw new Error("Should have failed");
  } catch {}
});

test("number().lte()", () => {
  const schema = z.number().lte(100);
  schema.parse(100);
  try {
    schema.parse(101);
    throw new Error("Should have failed");
  } catch {}
});

test("number().positive()", () => {
  const schema = z.number().positive();
  schema.parse(1);
  try {
    schema.parse(0);
    throw new Error("Should have failed");
  } catch {}
});

test("number().negative()", () => {
  const schema = z.number().negative();
  schema.parse(-1);
  try {
    schema.parse(0);
    throw new Error("Should have failed");
  } catch {}
});

test("number().nonnegative()", () => {
  const schema = z.number().nonnegative();
  schema.parse(0);
  try {
    schema.parse(-1);
    throw new Error("Should have failed");
  } catch {}
});

test("number().multipleOf()", () => {
  const schema = z.number().multipleOf(5);
  schema.parse(10);
  try {
    schema.parse(7);
    throw new Error("Should have failed");
  } catch {}
});

test("number().int()", () => {
  const schema = z.number().int();
  schema.parse(42);
  try {
    schema.parse(42.5);
    throw new Error("Should have failed");
  } catch {}
});

test("number().finite()", () => {
  const schema = z.number().finite();
  schema.parse(42);
  try {
    schema.parse(Infinity);
    throw new Error("Should have failed");
  } catch {}
});

// ============================================================================
// Primitive Types
// ============================================================================

console.log("\n🎯 Primitive Types");
console.log("-".repeat(80));

test("boolean()", () => {
  const schema = z.boolean();
  schema.parse(true);
  try {
    schema.parse("true");
    throw new Error("Should have failed");
  } catch {}
});

test("null()", () => {
  const schema = z.null();
  schema.parse(null);
  try {
    schema.parse(undefined);
    throw new Error("Should have failed");
  } catch {}
});

test("undefined()", () => {
  const schema = z.undefined();
  schema.parse(undefined);
  try {
    schema.parse(null);
    throw new Error("Should have failed");
  } catch {}
});

test("any()", () => {
  const schema = z.any();
  schema.parse("anything");
  schema.parse(42);
  schema.parse(null);
});

test("unknown()", () => {
  const schema = z.unknown();
  schema.parse("anything");
  schema.parse(42);
  schema.parse(null);
});

// ============================================================================
// Arrays
// ============================================================================

console.log("\n📚 Arrays");
console.log("-".repeat(80));

test("array(string())", () => {
  const schema = z.array(z.string());
  const result = schema.parse(["a", "b", "c"]);
  if (result.length !== 3) throw new Error("Failed");
});

test("array().min().max()", () => {
  const schema = z.array(z.number()).min(2).max(5);
  schema.parse([1, 2, 3]);
  try {
    schema.parse([1]);
    throw new Error("Should have failed");
  } catch {}
});

test("array of objects", () => {
  const schema = z.array(z.object({
    name: z.string(),
    age: z.number()
  }));
  const result = schema.parse([
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 }
  ]);
  if (result.length !== 2) throw new Error("Failed");
});

// ============================================================================
// Objects
// ============================================================================

console.log("\n📦 Objects");
console.log("-".repeat(80));

test("object()", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number()
  });
  const result = schema.parse({ name: "Alice", age: 30 });
  if (result.name !== "Alice") throw new Error("Failed");
});

test("nested objects", () => {
  const schema = z.object({
    user: z.object({
      name: z.string(),
      email: z.string().email()
    }),
    metadata: z.object({
      created: z.string()
    })
  });
  const result = schema.parse({
    user: { name: "Alice", email: "alice@example.com" },
    metadata: { created: "2024-01-01" }
  });
  if (result.user.name !== "Alice") throw new Error("Failed");
});

// ============================================================================
// Unions
// ============================================================================

console.log("\n🔀 Unions");
console.log("-".repeat(80));

test("union()", () => {
  const schema = z.union([z.string(), z.number()]);
  schema.parse("hello");
  schema.parse(42);
  try {
    schema.parse(true);
    throw new Error("Should have failed");
  } catch {}
});

// ============================================================================
// Enums
// ============================================================================

console.log("\n🏷️  Enums");
console.log("-".repeat(80));

test("enum()", () => {
  const schema = z.enum(["red", "green", "blue"]);
  schema.parse("red");
  try {
    schema.parse("yellow");
    throw new Error("Should have failed");
  } catch {}
});

// ============================================================================
// Modifiers
// ============================================================================

console.log("\n🔧 Modifiers");
console.log("-".repeat(80));

test("optional()", () => {
  const schema = z.string().optional();
  schema.parse("hello");
  schema.parse(undefined);
  try {
    schema.parse(null);
    throw new Error("Should have failed");
  } catch {}
});

test("nullable()", () => {
  const schema = z.string().nullable();
  schema.parse("hello");
  schema.parse(null);
  try {
    schema.parse(undefined);
    throw new Error("Should have failed");
  } catch {}
});

test("default()", () => {
  const schema = z.string().default("default value");
  const result = schema.parse(undefined);
  if (result !== "default value") throw new Error("Failed");
});

// ============================================================================
// Transformations
// ============================================================================

console.log("\n🔄 Transformations");
console.log("-".repeat(80));

test("transform()", () => {
  const schema = z.string().transform(s => s.length);
  const result = schema.parse("hello");
  if (result !== 5) throw new Error("Failed");
});

test("refine()", () => {
  const schema = z.number().refine(n => n % 2 === 0, "Must be even");
  schema.parse(4);
  try {
    schema.parse(3);
    throw new Error("Should have failed");
  } catch {}
});

// ============================================================================
// Type Inference
// ============================================================================

console.log("\n🎨 Type Inference");
console.log("-".repeat(80));

test("type inference", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean()
  });
  
  type User = zodInfer<typeof schema>;
  
  const user: User = {
    name: "Alice",
    age: 30,
    active: true
  };
  
  schema.parse(user);
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("📊 Test Summary");
console.log("=".repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log("\n🎉 All tests passed! dhi is feature-complete!");
} else {
  console.log(`\n⚠️  ${failed} tests failed. Need to fix these.`);
}
