# dhi

**What if your Zod schemas ran 7x faster — with zero code changes?**

```diff
- import { z } from 'zod';
+ import { z } from 'dhi/schema';
```

That's it. Same API. Same types. Same everything. Just faster.

---

## The numbers

We benchmarked dhi against Zod 4.3.6 across 33 real-world validation scenarios. dhi won 32 of them.

| What you're validating | How much faster |
|------------------------|-----------------|
| Nested objects | **7.0x** |
| Invalid objects | **15.4x** |
| Number constraints | **4.7 – 49x** |
| Arrays of numbers | **8.9x** |
| Optional/nullable | **2 – 8x** |
| Email (valid) | **1.5x** |
| Email (invalid) | **77.8x** |
| URL validation | **3.0x** |
| UUID | **1.2x** |
| Coerce to number | **26x** |
| Coerce to string | **40x** |
| Discriminated unions | **1.9x** |
| Transforms | **4.7x** |

Zero production dependencies. 28KB WASM binary. Full TypeScript inference.

---

## Install

```bash
npm install dhi
```

## Use it

```typescript
import { z } from 'dhi/schema';

const User = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().positive(),
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string()).optional(),
});

type User = z.infer<typeof User>;
// { name: string; email: string; age: number; role: 'admin' | 'user' | 'guest'; tags?: string[] }

const user = User.parse(data);         // throws on invalid
const result = User.safeParse(data);   // { success: true, data } or { success: false, error }
```

Everything works the way you expect: `.optional()`, `.nullable()`, `.default()`, `.transform()`, `.refine()`, `.pipe()`, unions, discriminated unions, records, tuples, maps, sets, lazy schemas, branded types — all of it.

---

## Why it's fast

Three things, working together:

1. **JIT-compiled objects** — When you define an object schema, dhi generates a specialized validator function for that exact shape. No loops, no dynamic dispatch. Just straight-line type checks.

2. **SIMD WASM validators** — Email, URL, and IPv4 validation runs through a 28KB WebAssembly module with 128-bit SIMD vector operations. Parallel character class checking instead of regex.

3. **Zero-allocation error paths** — Errors only allocate when validation actually fails. The happy path touches no garbage collector.

---

## Full Zod 4 API

dhi passes 77 compatibility tests covering the complete Zod 4 surface:

**Primitives** — `string`, `number`, `bigint`, `boolean`, `date`, `symbol`, `undefined`, `null`, `void`, `never`, `any`, `unknown`, `nan`

**String checks** — `min`, `max`, `length`, `email`, `url`, `uuid`, `ipv4`, `base64`, `date`, `startsWith`, `endsWith`, `includes`, `regex`, `trim`, `toLowerCase`, `toUpperCase`

**Number checks** — `min`, `max`, `gt`, `gte`, `lt`, `lte`, `int`, `positive`, `negative`, `nonnegative`, `nonpositive`, `finite`, `multipleOf`

**Composites** — `object`, `array`, `tuple`, `record`, `map`, `set`, `union`, `discriminatedUnion`, `intersection`

**Modifiers** — `optional`, `nullable`, `nullish`, `default`, `catch`, `readonly`, `brand`

**Effects** — `transform`, `refine`, `superRefine`, `preprocess`, `pipe`

**Zod 4 extras** — `stringbool`, `looseObject`, `strictObject`, `coerce.*`

---

## Migrating from Zod

### One-line swap

```typescript
// before
import { z } from 'zod';

// after
import { z } from 'dhi/schema';
```

### TypeScript types still work

```typescript
import { z } from 'dhi/schema';

const PostSchema = z.object({
  title: z.string(),
  body: z.string().min(10),
  published: z.boolean().default(false),
  tags: z.array(z.string()),
});

type Post = z.infer<typeof PostSchema>;
// { title: string; body: string; published: boolean; tags: string[] }
```

### Error handling is the same

```typescript
import { z, ZodError } from 'dhi/schema';

try {
  schema.parse(badData);
} catch (e) {
  if (e instanceof ZodError) {
    console.log(e.issues);
    // [{ code: 'invalid_type', path: ['age'], message: 'Expected number, got string' }]
  }
}
```

---

## Run the benchmarks yourself

```bash
git clone https://github.com/justrach/dhi-zig.git
cd dhi-zig/js-bindings
bun install
bun run benchmark-vs-zod.ts
```

---

## Requirements

- Node.js 18+ / Bun / Deno
- Works anywhere WebAssembly runs (all modern browsers, edge runtimes)

## License

MIT

---

**dhi** (Sanskrit: wisdom) — because validation shouldn't be the bottleneck.
