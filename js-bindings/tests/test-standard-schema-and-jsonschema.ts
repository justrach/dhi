/**
 * Tests for Issue #55:
 *  A) Standard Schema (`~standard`) adapter on the TS binding.
 *  B) JSON Schema import (`z.fromJsonSchema`) — define-once / cross-language.
 *
 * Run: bun run tests/test-standard-schema-and-jsonschema.ts
 */
import { z, fromJsonSchema } from "../index.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// ---------------------------------------------------------------------------
console.log("A) Standard Schema (~standard)");
// ---------------------------------------------------------------------------
{
  const Chat = z.object({
    prompt: z.string(),
    model: z.string().optional(),
  });

  const std = (Chat as any)["~standard"];
  check("has ~standard", !!std);
  check("version is 1", std.version === 1);
  check("vendor is dhi", std.vendor === "dhi");
  check("validate is a function", typeof std.validate === "function");

  const okResult = await std.validate({ prompt: "hi" });
  check("valid input -> { value }", "value" in okResult && okResult.value.prompt === "hi");

  const badResult = await std.validate({ prompt: 123 });
  check("invalid input -> { issues }", "issues" in badResult && Array.isArray(badResult.issues));
  check("issue has message", "issues" in badResult && typeof badResult.issues[0]?.message === "string");
  check("issue has path", "issues" in badResult && Array.isArray(badResult.issues[0]?.path));
}

// ---------------------------------------------------------------------------
console.log("B) JSON Schema import (z.fromJsonSchema)");
// ---------------------------------------------------------------------------
{
  const doc = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100, description: "User's name" },
      age: { type: "integer", minimum: 0, maximum: 150 },
      email: { type: "string", format: "email" },
      role: { enum: ["admin", "user", "guest"] },
      bio: { type: ["string", "null"] },
      tags: { type: "array", items: { type: "string" }, minItems: 1 },
    },
    required: ["name", "age", "email", "role"],
  };

  const Schema = fromJsonSchema(doc);

  const good = Schema.safeParse({
    name: "Alice",
    age: 30,
    email: "alice@example.com",
    role: "admin",
    bio: null,
    tags: ["x"],
  });
  check("valid object passes", good.success === true);

  check("missing required 'email' fails", z.toJSONSchema(Schema) && Schema.safeParse({ name: "A", age: 1, role: "user" }).success === false);
  check("bad email fails", Schema.safeParse({ name: "A", age: 1, email: "nope", role: "user" }).success === false);
  check("age below minimum fails", Schema.safeParse({ name: "A", age: -1, email: "a@b.co", role: "user" }).success === false);
  check("non-integer age fails", Schema.safeParse({ name: "A", age: 1.5, email: "a@b.co", role: "user" }).success === false);
  check("bad enum role fails", Schema.safeParse({ name: "A", age: 1, email: "a@b.co", role: "wizard" }).success === false);
  check("empty tags array fails (minItems)", Schema.safeParse({ name: "A", age: 1, email: "a@b.co", role: "user", tags: [] }).success === false);
  check("optional bio omitted is OK", Schema.safeParse({ name: "A", age: 1, email: "a@b.co", role: "user" }).success === true);
  check("nullable bio null is OK", Schema.safeParse({ name: "A", age: 1, email: "a@b.co", role: "user", bio: null }).success === true);
}

// ---------------------------------------------------------------------------
console.log("B2) Round-trip: toJsonSchema -> fromJsonSchema -> validate");
// ---------------------------------------------------------------------------
{
  const Original = z.object({
    id: z.string().uuid(),
    count: z.number().int().min(0),
    name: z.string().min(1).max(50),
    nickname: z.string().optional(),
  });

  const json = Original.toJsonSchema();
  const Rebuilt = fromJsonSchema(json);

  const sample = { id: "550e8400-e29b-41d4-a716-446655440000", count: 3, name: "bob" };
  check("rebuilt accepts valid", Rebuilt.safeParse(sample).success === true);
  check("rebuilt rejects bad uuid", Rebuilt.safeParse({ ...sample, id: "not-a-uuid" }).success === false);
  check("rebuilt rejects negative count", Rebuilt.safeParse({ ...sample, count: -1 }).success === false);

  // Re-export and compare structural keys round-trips stably.
  const json2 = Rebuilt.toJsonSchema();
  check("round-trip keeps 'type: object'", json2.type === "object");
  check("round-trip keeps required set", JSON.stringify((json2.required || []).sort()) === JSON.stringify((json.required || []).sort()));
}

// ---------------------------------------------------------------------------
console.log("B3) $ref resolution");
// ---------------------------------------------------------------------------
{
  const doc = {
    type: "object",
    properties: {
      user: { $ref: "#/$defs/User" },
    },
    required: ["user"],
    $defs: {
      User: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
      },
    },
  };
  const Schema = fromJsonSchema(doc);
  check("$ref valid nested passes", Schema.safeParse({ user: { id: 1 } }).success === true);
  check("$ref invalid nested fails", Schema.safeParse({ user: { id: "x" } }).success === false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
