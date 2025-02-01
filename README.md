<p align="center">
  <img src="/assets/dhi_logo.jpg" alt="DHI Logo" width="1600"/>
</p>

<h1 align="center"><b>DHI</b></h1>
<div align="center">
  
[![npm version](https://badge.fury.io/js/dhi.svg)](https://badge.fury.io/js/dhi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

</div>

# DHI - High Performance TypeScript Validation

**DHI** is a high-performance TypeScript validation library powered by WebAssembly. Named after the Sanskrit word **धि (Dhi)**, meaning "intellect" or "wisdom," DHI embodies the smart, precise, and efficient data validation you need in modern applications. 

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

## Installation

```bash
npm install dhi
```

```bash
bun add dhi
```

---

## Basic Usage

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

## Supported Types

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

## Advanced Features

- **Optional Fields:** `dhi.optional(dhi.string())`
- **Nullable Fields:** `dhi.nullable(dhi.number())`
- **Record Types:** `dhi.record(dhi.string())`
- **Batch Validation:** Use `UserSchema.validate_batch(items)` for validating multiple items at once.

---

## Performance

DHI is built with performance in mind. It uses WebAssembly to validate data at speeds significantly faster than traditional JavaScript validators. In our benchmarks on complex validations with new types:

- **Benchmark 1 (1,000,000 items):**
  - **DHI:** 2661.79ms
  - **Zod:** 5832.30ms
  - **Validations per second:** DHI: 375,687 vs. Zod: 175,360

- **Benchmark 2 (1,000,000 items):**
  - **DHI:** 2885.60ms
  - **Validations per second:** DHI: 346,548

These results showcase the performance edge DHI offers, especially for applications requiring massive data validations.

---

## License

This project is licensed under the **MIT License**.

---

## Author

Rach Pradhan

---

## Repository

For more information, bug reports, or contributions, please visit the [GitHub repository](https://github.com/justrach/dhi).

---

DHI is the intelligent choice for TypeScript validation—built for speed, engineered for precision, and inspired by the timeless wisdom of Sanskrit.
