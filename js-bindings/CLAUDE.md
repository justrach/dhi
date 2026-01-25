# dhi TypeScript - Claude Code Context

SIMD-powered Zod replacement. Up to 77x faster.

## Performance vs Zod 4

| Operation | dhi | Zod | Speedup |
|-----------|-----|-----|---------|
| Invalid number | 46.4M/s | 0.6M/s | **77x** |
| Invalid email | 36.2M/s | 0.5M/s | **75x** |
| Number validation | 62.2M/s | 12.8M/s | **4.9x** |
| Nested objects | 29.7M/s | 3.9M/s | **7.6x** |
| User objects | 16.7M/s | 4.0M/s | **4.2x** |

## Quick Start

```typescript
// Drop-in Zod replacement
import { z } from 'dhi';  // or 'dhi/schema'

const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive(),
});

const user = UserSchema.parse(data);
type User = z.infer<typeof UserSchema>;
```

## File Structure

```
js-bindings/
├── schema.ts           # Main API (Zod-compatible)
├── dhi.wasm            # WASM binary (28KB)
├── index.ts            # Batch API
├── benchmark-vs-zod.ts # Benchmark script
├── test-zod4-compat.ts # Zod compatibility tests
└── package.json        # npm package config
```

## Commands

```bash
bun install              # Install dependencies
bun test                 # Run tests
bun run bench            # Benchmark vs Zod
bun run build            # Build for npm
```

## Supported Validators

### String
`min()`, `max()`, `length()`, `email()`, `url()`, `uuid()`, `ipv4()`, `ipv6()`,
`base64()`, `date()`, `datetime()`, `startsWith()`, `endsWith()`, `includes()`,
`regex()`, `trim()`, `toLowerCase()`, `toUpperCase()`

### Number
`min()`, `max()`, `gt()`, `gte()`, `lt()`, `lte()`, `int()`, `positive()`,
`negative()`, `nonnegative()`, `nonpositive()`, `finite()`, `multipleOf()`

### Composite
`object()`, `array()`, `union()`, `discriminatedUnion()`, `enum()`, `literal()`,
`optional()`, `nullable()`, `nullish()`, `default()`, `transform()`, `refine()`

### Coercion
`z.coerce.string()`, `z.coerce.number()`, `z.coerce.boolean()`

## Architecture

```
TypeScript → dhi.wasm (Zig→WASM) → SIMD validators
                 ↓
         28KB, edge-compatible
```

- WASM compiled from Zig with SIMD optimizations
- Works in Node, Bun, Deno, browsers, edge runtimes
- Full Zod 4 API compatibility

## Publishing

```bash
npm version patch  # or minor/major
npm publish
```

## Links

- **npm**: https://www.npmjs.com/package/dhi
- **GitHub**: https://github.com/justrach/satya-zig
