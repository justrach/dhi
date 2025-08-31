# DHI One-Step Replacement for Zod — TODO

> Goal: Make `dhi` a practical one-step replacement for `zod` in most codebases without large refactors, preserving ergonomics and compatibility while delivering superior performance.

## 1) API Surface Parity (High Priority)
- Discriminated unions: Validate literal discriminator types strictly (already supported); add richer error reporting.
- Unions: Ensure nested unions and mixed primitives/objects are covered; align error shape with Zod where feasible.
- Primitives refinements: `string().min/max/regex/email/url/uuid`, `number().min/max/int/finite/multipleOf`, `boolean()` (done).
- Containers:
  - `array(schema).min/max/nonempty` (length constraints, nonempty helper)
  - `record(schema)` (done; JS fast path implemented)
  - `tuple([...])` (fixed-length arrays, heterogeneous)
  - `set(schema)`, `map(key, value)`
- Objects:
  - Strict/strip/passthrough modes; `catchall(schema)`
  - `partial`, `pick`, `omit`, `merge`, `extend`
  - Default values: `.default(value)`
- Literals & enums: `literal(value)`, `nativeEnum(Enum)`, `enum([...])`
- Advanced types: `date`, `bigint`, `symbol` (JS API present), `function()`, `promise()`
- Effects & composition: `.refine`, `.superRefine`, `.transform`, `.pipe`, `.preprocess`
- Lazy/recursive schemas: `lazy(() => schema)` for self-referential types
- Type utilities: `brand`, `describe`, `keyof`, error maps
- Async parse: `safeParseAsync`, async effects support

## 2) Compatibility Layer (Zod Interop)
- Extend `src/zod-compat.ts` to cover most-used Zod APIs above (scoped, not full parity).
- Error shape: Ensure `safeParse` returns Zod-compatible `ZodError` in compat layer.
- Migration codemods: Optional codemod to replace `import { z } from 'zod'` with `import { z } from 'dhi'` and flag unsupported constructs.

## 3) Performance & Hidden-Class Stability (“Fast Mode” Guidance)
- Document fast object construction patterns: stable key order, avoid `delete`, avoid ad-hoc spreads, prefer `undefined` for optionals; consider `Object.seal/freeze` or class instances.
- Link ADR-0007 (deep nested fast path) and ADR-0008 (property access cost) from README.
- Provide before/after examples and micro-bench recipes.

## 4) Validation Semantics & Options
- Unknown keys policy: strict/strip/passthrough toggles per object schema.
- Optional vs nullable semantics: ensure parity with Zod behavior in compat layer.
- Error aggregation vs fast-fail: add configurable behavior per schema (aggregate for developer UX, fast-fail for max perf).

## 5) DX & Tooling
- Typed error reporting with path context; unify across native API and compat layer.
- Introspection: expose schema metadata (`_def`-like) for tooling.
- Dev warnings for anti-patterns that break ICs (e.g., megamorphic records).

## 6) Benchmarks & CI
- Expand real-world benchmarks to cover tuple, strict/strip object modes, and record-heavy scenarios.
- Track perf dashboards; assert no regressions in CI for hot paths.

## 7) WASM/JS Parity
- Ensure WASM path maintains key atomization and avoids string conversions on hot paths.
- Keep JS typed fast paths (ADR-0007/0008) as first-class alternatives where WASM isn’t used.

---

Prioritized next steps:
1) Strict/strip/passthrough object modes + `catchall`.
2) String/number refinement helpers (min/max/regex/int/multipleOf).
3) Tuple and array length constraints (nonempty).
4) Extend `zod-compat` to cover (1–3) with matching error shapes.
