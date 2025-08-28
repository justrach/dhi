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
import { object, string, number, boolean, optional, model, type ObjectSchema, type TypedInfer } from 'dhi';

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

---

## 🏗️ Supported Types
- `string`
- `number`
- `boolean`
- `date`
- `bigint`
- `symbol`
- `array`
- `object`
- `record`
- `enum`
- `undefined`
- `null`
- `void`
- `any`
- `unknown`
- `never`

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
