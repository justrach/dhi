<p align="center">
  <img src="/assets/dhi_logo.jpg" alt="DHI Logo" width="1600"/>
</p>

<h1 align="center"><b>DHI</b></h1>
<div align="center">
  
[![npm version](https://badge.fury.io/js/dhi.svg)](https://badge.fury.io/js/dhi)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

</div>

# 🚀 DHI — High‑Performance TypeScript Validation

DHI is a blazing‑fast TypeScript validation library with two faces:

- A modern, typed‑first API (recommended)
- A familiar Zod‑like facade for easy migration

It’s built for applications that validate large datasets efficiently while preserving compile‑time type safety and a great DX.

## 🚀 Performance at a glance

DHI significantly outperforms other validation libraries through two complementary approaches:

DHI outperforms general‑purpose validators by combining JS fast paths (iterative deep‑object validators, array‑of‑object fast path) with a fused per‑schema JS validator that collapses multiple property reads into a single monomorphic function.

- Typed‑first API (recommended): fast, type‑safe, zero WASM overhead
- WASM/Rust (optional): batch primitives and deep trees with cross‑language optimizations

### Comprehensive Benchmark Results

#### TypeScript-First API Performance
```
Simple 4-Field Required Schema (1M items):
  DHI:  40.67ms (24,591,023 ops/sec)
  Zod:  58.16ms (17,193,063 ops/sec)
  Speedup: 1.43x

Simple 4-Field with Optional (1M items):
  DHI:  49.92ms (20,032,966 ops/sec)
  Zod:  53.90ms (18,554,459 ops/sec)
  Speedup: 1.08x

Mixed Valid/Invalid Data (500K items):
  DHI:  385.17ms (1,298,142 ops/sec)
  Zod:  1209.65ms (413,342 ops/sec)
  Speedup: 3.14x

Average speedup: 1.88x
```

*Benchmarks run on Mac Studio with Bun runtime*

## 📖 Usage

### TypeScript-First API (Recommended)

DHI provides compile-time type safety similar to Yup's approach:

```typescript
import {
  object,
  string,
  number,
  boolean,
  array,
  record,
  union,
  discriminatedUnion,
  optional,
  nullable,
  model,
  type ObjectSchema,
  type TypedInfer
} from 'dhi';

// Define your TypeScript interface
interface User {
  name: string;
  age?: number;
  email: string;
  active: boolean;
}

// Method 1: Direct schema with compile-time type checking
const userSchema: ObjectSchema<User> = object({
  name: string(),
  age: optional(number()),
  email: string(),
  active: boolean()
});

// Method 2: Named model with enhanced error messages
const UserModel = model('User', {
  name: string(),
  age: optional(number()),
  email: string(),
  active: boolean()
});

// ❌ This would cause a compile-time error:
// const badSchema: ObjectSchema<User> = object({
//   name: number(), // Type error: number is not assignable to string
// });

// Type inference
type InferredUser = TypedInfer<typeof userSchema>; // User
type ModelUser = TypedInfer<typeof UserModel>; // User

// Validation
const userData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  active: true
};

// Single validation
const user = userSchema.validate(userData);

// Safe validation
const result = userSchema.safeParse(userData);
if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.log('Validation error:', result.error);
}

// Batch validation (ultra-fast for simple schemas)
const users = [userData, /* ... more users */];
const validationResults = userSchema.validateBatch(users);

// Discriminated unions (fast dispatch)
const Event = discriminatedUnion('type', {
  click: object({ type: string(), x: number(), y: number() }),
  page_view: object({ type: string(), url: string() }),
  purchase: object({ type: string(), orderId: string(), value: number() })
});

// Record/dictionary validation (fused loop, no allocations)
const StringMap = record(string()); // Schema<Record<string, string>>
const ok = StringMap.validate({ a: 'x', b: 'y' });
```
```

### Performance Comparison with Yup

```typescript
// Yup approach
import { object, number, string, ObjectSchema } from 'yup';

interface Person {
  name: string;
  age?: number;
  sex: 'male' | 'female' | 'other' | null;
}

const yupSchema: ObjectSchema<Person> = object({
  name: string().defined(),
  age: number().optional(),
  sex: string<'male' | 'female' | 'other'>().nullable().defined(),
});

// DHI approach (1.43x faster)
import { object, string, number, optional, nullable, type ObjectSchema } from 'dhi';

const dhiSchema: ObjectSchema<Person> = object({
  name: string(),
  age: optional(number()),
  sex: nullable(string()) // Note: enum validation coming soon
});
```

> **धि**: Intellect, understanding, wisdom.

DHI is designed to be fast, type-safe, and easy to use—offering a familiar API similar to Zod, but with performance that leaves it far behind. Benchmarks on complex validations with new types (1,000,000 items) show(Benchmarks are available in the [benchmarks](./benchmarks) folder):

- **Results:**
  - **DHI:** 2661.79ms
  - **Zod:** 5832.30ms
- **Validations per second:**
  - **DHI:** 375,687
  - **Zod:** 175,360

<p align="center">
  <img src="/assets/benchmark-execution-time.png" alt="Benchmark Execution Time" width="800"/>
</p>

<p align="center">
  <img src="/assets/benchmark-validations-per-second.png" alt="Benchmark Validations per Second" width="800"/>
</p>

DHI leverages WebAssembly to accelerate validation tasks, ensuring that even complex validations with new types are handled with remarkable speed.

---

## Features

- **WebAssembly-Powered Validation:** Ultra-fast performance using WebAssembly.
- **TypeScript-First Design:** Seamless integration with TypeScript for strong typing.
- **Familiar API:** Similar to Zod, making it easy to adopt.
- **Batch Validation Support:** Validate large batches of items efficiently.
- **Rich Type System:** Supports a wide array of types.

---

## 📥 Installation

```bash
npm install dhi
```

```bash
bun add dhi
```

---

## Fun Fact: Small Browser Payload

For browsers, DHI ships a compact payload:

- JS + WASM total: ~46 KB gzip (~158 KB raw)
- Breakdown (gzip): `typed.js` ~6.9 KB, `zod-compat.js` ~2.2 KB, `core.js` ~2.0 KB, `wasm.js` ~1.8 KB, `index.js` ~0.6 KB, `dhi_core_bg.wasm` ~32.9 KB
- Note: The `dhi_core.node` binary (~369 KB) is Node-only and not shipped to browsers.


## 🔨 Legacy WASM API (optional)

```typescript
import { dhi } from 'dhi';

const UserSchema = await dhi.object({
  name: dhi.string(),
  age: dhi.number(),
  email: dhi.string(),
  tags: dhi.array(dhi.string())
});

const result = UserSchema.validate({
  name: "John",
  age: 30,
  email: "john@example.com",
  tags: ["user", "admin"]
});

console.log(result.success);
```

Notes
- Initialization: The legacy WASM wrapper handles async initialization internally (via `ensureWasmInitialized()`); callers usually don’t need to invoke it directly. If you want to pre-warm on startup, you can `import { ensureWasmInitialized } from 'dhi/dist/wasm'` and `await ensureWasmInitialized()`.
- Shipped assets: The npm package includes `dist/dhi_core.js` (wasm-bindgen glue) and `dist/dhi_core_bg.wasm`. A native Node binding (`dist/dhi_core.node`) may be present for host builds but is not used in browsers.
- No postinstall build: Artifacts are prebuilt in `dist/`; installs work out of the box.

## ⚖️ Hybrid (Typed + WASM) Usage

Use the typed API for single validations and valid‑heavy batches, and automatically switch to WASM for invalid‑heavy batches. This keeps DX and browser payloads lean while unlocking invalid‑path speed when you need it on the server.

Node/server example
```ts
import { object, string, number, boolean as bool, array, createHybridValidator } from 'dhi';
import { dhi } from 'dhi';

type User = { name: string; age: number; active: boolean; tags: string[] };

// Typed schema (no WASM at call-site)
const TypedUser = object({
  name: string(),
  age: number(),
  active: bool(),
  tags: array(string())
});

// WASM schema (legacy engine), build once at startup
const WasmUser = await (async () => {
  const s = await dhi.string();
  const n = await dhi.number();
  const b = await dhi.boolean();
  const arrS = await dhi.array(await dhi.string());
  return await dhi.object<User>({ name: s, age: n, active: b, tags: arrS });
})();

// Hybrid wrapper
const User = createHybridValidator(TypedUser, WasmUser, { threshold: 0.3, sample: 200 });

// Single-object calls use typed
const ok = User.validate({ name: 'A', age: 1, active: true, tags: ['x'] });

// Batch calls auto-pick: typed for valid‑heavy, WASM for invalid‑heavy
const batch = [{ name: 'A', age: 1, active: true, tags: ['x'] }];
const mask = User.validateBatch(batch); // boolean[]
```

Example timings (one run; your results may vary)
- [Typed] valid: ~3.00 ms
- [Typed] invalid: ~22.52 ms
- [WASM] valid: ~13.34 ms
- [WASM] invalid: ~3.19 ms
- [Hybrid] valid: ~1.57 ms
- [Hybrid] invalid: ~3.80 ms

These numbers illustrate the strategy: typed excels on valid data; WASM excels on invalid. Hybrid picks the faster path while keeping single‑object DX simple.

> Tip: Use the hybrid only in Node/server contexts. Keep browser code on the typed API for the smallest payloads.

### Comprehensive Benchmark Snapshot (Hybrid vs Typed vs WASM vs Zod)

Results from `benchmarks/comprehensive.ts` (sample run):

```
Simple 4-Field Schema (Current benchmark2.ts):
  Data Size: 1,000,000
  DHI (typed): 55.17ms ± 9.98ms (18,126,981.328 ops/sec)
  DHI (WASM): 281.82ms ± 8.62ms (3,548,328.791 ops/sec)
  Hybrid:     52.74ms ± 1.90ms (18,962,069.989 ops/sec)
  Zod:        64.99ms ± 7.20ms (15,386,086.91 ops/sec)
  Speedup: 1.18x

Nested Object Schema:
  Data Size: 100,000
  DHI (typed): 9.42ms ± 1.44ms (10,610,262.173 ops/sec)
  DHI (WASM): 7.40ms ± 0.60ms (13,516,375.332 ops/sec)
  Hybrid:     8.72ms ± 0.54ms (11,462,763.476 ops/sec)
  Zod:        17.70ms ± 1.42ms (5,648,827.935 ops/sec)
  Speedup: 1.88x

Array-Heavy Schema:
  Data Size: 50,000
  DHI (typed): 8.52ms ± 0.86ms (5,866,762.813 ops/sec)
  DHI (WASM): 102.16ms ± 6.09ms (489,435.873 ops/sec)
  Hybrid:     8.18ms ± 0.14ms (6,111,576.012 ops/sec)
  Zod:        30.34ms ± 2.90ms (1,647,855.256 ops/sec)
  Speedup: 3.56x

Mixed Valid/Invalid Data:
  Data Size: 500,000
  DHI (typed): 23.96ms ± 4.05ms (20,870,820.893 ops/sec)
  DHI (WASM): 103.03ms ± 2.65ms (4,853,077.721 ops/sec)
  Hybrid:     101.33ms ± 1.62ms (4,934,573.112 ops/sec)
  Zod:        639.68ms ± 49.01ms (781,642.414 ops/sec)
  Speedup: 26.70x

🏆 Average speedup across all scenarios: 8.33x
📊 Speedup range: 1.18x - 26.70x
```

## ❓ FAQ: Does DHI always load WASM in the browser?

No. DHI’s typed‑first API does not require WASM, and modern bundlers will tree‑shake out the legacy WASM layer if you only use the typed or zod‑compat surfaces.

- Typed‑only usage (recommended for browsers): import from `dhi` the typed constructors (`object`, `string`, etc.). The `core`/`wasm` modules are not referenced and are dropped by tree‑shaking.
- Legacy WASM or Hybrid usage: importing `dhi`’s legacy API (`dhi.*`) or constructing hybrid validators will reference the WASM loader. Use these in Node/server, not in browser bundles, unless you intentionally want WASM there.
- Distribution: the npm package ships both JS and `dhi_core_bg.wasm`, but bundlers include assets only when referenced.

### How “reference” pulls WASM into a bundle (and how to avoid it)

Bundlers build a module graph from your imports. Only modules that are reachable from your code are included. DHI’s exports are tree‑shakeable and side‑effect‑free, so unused exports are dropped.

- Good (typed‑only, browser‑safe):
  ```ts
  import { object, string, number } from 'dhi';            // OK: typed only
  import { z } from 'dhi';                                 // OK: zod-compat only
  import type { ObjectSchema, TypedInfer } from 'dhi';     // OK: types only
  ```
- Avoid (prevents tree‑shaking or references WASM):
  ```ts
  import * as DHI from 'dhi';               // Avoid: can keep all exports reachable
  import { dhi } from 'dhi';                // Pulls in legacy WASM path
  import { createHybridValidator } from 'dhi'; // OK by itself, but you must also build a WASM schema via `dhi.*` to use it
  ```

Tips
- Keep legacy/hybrid usage in server‑only files (e.g., Next.js `app/api/*`, Node workers). Do not import `dhi` (legacy) from client routes/components.
- If you need conditional usage, split files by environment instead of runtime `if` checks—static analysis works at build time, not runtime.
- Ensure bundler tree‑shaking is on (Vite/Rollup by default; Webpack: `optimization.usedExports: true`).

Explicitly including WASM (Node/server)
- Use the legacy API to construct schemas:
  ```ts
  import { dhi } from 'dhi';
  const Num = await dhi.number();
  const Obj = await dhi.object({ n: Num });
  ```
- Or pair the legacy API with the hybrid helper to auto‑pick typed vs WASM for batches.

---

## 🏗️ Supported Types (Typed API)
- `string`, `number`, `boolean`
- `object({...})`
- `array(schema)`
- `record(valueSchema)`
- `union([...])`, `discriminatedUnion(key, mapping)`
- Modifiers: `optional(schema)`, `nullable(schema)`
- Helpers: `model(name, shape)`, `TypedInfer`

Note: The temporary Zod‑compat layer exposes a limited subset of Zod APIs (e.g., `z.object`, `z.string`, `z.array`, `z.record`, `z.enum`, basic `.optional()`/`.nullable()`, `.parse`/`.safeParse`). It exists to ease migration and may be removed in a future major release.

### Zod‑Compat (Migration Aid)

```ts
// One‑liner migration: replace your zod import
import { z } from 'dhi';

const User = z.object({ id: z.string(), name: z.string() });
const r = User.safeParse({ id: '1', name: 'A' });
```

---

## 🎓 Advanced Features

- **Optional Fields:** `optional(string())`
- **Nullable Fields:** `nullable(number())`
- **Discriminated unions:** `discriminatedUnion('type', { ... })`
- **Array‑of‑object fast path:** inner object with ≤4 primitive fields
- **Batch Validation:** `schema.validateBatch(items)`

---

## 📈 Performance details

Recent real‑world suites (on a Mac Studio) show: (2025-08-28)

- __Setup__
  - DHI: v0.1.4
  - Zod: v4.1.4
  - Script: `benchmarks/benchmark2.ts`
  - Dataset: 1,000,000 mixed valid/invalid user-like objects

- __Results__
  - DHI: 498.13ms (800,091 valid)
  - Zod: 647.54ms (800,091 valid)

- __Validations per second__
  - DHI: 2,007,501
  - Zod: 1,544,300

- __Performance Gain__
  - DHI is **30% faster** than Zod v4
  - **463,201 more validations per second**

- __Optimizations Applied__
  - Strict fast path with SIMD-style unrolled loops for primitive schemas (≤4 fields)
  - Boolean-returning internal validation to eliminate Result allocations
  - Precomputed schema analysis and flattened field vectors
  - Cached JS keys with single Reflect.get per field
  - Increased chunk size (32k) and wasm-opt with -O3 + SIMD

Benchmarks live in `benchmarks/` and include both comprehensive micro‑benchmarks and realistic datasets:

- **Benchmark 1 (1,000,000 items):**
  - **DHI:** 2661.79ms
  - **Zod:** 5832.30ms
  - **Validations per second:** DHI: 375,687 vs. Zod: 175,360

- **Benchmark 2 (1,000,000 items):**
  - **DHI:** 2885.60ms
  - **Validations per second:** DHI: 346,548

These results showcase the performance edge DHI offers, especially for applications requiring massive data validations.

---

## 🧪 Build & Release

- Build everything locally: `bash scripts/build.sh`
- CI/CD: publishing to npm is handled by a GitHub workflow on release (requires `NPM_TOKEN`).

## License

This project is licensed under the **Apache 2.0 License**.

---

## Author

Rach Pradhan

---

## Repository

For more information, bug reports, or contributions, please visit the [GitHub repository](https://github.com/justrach/dhi).


---
🌟 DHI: Where Sanskrit wisdom meets modern TypeScript validation — delivering unmatched speed, precision, and reliability for your applications.

---

## 🧰 Zod‑like DX (migration aid)

For teams familiar with Zod v4, DHI ships a small facade that mirrors common ergonomics. Use it to migrate gradually; for the best performance and type‑safety, prefer the typed‑first API above.

- Import the facade and wait for initialization once:

```ts
import { z, dhiReady, Infer } from 'dhi';

await dhiReady; // ensures WASM is ready so constructors are sync
```

- Define schemas similarly to Zod:

```ts
const User = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  tags: z.array(z.string()),
  status: z.enum('active', 'inactive', 'banned'), // also supports array form: z.enum(['active','inactive','banned'])
  deletedAt: z.date().optional(),
  lastLogin: z.date().nullable(),
});
```

- Parse or safe-parse:

```ts
const parsed = User.parse({ id: '1', name: 'Jane', age: 42, tags: [], status: 'active' });
const result = User.safeParse({ id: 1 });
if (!result.success) {
  console.log(result.error.issues); // [{ code, path, message }]
}
```

- Type inference:

```ts
type User = Infer<typeof User>;
```

Notes:
- This preview covers core constructors: `string`, `number`, `boolean`, `date`, `bigint`, `symbol`, `any`, `unknown`, `never`, `undefined`, `null`, `void`, plus `object`, `array`, `record`, and `enum`.
- Modifiers: `.optional()`, `.nullable()` are supported.
- Roadmap: `union`, `discriminatedUnion`, `literal`, `tuple`, `map`, `set`, `refine/superRefine`, `transform/pipe`, `coerce`, `default/catch/nullish/readonly/brand`, and richer error codes.
## ⚡ Quick Benchmark (DHI vs Zod)

Run a quick, local benchmark with Bun comparing DHI’s typed API against Zod.

```bash
# From repo root (build once for local fallback)
bun run build:ts

# Then run the benchmark (defaults: size=50000, runs=5, invalid=0)
bun run benchmarks/quick_invalid_bench.ts --size 50000 --invalid 0.2 --runs 5
```

Flags:
- `--size <n>`: number of items (e.g., 50000)
- `--invalid <ratio>`: fraction of invalid rows (e.g., 0.2 for 20%)
- `--runs <n>`: number of timed iterations to median

Example output (JSON):

```json
{
  "size": 50000,
  "invalid": 0.2,
  "runs": 5,
  "dhi": { "ms": 1.324 },
  "zod": { "ms": 39.686 },
  "speedup": 30.0
}
```

Notes:
- Invalid-heavy datasets highlight DHI’s fast-path short-circuits; Zod incurs per-item parse/throw cost.
- For apples-to-apples, compare on the same machine/runtime at moderate sizes (50k–500k) for stable medians.

## ESM/CJS Usage Notes

- DHI publishes both CJS and ESM builds. In modern bundlers (Next.js, Vite), prefer named ESM imports:

```ts
import { object, string, number, boolean } from 'dhi';
```

- In pure CJS contexts (older Node), use `require('dhi')` or default-import shims if needed.
