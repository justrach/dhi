---
name: dhi-typescript
description: Ultra-fast validation library for TypeScript/JavaScript (77x faster than Zod). Use when building validated schemas for APIs, forms, or data processing. Provides Zod 4-compatible API with WASM-powered SIMD validation.
dependencies: dhi
license: MIT
---

# dhi - Ultra-Fast TypeScript Validation

## Overview

dhi is a high-performance validation library for TypeScript and JavaScript, powered by Zig-compiled WebAssembly with SIMD optimizations. It provides a **Zod 4-compatible API** while being **77x faster** for validation operations.

Use dhi when you need:
- Fast schema validation for APIs
- Form validation in frontend apps
- Data parsing and transformation
- Type-safe runtime validation

---

## Installation

```bash
# npm
npm install dhi

# bun
bun add dhi

# pnpm
pnpm add dhi
```

---

## Quick Start

### Basic Schema

```typescript
import { z } from 'dhi';

const UserSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(120),
  email: z.string().email(),
  score: z.number().default(0),
});

type User = z.infer<typeof UserSchema>;

// Parse and validate
const user = UserSchema.parse({
  name: "Alice",
  age: 25,
  email: "alice@example.com"
});
```

### Safe Parsing

```typescript
const result = UserSchema.safeParse(data);

if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.issues);
}
```

---

## Schema Types

### Primitives

```typescript
z.string()
z.number()
z.boolean()
z.bigint()
z.date()
z.undefined()
z.null()
z.void()
z.any()
z.unknown()
z.never()
```

### String Validations

```typescript
z.string()
  .min(1)              // Minimum length
  .max(100)            // Maximum length
  .length(10)          // Exact length
  .email()             // Email format
  .url()               // URL format
  .uuid()              // UUID format
  .cuid()              // CUID format
  .cuid2()             // CUID2 format
  .ulid()              // ULID format
  .regex(/pattern/)    // Custom regex
  .includes("text")    // Contains substring
  .startsWith("pre")   // Starts with
  .endsWith("suf")     // Ends with
  .datetime()          // ISO datetime
  .ip()                // IP address
  .trim()              // Trim whitespace
  .toLowerCase()       // Convert to lowercase
  .toUpperCase()       // Convert to uppercase
```

### Number Validations

```typescript
z.number()
  .int()               // Integer only
  .positive()          // > 0
  .nonnegative()       // >= 0
  .negative()          // < 0
  .nonpositive()       // <= 0
  .min(0)              // >= value
  .max(100)            // <= value
  .gt(0)               // > value
  .lt(100)             // < value
  .multipleOf(5)       // Multiple of
  .finite()            // No Infinity
  .safe()              // Safe integer range
```

### Objects

```typescript
const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// Optional fields
const PartialPerson = PersonSchema.partial();

// Required fields
const RequiredPerson = PersonSchema.required();

// Pick specific fields
const NameOnly = PersonSchema.pick({ name: true });

// Omit fields
const NoAge = PersonSchema.omit({ age: true });

// Extend schema
const Employee = PersonSchema.extend({
  employeeId: z.string(),
});

// Merge schemas
const Combined = PersonSchema.merge(AddressSchema);

// Strict mode (no extra keys)
const StrictPerson = PersonSchema.strict();

// Passthrough (keep extra keys)
const LoosePerson = PersonSchema.passthrough();
```

### Arrays

```typescript
z.array(z.string())
  .min(1)              // Minimum items
  .max(10)             // Maximum items
  .length(5)           // Exact length
  .nonempty()          // At least one item

// Tuples
z.tuple([z.string(), z.number()])
```

### Unions and Intersections

```typescript
// Union (OR)
const StringOrNumber = z.union([z.string(), z.number()]);

// Discriminated union
const Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("scroll"), offset: z.number() }),
]);

// Intersection (AND)
const Combined = z.intersection(SchemaA, SchemaB);
```

### Enums and Literals

```typescript
// String enum
const Status = z.enum(["pending", "active", "archived"]);

// Native enum
enum Direction { Up, Down, Left, Right }
const DirectionSchema = z.nativeEnum(Direction);

// Literal
const One = z.literal(1);
const Hello = z.literal("hello");
```

### Optional and Nullable

```typescript
z.string().optional()     // string | undefined
z.string().nullable()     // string | null
z.string().nullish()      // string | null | undefined
```

### Transformations

```typescript
// Transform value
const Trimmed = z.string().transform(s => s.trim());

// Coerce types
z.coerce.string()   // Convert to string
z.coerce.number()   // Convert to number
z.coerce.boolean()  // Convert to boolean
z.coerce.date()     // Convert to Date

// Preprocess
const Schema = z.preprocess(
  (val) => String(val).trim(),
  z.string()
);

// Pipe (chain schemas)
const Pipeline = z.string()
  .transform(s => s.split(","))
  .pipe(z.array(z.string()));
```

### Records and Maps

```typescript
// Record (object with dynamic keys)
z.record(z.string())              // Record<string, string>
z.record(z.string(), z.number()) // Record<string, number>

// Map
z.map(z.string(), z.number())
```

### Refinements

```typescript
// Custom validation
const EvenNumber = z.number().refine(
  n => n % 2 === 0,
  { message: "Must be even" }
);

// Superrefine for complex validation
const PasswordSchema = z.object({
  password: z.string(),
  confirm: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ["confirm"],
    });
  }
});
```

---

## Error Handling

```typescript
try {
  UserSchema.parse(invalidData);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.issues);
    console.log(error.format());
    console.log(error.flatten());
  }
}
```

---

## Type Inference

```typescript
// Infer input type
type UserInput = z.input<typeof UserSchema>;

// Infer output type (after transforms)
type UserOutput = z.output<typeof UserSchema>;

// Shorthand for output
type User = z.infer<typeof UserSchema>;
```

---

## Performance

dhi is **77x faster** than Zod for validation operations:

| Operation | dhi | Zod | Speedup |
|-----------|-----|-----|---------|
| String formats | 46M/sec | 0.6M/sec | 77x |
| Object validation | Fast | Slower | ~50x |
| Array validation | Fast | Slower | ~40x |

---

## Next.js Integration

```typescript
// app/api/users/route.ts
import { z } from 'dhi';
import { NextResponse } from 'next/server';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = CreateUserSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    );
  }

  // result.data is fully typed
  return NextResponse.json({ user: result.data });
}
```

---

## Edge Runtime Compatible

dhi works in edge runtimes (Vercel Edge, Cloudflare Workers) with a tiny 28KB WASM bundle.

```typescript
export const runtime = 'edge';

import { z } from 'dhi';
// Works in edge functions!
```

---

## Migration from Zod

dhi is designed as a drop-in replacement:

```typescript
// Before (Zod)
import { z } from 'zod';

// After (dhi)
import { z } from 'dhi';
```

Most Zod 4 code works unchanged with dhi.

---

## When to Use

Use dhi when:
- Building high-performance APIs
- Need fast form validation
- Working with edge runtimes
- Processing large volumes of data
- Need Zod compatibility with better performance

---

## Resources

- **npm**: https://www.npmjs.com/package/dhi
- **GitHub**: https://github.com/justrach/dhi
- **Documentation**: See README.md in repository
