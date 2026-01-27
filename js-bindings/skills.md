# dhi TypeScript/JavaScript Skills Guide

Ultra-fast validation library for TypeScript/JavaScript. **77x faster than Zod** with full API compatibility.

## Quick Start

```bash
npm install dhi
# or
bun add dhi
```

```typescript
import { z } from 'dhi';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

type User = z.infer<typeof UserSchema>;

// Validation
const result = UserSchema.safeParse(data);
if (result.success) {
  console.log(result.data); // Typed as User
} else {
  console.log(result.error.issues);
}
```

## Core Features

### Schema Types

```typescript
import { z } from 'dhi';

// Primitives
z.string()
z.number()
z.boolean()
z.bigint()
z.date()
z.undefined()
z.null()
z.any()
z.unknown()

// Objects
z.object({
  name: z.string(),
  age: z.number().optional(),
})

// Arrays
z.array(z.string())
z.array(z.object({ id: z.string() }))

// Enums
z.enum(['admin', 'user', 'guest'])

// Unions
z.union([z.string(), z.number()])
z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), value: z.string() }),
  z.object({ type: z.literal('b'), count: z.number() }),
])

// Literals
z.literal('active')
z.literal(42)
```

### String Validations

```typescript
z.string()
  .min(1)                    // Minimum length
  .max(100)                  // Maximum length
  .length(10)                // Exact length
  .email()                   // Email format
  .url()                     // URL format
  .uuid()                    // UUID format
  .regex(/pattern/)          // Regex match
  .includes('needle')        // Contains substring
  .startsWith('http')        // Starts with
  .endsWith('.com')          // Ends with
  .trim()                    // Trim whitespace (transform)
  .toLowerCase()             // Lowercase (transform)
  .toUpperCase()             // Uppercase (transform)
  .datetime()                // ISO datetime
  .ip()                      // IP address
  .ipv4()                    // IPv4 address
  .ipv6()                    // IPv6 address
  .base64()                  // Base64 encoded
```

### Number Validations

```typescript
z.number()
  .min(0)                    // Minimum value
  .max(100)                  // Maximum value
  .int()                     // Integer only
  .positive()                // > 0
  .negative()                // < 0
  .nonnegative()             // >= 0
  .nonpositive()             // <= 0
  .multipleOf(5)             // Multiple of
  .finite()                  // Not Infinity
  .safe()                    // Safe integer range
```

### Object Methods

```typescript
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

// Partial (all optional)
const PartialUser = UserSchema.partial();

// Pick specific fields
const UserName = UserSchema.pick({ name: true, email: true });

// Omit fields
const UserWithoutId = UserSchema.omit({ id: true });

// Extend
const AdminUser = UserSchema.extend({
  permissions: z.array(z.string()),
});

// Merge
const Combined = Schema1.merge(Schema2);

// Strict (no extra keys)
const StrictUser = UserSchema.strict();

// Passthrough (allow extra keys)
const LooseUser = UserSchema.passthrough();
```

### Transforms & Coercion

```typescript
// Transform values
const schema = z.string().transform(s => s.length);

// Coerce types
z.coerce.string()   // Converts to string
z.coerce.number()   // Converts to number
z.coerce.boolean()  // Converts to boolean
z.coerce.date()     // Converts to Date

// Default values
z.string().default('unknown')
z.number().default(0)

// Optional & Nullable
z.string().optional()           // string | undefined
z.string().nullable()           // string | null
z.string().nullish()            // string | null | undefined
```

### JSON Schema Generation (Built-in!)

```typescript
// dhi has built-in JSON Schema generation (Zod needs external library)
const schema = z.object({
  name: z.string().min(1).describe("User's name"),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

// Generate JSON Schema
const jsonSchema = schema.toJsonSchema();
// or
const jsonSchema = schema.json();

// Perfect for:
// - OpenAI function calling
// - API documentation
// - Form generation
```

## Framework Integration

### Hono

```typescript
import { Hono } from 'hono';
import { z } from 'dhi';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

function validateBody<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    const body = await c.req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.issues }, 400);
    }
    c.set('body', result.data);
    await next();
  };
}

const app = new Hono()
  .post('/users', validateBody(CreateUserSchema), (c) => {
    const user = c.get('body');
    return c.json({ id: crypto.randomUUID(), ...user }, 201);
  });
```

### Vercel AI SDK

```typescript
import { generateText, tool } from 'ai';
import { z } from 'dhi';

const weatherTool = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']),
  }),
  execute: async ({ location, unit }) => {
    return { location, temperature: 72, unit };
  },
});

const result = await generateText({
  model: yourModel,
  tools: { weather: weatherTool },
  prompt: 'What is the weather in Tokyo?',
});
```

### Express

```typescript
import express from 'express';
import { z } from 'dhi';

const app = express();
app.use(express.json());

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

app.post('/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  // result.data is typed
  res.json({ id: '123', ...result.data });
});
```

### Next.js Server Actions

```typescript
'use server';

import { z } from 'dhi';

const FormSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(1000),
});

export async function submitForm(formData: FormData) {
  const result = FormSchema.safeParse({
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!result.success) {
    return { error: result.error.flatten() };
  }

  // Process valid data
  return { success: true };
}
```

## SDK Generation (dhi-sdk)

Generate TypeScript SDKs from Hono apps automatically.

```bash
# Install
npm install -g dhi-sdk

# Generate SDK
dhi-sdk generate ./src/server.ts --output ./sdk --openapi
```

```typescript
// Use generated SDK
import { createClient } from './sdk';

const api = createClient({
  baseUrl: 'https://api.example.com',
});

// Fully typed!
const users = await api.users.list();
const user = await api.users.get({ id: '123' });
await api.users.create({ name: 'Alice', email: 'alice@example.com' });
```

See `packages/dhi-sdk/skills.md` for full SDK generation guide.

## Performance Tips

### Pre-compile Schemas

```typescript
// Good: Schema created once
const UserSchema = z.object({ name: z.string() });

function validate(data: unknown) {
  return UserSchema.safeParse(data);  // Reuses compiled schema
}

// Avoid: Creating schema on each call
function validate(data: unknown) {
  return z.object({ name: z.string() }).safeParse(data);
}
```

### Use safeParse for Untrusted Input

```typescript
// safeParse: Returns result object (doesn't throw)
const result = schema.safeParse(data);
if (result.success) {
  use(result.data);
}

// parse: Throws on invalid (use for trusted input)
const data = schema.parse(trustedData);
```

### Prefer Specific Validators

```typescript
// Good: SIMD-optimized
z.string().email()
z.string().uuid()
z.string().url()

// Less optimal: Regex fallback
z.string().regex(/^[a-z]+@[a-z]+\.[a-z]+$/)
```

## Benchmarks

```bash
cd js-bindings

# dhi vs Zod
bun run bench

# dhi vs Zod vs Arktype (top 3)
bun run bench:all
```

**Results:**

| Validator | dhi | Zod | Speedup |
|-----------|-----|-----|---------|
| Email (valid) | 15M/s | 11M/s | 1.4x |
| Email (invalid) | 31M/s | 0.4M/s | **77x** |
| Object (valid) | 15M/s | 3.5M/s | 4.3x |
| Object (invalid) | 4.7M/s | 0.25M/s | **19x** |

## Examples

| Example | Description | Location |
|---------|-------------|----------|
| Hono API | REST API with validation | `examples/hono-api/` |
| AI SDK Tools | Vercel AI SDK integration | `examples/ai-sdk-tools/` |
| Durable Agent | Cloudflare DO long-running agent | `examples/durable-agent/` |
| Complex API | Advanced patterns (nested, batch) | `examples/complex-api/` |
| Frontend | Next.js form validation | `examples/frontend/` |

## Migration from Zod

dhi is a drop-in replacement for Zod:

```typescript
// Before
import { z } from 'zod';

// After
import { z } from 'dhi';

// Everything else stays the same!
```

## Troubleshooting

### TypeScript Errors

```typescript
// If getting type errors, ensure you're using z.infer:
type User = z.infer<typeof UserSchema>;

// Not:
type User = typeof UserSchema;  // Wrong!
```

### Edge Runtime (Next.js)

```typescript
// dhi works in edge runtime without issues
// The WASM file is bundled automatically
import { z } from 'dhi';
```

### Bundle Size

dhi WASM binary: **28KB**
- Works in browsers, Node.js, Bun, Deno
- Edge runtime compatible
- No native dependencies
