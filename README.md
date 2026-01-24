# dhi

**Validation that doesn't slow you down.**

One library, two ecosystems. Whether you're writing TypeScript or Python, dhi validates your data faster than anything else — by a lot.

[![npm](https://img.shields.io/npm/v/dhi)](https://www.npmjs.com/package/dhi)
[![PyPI](https://img.shields.io/pypi/v/dhi)](https://pypi.org/project/dhi/)
[![MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## TypeScript / Node.js

A drop-in Zod 4 replacement. Change one import, get up to 49x faster validation.

```diff
- import { z } from 'zod';
+ import { z } from 'dhi/schema';
```

```typescript
import { z } from 'dhi/schema';

const User = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().positive(),
  role: z.enum(['admin', 'user', 'guest']),
});

type User = z.infer<typeof User>;

const user = User.parse(data);
```

### vs Zod 4.3.6

| Scenario | Speedup |
|----------|---------|
| Nested objects | **7x** |
| Invalid objects | **15x** |
| Number constraints | **5 – 49x** |
| Arrays of numbers | **9x** |
| Email (invalid) | **78x** |
| URL validation | **3x** |
| Coercion | **26 – 40x** |
| Discriminated unions | **2x** |
| Transforms | **5x** |
| Optional/nullable | **2 – 8x** |

32 out of 33 benchmarks faster. Zero production dependencies. Full Zod 4 API parity.

```bash
npm install dhi
```

---

## Python

The fastest validation library in the Python ecosystem. 27M validations/sec — 3x faster than C extensions, 136x faster than Pydantic.

```python
from dhi import _dhi_native

users = [
    {"name": "Alice", "email": "alice@example.com", "age": 25},
    {"name": "Bob", "email": "bob@example.com", "age": 30},
]

specs = {
    'name': ('string', 2, 100),
    'email': ('email',),
    'age': ('int_positive',),
}

results, valid_count = _dhi_native.validate_batch_direct(users, specs)
# 27M users/sec
```

### vs the field

| Library | Throughput | Comparison |
|---------|------------|------------|
| **dhi** | **27.3M/sec** | - |
| satya (Rust + PyO3) | 9.6M/sec | 2.8x slower |
| msgspec (C) | 8.7M/sec | 3.1x slower |
| Pydantic | 0.2M/sec | 136x slower |

24 built-in validators: email, URL, UUID, IPv4, base64, ISO dates, string length, number ranges, and more.

```bash
pip install dhi
```

---

## How it's built

dhi is written in Zig, a language designed for high-performance systems programming. The same validation core powers both ecosystems:

**TypeScript** — Compiles to a 28KB WebAssembly module with 128-bit SIMD vector operations. Object schemas are JIT-compiled into specialized validator functions. The happy path never allocates.

**Python** — Compiles to a native C extension that extracts values directly from Python dicts. Batch validation runs in a single FFI call. No intermediate objects, no GC pressure.

---

## What you can validate

**Strings** — email, URL, UUID, IPv4, base64, ISO dates, length, regex, startsWith, endsWith, includes

**Numbers** — int, positive, negative, ranges, multipleOf, finite

**Composites** (TypeScript) — objects, arrays, tuples, records, maps, sets, unions, discriminated unions, intersections

**Modifiers** (TypeScript) — optional, nullable, default, transform, refine, pipe, coerce

---

## Run the benchmarks

```bash
# TypeScript
git clone https://github.com/justrach/dhi-zig.git
cd dhi-zig/js-bindings
bun install
bun run benchmark-vs-zod.ts

# Python
cd dhi-zig/python-bindings
pip install -e .
python benchmark_batch.py
```

---

## Requirements

- **TypeScript**: Node.js 18+ / Bun / Deno (anywhere WASM runs)
- **Python**: 3.9+ on macOS (Apple Silicon) or Linux x86_64

## License

MIT

---

**dhi** (Sanskrit: wisdom) — fast validation for the languages you actually use.
