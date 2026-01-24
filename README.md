# dhi

**An experiment in cross-language type safety with Zig.**

dhi explores a simple question: can one validation core, written in Zig, deliver Pydantic-level developer experience across Python, TypeScript, *and* native Zig — while being 10-100x faster than existing solutions?

The answer is yes.

[![npm](https://img.shields.io/npm/v/dhi)](https://www.npmjs.com/package/dhi)
[![PyPI](https://img.shields.io/pypi/v/dhi)](https://pypi.org/project/dhi/)
[![MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Thesis

Modern data validation is fragmented. Python has Pydantic, TypeScript has Zod, Rust has serde — each reimplementing the same concepts in isolation. They can't share logic, can't share performance wins, and force you to re-learn APIs in each ecosystem.

Zig's unique features make it ideal for unifying this:

- **`comptime`** — Generate validation logic at compile time, zero runtime overhead
- **C ABI exports** — Single codebase → Python (FFI), JavaScript (WASM), native Zig
- **No GC, no runtime** — Predictable performance, 28KB WASM binary
- **SIMD intrinsics** — Hardware-accelerated batch validation

The result: one set of validators, three ecosystems, identical semantics.

---

## Same API, Every Language

### Python (Pydantic-compatible)

```python
from dhi import BaseModel, Field, EmailStr, PositiveInt
from typing import Annotated

class User(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    age: Annotated[int, Field(gt=0, le=150)]

user = User(name="Alice", email="alice@example.com", age=28)
print(user.model_dump())  # {'name': 'Alice', 'email': 'alice@example.com', 'age': 28}
```

### Zig (compile-time validated)

```zig
const dhi = @import("model");

const User = dhi.Model("User", .{
    .name = dhi.Str(.{ .min_length = 1, .max_length = 100 }),
    .email = dhi.EmailStr,
    .age = dhi.Int(i32, .{ .gt = 0, .le = 150 }),
});

const user = try User.parse(.{
    .name = "Alice",
    .email = "alice@example.com",
    .age = @as(i32, 28),
});
```

### TypeScript (Zod 4 drop-in)

```typescript
import { z } from 'dhi/schema';

const User = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().lte(150),
});

const user = User.parse(data);
```

**Same validation semantics. Same error behavior. 3 languages.**

---

## Performance

### Python vs the field

| Library | Throughput | Comparison |
|---------|------------|------------|
| **dhi (native)** | **27.3M/sec** | — |
| satya (Rust + PyO3) | 9.6M/sec | 2.8x slower |
| msgspec (C) | 8.7M/sec | 3.1x slower |
| Pydantic v2 | 0.2M/sec | 136x slower |

**BaseModel API** (Pydantic-compatible layer):
- Validation: 546K objects/sec (2 µs each)
- Serialization: 6.4M dumps/sec

### TypeScript vs Zod 4

| Scenario | Speedup |
|----------|---------|
| Nested objects | **7x** |
| Invalid objects | **15x** |
| Number constraints | **5 – 49x** |
| Email validation | **78x** |
| Coercion | **26 – 40x** |

32 of 33 benchmarks faster. Full Zod 4 API parity.

---

## Why Zig?

This experiment validates three hypotheses about Zig as a cross-language toolchain foundation:

### 1. Comptime replaces runtime reflection

Pydantic uses Python metaclasses to build validators at class definition time. dhi's Zig core does the same — but at *compile* time. Field constraints become inlined validation logic with no vtable dispatch, no hash lookups, no allocations.

```zig
// This generates specialized validation code at compile time
const User = dhi.Model("User", .{
    .age = dhi.Int(i32, .{ .gt = 0, .le = 150 }),
});
// User.parse() is a zero-overhead, fully inlined function
```

### 2. One binary, multiple targets

The same Zig source compiles to:
- **`libsatya.dylib`** — Python C extension (macOS)
- **`libsatya.so`** — Python C extension (Linux)
- **`dhi.wasm`** — 28KB WebAssembly (TypeScript)
- **Native library** — Direct Zig import

No FFI code generation. No bindings generators. Just `zig build`.

### 3. SIMD without complexity

Batch validation of 10,000 integers checks 4 values per cycle using 256-bit vectors:

```zig
// Auto-vectorized: validates 4 i64 values per SIMD lane
pub fn validateIntBatchSIMD(values: []const i64, min: i64, max: i64, results: []u8) usize {
    // Zig's auto-vectorization handles the rest
}
```

---

## Installation

### Python

```bash
pip install dhi
```

Pre-built wheels available for:
- macOS (Apple Silicon) — Python 3.9-3.13
- Linux (x86_64) — Python 3.9-3.13

Pure Python fallback works everywhere (no native extension required).

### TypeScript

```bash
npm install dhi
```

Works in Node.js 18+, Bun, and Deno — anywhere WASM runs.

### Zig (from source)

```bash
git clone https://github.com/justrach/dhi-zig.git
cd dhi-zig
zig build -Doptimize=ReleaseFast
```

---

## What You Can Validate

### Pydantic-compatible types (Python + Zig)

| Category | Types |
|----------|-------|
| **Strings** | `EmailStr`, `HttpUrl`, `AnyUrl`, `IPvAnyAddress`, pattern, length |
| **Numbers** | `PositiveInt`, `NegativeFloat`, `FiniteFloat`, gt/ge/lt/le, multiple_of |
| **Constrained** | `conint()`, `confloat()`, `constr()`, `conlist()`, `conbytes()` |
| **Network** | `PostgresDsn`, `RedisDsn`, `MongoDsn`, `KafkaDsn`, 11 DSN types |
| **Special** | `UUID4`, `FilePath`, `Base64Str`, `Json`, `ByteSize`, `SecretStr` |
| **Datetime** | `PastDate`, `FutureDate`, `AwareDatetime`, `NaiveDatetime` |
| **Model** | `BaseModel`, `Field()`, `@field_validator`, `@model_validator` |

### Zod-compatible (TypeScript)

Objects, arrays, tuples, records, maps, sets, unions, discriminated unions, intersections, optional, nullable, default, transform, refine, pipe, coerce.

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Zig Validation Core          │
│  comptime models · SIMD batch · C ABI  │
└───────┬──────────────┬──────────────┬───┘
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ Python  │   │  WASM   │   │   Zig   │
   │  FFI    │   │ 28KB    │   │ Native  │
   │libsatya │   │ + SIMD  │   │ Import  │
   └────┬────┘   └────┬────┘   └────┬────┘
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │BaseModel│   │  z.*()  │   │ Model() │
   │Pydantic │   │  Zod 4  │   │comptime │
   │  API    │   │  API    │   │  API    │
   └─────────┘   └─────────┘   └─────────┘
```

---

## Run the Benchmarks

```bash
# Python
cd python-bindings
pip install -e .
python benchmark_batch.py

# TypeScript
cd js-bindings
bun install && bun run benchmark-vs-zod.ts

# Zig native
zig build bench -Doptimize=ReleaseFast
```

---

## The Experiment's Results

| Question | Answer |
|----------|--------|
| Can Zig match Pydantic's DX? | Yes — `Model("User", .{ .name = Str(.{}) })` mirrors `BaseModel` exactly |
| Can one core serve 3 ecosystems? | Yes — Python FFI, WASM, native Zig from the same source |
| Is the performance real? | Yes — 27M/sec Python, 78x faster than Zod for email validation |
| Is the binary size reasonable? | Yes — 28KB WASM, ~200KB native library |
| Does comptime replace reflection? | Yes — zero-overhead validation with no runtime type inspection |

---

## License

MIT

---

**dhi** (Sanskrit: wisdom) — one validation core for every language you use.
