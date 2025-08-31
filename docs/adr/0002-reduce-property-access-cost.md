# ADR 0002: Reduce Property Access Cost (V8 Hidden-Class & Shape Wins)

- Status: Accepted
- Date: 2025-08-29
- Owners: DHI Core/Runtime
- Related: ADR-0001 (Performance benchmarks), Rust smallvec optimizations, Fused JS validator

## Context

DHI validates large volumes of compact and deeply nested objects. Profiling shows a significant portion of CPU is spent in JS↔WASM boundary crossings and property access on megamorphic shapes:

- Repeated `Reflect.get`, `Array.get`, and `dyn_ref` calls from Rust/WASM into JS.
- Property ICs (inline caches) deopt due to megamorphic objects, differing key orders, spread/clobber patterns, and deletes.
- Allocations in helpers such as `Object.values()` for Record types.

Recent wins (union fast path, optional handling, JS iterative validators, SmallVec in Rust) improved throughput, but deep nesting and arrays-of-objects are still bottlenecked by property access and boundary cost.

## Decision

Introduce a “Reduce Property Access Cost” strategy focused on stabilizing object shapes and minimizing boundary/property overhead. The strategy has two parts:

1) Runtime: Generate single fused JS validator functions per schema (when eligible) to collapse per-field access into a single monomorphic function body (1 call per item). Hoist shared path prefixes to reduce repeated lookups.

2) Usage Guidelines (“fast mode”): Document how callers can help the engine keep hidden-classes monomorphic by constructing objects consistently and avoiding operations that force shape changes.

This strategy is backward compatible, opt-in at runtime (auto-activated for eligible schemas), and requires no API changes.

## Rationale

- JS engines heavily optimize monomorphic property access. We get better IC stability if we:
  - Avoid megamorphic shapes (consistent construction, no deletes/spreads).
  - Avoid reflective APIs in hot loops.
  - Keep property access within one function body to let V8 inline and hoist.
- Reducing JS↔WASM crossings can be a larger win than micro-optimizing checks in Rust for compact/nested shapes.

## Scope & Eligibility

We enable fused validation when all leaf fields in a nested schema are primitives (string, number, boolean). For ineligible schemas (arrays/unions/records or non-primitive leaves), we fall back to existing validators.

Future work extends fusion to additional cases (e.g., array-of-object items with small primitive-only shapes).

## Changes

- Rust/WASM (implemented):
  - smallvec: use `SmallVec` for hot, small collections (strict/fast fields and path segments).
  - flattened paths: precompute nested leaf paths (as `JsValue` keys) and compile a single fused JS validator `Function` for eligible schemas.
  - fused path: `validate_batch` branches to the fused validator when applicable, executing one JS call per item; otherwise falls back to the flattened getter or complex paths.

- JS/TS (implemented earlier):
  - iterative nested validator and primitive-leaf fast checks to cut dynamic dispatch for deep trees (non-recursive, monomorphic property loads). This remains the fallback when fusion is not eligible.

- Record validation (planned):
  - Replace `Object.values()` in hot loops with a fused per-record validator that iterates properties without allocating intermediate arrays.

- Prefix hoisting (planned):
  - Enhance the fused code generator to hoist common path prefixes (e.g., `user → profile`) into locals and reuse them across multiple leaves.

## “Fast Mode” Usage Guidelines for Callers

To encourage monomorphic object shapes and stable ICs:

- Construct objects with consistent property order (initialize all keys in the same order across items).
- Avoid deletes/`Object.assign`/ad-hoc spreads in hot paths; prefer constructing fresh instances.
- Consider `Object.seal`/`Object.freeze` or class instances with fixed fields for stable hidden-classes.
- Keep key casing and types uniform; avoid switching a field between string/number/boolean across items.

Adhering to these minimizes megamorphism and maximizes V8’s optimization opportunities.

## Alternatives Considered

- Pure Rust/WASM traversal: Still incurs one boundary call per field and repeated reflective lookups; helps less than fused JS validators for compact shapes.
- Caching per-leaf getters only: Better than Reflect in loops, but misses prefix hoisting and still pays N calls per item.
- Full JIT codegen in Rust: Higher complexity and risk, less flexible than generating small JS functions.

## Impact

- Performance: Expected to improve both “Deeply Nested” and “Orders (compact)” scenarios by reducing calls and stabilizing property ICs. Early results show improvements and lay groundwork for further gains via prefix hoisting.
- Compatibility: No breaking changes; behavior is identical. Fused path activates automatically when eligible.
- Maintainability: Fused generator is isolated; fallbacks remain in place. Code is structured to expand eligibility incrementally.

## Rollout & Verification

- Feature flag (implicit): Fusion enabled automatically when leaves are primitive-only.
- Benchmarks: Track improvements in `benchmarks/realworld.ts` for Deeply Nested and Orders.
- Regression checks: Ensure fallback paths are used for complex schemas; verify no behavior changes.

## Future Work

- Prefix hoisting in fused validators to reduce repeated `['k']` walks for shared path segments.
- Array-of-object fused fast path in Rust/JS for small primitive-only item shapes (Orders).
- Extend fusion eligibility to common non-primitive leaves (e.g., enums) where safe.
- Developer-facing “fast mode” section in README with code patterns and anti-patterns.

## References

- V8 hidden classes and inline caches best practices.
- DHI performance benches (`benchmarks/realworld.ts`, `comprehensive.ts`).
- Rust `smallvec` crate for stack-allocated small sequences.
