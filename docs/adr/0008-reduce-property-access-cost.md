# ADR 0008: Reduce Property Access Cost (V8 Hidden-Class & Shape Wins)

- Status: Accepted
- Date: 2025-08-29

## Context

Hot validation paths were incurring avoidable costs from megamorphic object shapes, string materialization, and transient allocations when traversing records. In V8 (and most modern JS engines), stable hidden classes (object shapes) and monomorphic ICs (inline caches) are critical for peak throughput. Reflect-based access and ad-hoc object construction patterns cause IC thrash and deopt.

## Problem

- Megamorphic shapes: Records constructed with different property orders, deletes, spreads, or optional fields appearing in different positions degrade ICs.
- Key materialization: Rebuilding key strings or converting JS values to strings in hot loops creates pressure on the allocator and GC.
- `Object.values()` allocations: Calling `Object.values(obj)` in tight loops allocates arrays for each object visited, adding overhead and GC churn.

## Decision

1) Encourage monomorphic shapes at call sites ("Fast Mode"):
- Document guidelines for callers to keep shapes monomorphic:
  - Construct objects with consistent property order.
  - Avoid `delete`; prefer `undefined` for optional fields.
  - Avoid ad-hoc `{...spread}` that may perturb insertion order; preallocate and assign.
  - Consider `Object.seal`/`Object.freeze` or class instances for very hot objects.
- Provide guidance in docs and examples; behavior is unchanged, but consistent shapes allow the engine to keep monomorphic ICs on property reads.

2) Key atoms: string materialization off the hot path
- Keep all key materialization in schema build time. In the typed fast paths we capture `keys` once and re-use them; we do not rebuild strings in hot loops.
- For the WASM path (Rust <-> JS), continue to atomize/capture JsValue keys once and avoid `as_string`-like conversions on the hot path.

3) Avoid `Object.values()` allocations for Record validation
- Introduce a typed API `record(valueSchema)` that validates dictionary-like objects.
- Implementation iterates properties using a fused loop (`for..in` + `hasOwnProperty`) and validates values in-place; no `Object.values()`/`Object.entries()` allocations.
- For primitive `valueSchema` (string/number/boolean), use direct `typeof` checks for each property to avoid per-element schema dispatch.

## Implementation

- New API: `record(valueSchema)` in `src/typed.ts` (exported from `src/index.ts`).
  - Fast primitive path via `typeof`.
  - Generic path calls `valueSchema.validate` inside the fused loop.
  - `__kind` extended to include `'record'` to keep optimizations explicit.
- Reinforced policy in typed object paths to avoid Reflect-based access and transient allocations in hot loops.

## Rationale

- Monomorphic shapes keep the engine’s inline caches stable, reducing deopts and improving property access throughput.
- Avoiding allocations (`Object.values`/`entries`) in hot loops lowers GC pressure and improves steady-state speed.
- Atomized keys and precomputed `keys[]` arrays keep string churn out of the hot path.

## Alternatives Considered

- Reflect.get for dynamic access: simpler but slower in hot paths; avoided.
- Using `Object.entries()` for readability: rejected for performance-sensitive code due to per-iteration allocations.
- Codegen for record validators: more complex, marginal additional gains vs. fused loops for our cases.

## Consequences

- API surface grows with `record()`; capability mirrors existing WASM API’s record handling, but with a JS fast path.
- Users get explicit guidance on how to construct “fast” objects for the best performance.
- No user-visible semantic changes; this is purely about speed.

## Testing & Benchmarks

- Deeply nested and dictionary-heavy scenarios benefit. The improvements combine with ADR-0007 (prefix DAG + type grouping) to reduce path and access costs.
- Benchmarks to watch: `realworld.ts` scenarios and any record-heavy use cases.

## Results

The real-world benchmark suite showed the following (post-optimization):

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
- The largest gains appear where monomorphic shapes and fused loops dominate (e.g., analytics union case).
- Deeply Nested benefits from both ADR-0007 and this ADR’s access-cost reductions.
- Orders shows slight regression; it is array-heavy and not fully covered by these improvements. Follow-ups will target array-of-object fusion and layout stability.

## References

- Code: `src/typed.ts` (record validator and fused loops), `src/index.ts` export.
- Background: V8 hidden classes, IC stability, and monomorphism best practices.
