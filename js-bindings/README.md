# dhi

[![npm version](https://img.shields.io/npm/v/dhi.svg)](https://www.npmjs.com/package/dhi)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Drop-in Zod 4 replacement. Average 20x faster. Zero code changes.**

```diff
- import { z } from 'zod';
+ import { z } from 'dhi';
```

That's it. Same API. Same types. Full Zod 4 compatibility. Just faster.

---

## Benchmarks

<p align="center">
  <img src="../docs/benchmarks/speedup-all.png" alt="dhi vs Zod Performance" width="800"/>
</p>

<p align="center">
  <img src="../docs/benchmarks/top-10.png" alt="Top 10 Performance Gains" width="800"/>
</p>

### Performance Summary

| Category | Average Speedup |
|----------|-----------------|
| Number Formats | **30-50x faster** |
| StringBool | **32x faster** |
| Coercion | **23-56x faster** |
| String Formats | **12-27x faster** |
| ISO Formats | **12-22x faster** |
| Objects | **4-7x faster** |
| Arrays | **8x faster** |

> Benchmarks run automatically via CI. See [benchmark results](../docs/benchmarks/benchmark-results.json) for raw data.

---

## Install

```bash
npm install dhi
# or
bun add dhi
# or
pnpm add dhi
```

---

## Quick Start

```typescript
import { z } from 'dhi';

const User = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  email: z.email(),                    // New Zod 4 top-level shortcut!
  age: z.int().positive(),             // New Zod 4 number format!
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),         // New Zod 4 ISO namespace!
});

type User = z.infer<typeof User>;

const user = User.parse(data);         // throws on invalid
const result = User.safeParse(data);   // { success, data } or { success, error }
```

---

## Full Zod 4 Feature Parity

dhi implements **100% of the Zod 4 API**, including all the new Zod 4 features:

### Top-Level String Format Shortcuts (New in Zod 4)

```typescript
z.email()      // Email validation
z.uuid()       // UUID validation
z.url()        // URL validation
z.ipv4()       // IPv4 address
z.ipv6()       // IPv6 address
z.jwt()        // JSON Web Token
z.nanoid()     // NanoID
z.ulid()       // ULID
z.cuid()       // CUID
z.cuid2()      // CUID2
z.base64()     // Base64 string
z.base64url()  // Base64URL string
z.e164()       // E.164 phone number
z.mac()        // MAC address
z.cidrv4()     // CIDR v4 block
z.cidrv6()     // CIDR v6 block
z.hex()        // Hexadecimal string
z.hostname()   // Hostname
z.hash('sha256')  // Hash strings (md5, sha1, sha256, sha384, sha512)
```

### ISO Namespace (New in Zod 4)

```typescript
z.iso.datetime()  // ISO 8601 datetime
z.iso.date()      // ISO 8601 date
z.iso.time()      // ISO 8601 time
z.iso.duration()  // ISO 8601 duration
```

### Number Format Shortcuts (New in Zod 4)

```typescript
z.int()      // Safe integer
z.float()    // Finite float
z.float32()  // 32-bit float
z.float64()  // 64-bit float
z.int8()     // 8-bit signed integer  (-128 to 127)
z.uint8()    // 8-bit unsigned integer (0 to 255)
z.int16()    // 16-bit signed integer
z.uint16()   // 16-bit unsigned integer
z.int32()    // 32-bit signed integer
z.uint32()   // 32-bit unsigned integer
z.int64()    // 64-bit signed integer (BigInt)
z.uint64()   // 64-bit unsigned integer (BigInt)
```

### Additional Zod 4 Features

```typescript
// StringBool - env-style boolean parsing
z.stringbool()  // "true", "yes", "1", "on" → true
                // "false", "no", "0", "off" → false

// Template Literals
z.templateLiteral(['user-', z.number()])  // Matches "user-123"

// JSON Schema
z.json()  // Any JSON-encodable value (recursive)

// File Validation
z.file()                  // File object
z.file().mime('image/png')
z.file().min(1024).max(5_000_000)

// Registry System
const registry = z.registry<{ title: string }>();
registry.add(schema, { title: 'User Schema' });
z.globalRegistry.add(schema, { id: 'user', description: 'User data' });

// Success Wrapper
z.success(z.string())  // Always succeeds

// Pretty Error Formatting
z.prettifyError(error)  // Formatted error string
```

### Object Methods (New in Zod 4)

```typescript
const schema = z.object({ name: z.string(), age: z.number() });

schema.keyof()    // z.enum(['name', 'age'])
schema.valueof()  // Union of all value schemas
schema.entryof()  // Tuple entries
```

### All Classic Features

**Primitives** — `string`, `number`, `bigint`, `boolean`, `date`, `symbol`, `undefined`, `null`, `void`, `never`, `any`, `unknown`, `nan`

**String Checks** — `min`, `max`, `length`, `email`, `url`, `uuid`, `regex`, `includes`, `startsWith`, `endsWith`, `trim`, `toLowerCase`, `toUpperCase`, `normalize`

**Number Checks** — `min`, `max`, `gt`, `gte`, `lt`, `lte`, `int`, `positive`, `negative`, `nonnegative`, `nonpositive`, `finite`, `safe`, `multipleOf`

**Composites** — `object`, `array`, `tuple`, `record`, `map`, `set`, `union`, `discriminatedUnion`, `intersection`

**Modifiers** — `optional`, `nullable`, `nullish`, `default`, `catch`, `readonly`, `brand`

**Effects** — `transform`, `refine`, `superRefine`, `check`, `preprocess`, `pipe`

**Coercion** — `z.coerce.string()`, `z.coerce.number()`, `z.coerce.boolean()`, `z.coerce.bigint()`, `z.coerce.date()`

---

## Why It's Fast

Three things working together:

1. **JIT-compiled object schemas** — When you define an object schema, dhi generates a specialized validator function for that exact shape. No loops, no dynamic dispatch. Just straight-line type checks.

2. **SIMD WASM validators** — Email, URL, and IP validation runs through a 28KB WebAssembly module with 128-bit SIMD vector operations. Parallel character processing instead of regex.

3. **Zero-allocation fast paths** — Errors only allocate when validation actually fails. The happy path avoids the garbage collector entirely.

---

## Migration from Zod

### One-line change

```typescript
// Before
import { z } from 'zod';

// After
import { z } from 'dhi';
```

### Full type inference works

```typescript
import { z } from 'dhi';

const PostSchema = z.object({
  title: z.string(),
  body: z.string().min(10),
  published: z.boolean().default(false),
  tags: z.array(z.string()),
});

type Post = z.infer<typeof PostSchema>;
// { title: string; body: string; published: boolean; tags: string[] }
```

### Same error handling

```typescript
import { z, ZodError } from 'dhi';

try {
  schema.parse(badData);
} catch (e) {
  if (e instanceof ZodError) {
    console.log(e.issues);
    console.log(z.prettifyError(e));  // New! Pretty formatted errors
  }
}
```

---

## Run Benchmarks

```bash
git clone https://github.com/justrach/dhi-zig.git
cd dhi-zig/js-bindings
bun install
bun run benchmark-vs-zod.ts      # Full comparison
bun run benchmark-zod4-features.ts  # Zod 4 features
```

---

## Requirements

- Node.js 18+ / Bun / Deno
- Works anywhere WebAssembly runs (all modern browsers, edge runtimes)

## Bundle Size

- **28KB** WASM binary (gzipped: ~12KB)
- Zero production dependencies

---

## API Reference

See the [Zod 4 documentation](https://zod.dev) — dhi implements the same API with 100% compatibility.

## License

MIT

---

**dhi** (धी, Sanskrit: wisdom, intelligence) — because validation shouldn't be the bottleneck.
