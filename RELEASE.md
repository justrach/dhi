# DHI Release Notes — Nested Fast Path & Property Access Optimizations

Date: 2025-08-29

## Highlights

- Deeply Nested Fast Path
  - Iterative path-DAG validator evaluates each object prefix once, reusing references for children.
  - Leaf grouping by type (string → number → boolean → object) improves JIT monomorphism.
  - Pre-fail strategy: skip entire subtrees when a parent is null/non-object or a required key is missing.
  - Depth cap removed: optimization applies to all supported nested-object trees.

- Fused Record Validator
  - New `record(valueSchema)` API with a fused loop that avoids `Object.values()`/`entries` allocations and `Reflect.get` in hot loops.
  - Primitive fast path uses direct `typeof` checks for maximal throughput.

- Documentation
  - ADR-0007: Deeply Nested Fast Path via Path DAG + Type-Grouped Leaves.
  - ADR-0008: Reduce Property Access Cost (V8 Hidden-Class & Shape Wins) + benchmark results.

## Performance Snapshot (Real-World Suite)

```
Analytics Events (Union)
  Size: 500,000
  DHI: 28.85ms ± 1.71ms (17,330,760 ops/s)
  Zod: 177.32ms ± 3.65ms (2,819,684 ops/s)
  Speedup: 6.15x

User Profiles (Optional-heavy)
  Size: 500,000
  DHI: 41.55ms ± 2.25ms (12,034,687 ops/s)
  Zod: 47.39ms ± 1.71ms (10,551,702 ops/s)
  Speedup: 1.14x

Deeply Nested (Depth 5)
  Size: 100,000
  DHI: 10.42ms ± 1.30ms (9,593,155 ops/s)
  Zod: 12.20ms ± 0.22ms (8,198,881 ops/s)
  Speedup: 1.17x

Orders (Compact)
  Size: 200,000
  DHI: 48.28ms ± 2.26ms (4,142,790 ops/s)
  Zod: 43.74ms ± 1.68ms (4,572,541 ops/s)
  Speedup: 0.91x

🏁 Average speedup: 2.34x
```

Notes:
- Largest gains in Analytics Events due to monomorphic shapes + fused loops.
- Deeply Nested flips to a win via prefix reuse + type grouping.
- Orders is array-heavy; further work will focus on array-of-object fusion.

## Upgrade Guide

- No breaking changes.
- New `record(valueSchema)` available via `import { record } from 'dhi'`.
- The nested fast path is automatically used for object-only nested schemas; no action needed.
- For best results, follow “Fast Mode” guidance (stable property order, avoid deletes/ad-hoc spreads, consider `seal/freeze`).

## Known Gaps (Next Milestones)

- Strict/strip/passthrough object modes and `catchall(schema)`.
- Refinements: `string().min/max/regex/email/url/uuid`, `number().min/max/int/multipleOf`.
- Tuple and array length constraints (nonempty/min/max).
- Extended Zod-compat coverage (refine/superRefine/transform/lazy/tuple/etc.).
- Array-of-object fused validator and layout stability improvements.

## References

- Code: `src/typed.ts` (nested fast path, record validator), `src/index.ts` (export updates)
- ADRs: `docs/adr/0007-deeply-nested-fast-path.md`, `docs/adr/0008-reduce-property-access-cost.md`
