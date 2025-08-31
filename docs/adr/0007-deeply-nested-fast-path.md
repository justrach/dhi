# ADR 0007: Deeply Nested Fast Path via Path DAG + Type-Grouped Leaves

- Status: Accepted
- Date: 2025-08-29

## Context

Our “Deeply Nested (Depth 5)” scenario underperformed against Zod in earlier runs. Profiling showed most time spent in:
- Repeated path walks for each leaf (e.g., reading `a.b.c.d` multiple times).
- Polymorphic `typeof` sites due to interleaved string/number/boolean checks.
- Missed early exits: parent-null checks triggered per leaf rather than once per prefix.

We already had a specialized nested-object validator, but it was gated by a depth heuristic and didn’t aggressively minimize polymorphism.

## Decision

Make “Deeply Nested” a first-class fast path by:
- Path DAG compaction: Build a compact node graph (prefix DAG) from the schema and traverse each object prefix once per value. Children reuse the already-fetched parent reference.
- Leaf grouping by type: At each object node, group direct children in the order string → number → boolean → object to keep JIT sites monomorphic.
- Pre-fail strategy at prefix: If a parent is null/non-object or a required property is missing, short-circuit the entire subtree immediately.
- Remove depth cap: Always use this optimized path for nested object-only shapes regardless of depth (subject to supported kinds).

## Implementation

Changes live in `src/typed.ts`:
- Remove depth cap: In `object(...).validateBatch`, use the nested-object fast path whenever the schema contains nested objects, not only when `maxDepth <= 4`.
- Prefix DAG traversal: `createIterativeObjectValidator` constructs an iterative (stack-based) validator from the object schema:
  - Each node encodes: `keys: string[]`, `children: IterNode[]`, `optional: boolean[]`.
  - Traversal uses a small manual stack. For object nodes, it pushes children once (reverse order to keep forward processing) and validates primitives via direct `typeof` checks.
  - No recursion; fewer function frames and predictable control flow.
- Type-grouped children: After building a node, reorder its immediate children indices by leaf-kind (string, then number, then boolean, then child objects). This reduces inline cache churn and maintains more monomorphic `typeof` sites in tight loops.
- Pre-fail at prefix: The iterative traversal checks parent object-ness once and required-property presence before descending. Missing required keys or non-object parents fail early without visiting descendants.

Unsupported in this fast path: arrays, unions, and complex kinds within the object tree (these fall back to the legacy path compilation or per-schema validation).

## Rationale

- Lower property access cost: Reading `a.b.c` once and reusing the reference for all children avoids repeated lookups along identical prefixes.
- Better JIT behavior: Grouping by type stabilizes the inline caches at `typeof` sites and reduces polymorphic dispatch.
- Early pruning: Skipping entire subtrees on parent failure saves work proportional to the number of descendants.
- Predictable control flow: The iterative stack avoids recursion overhead and makes the hot path easier for the JIT to optimize.

## Alternatives Considered

- Code generation (emit specialized JS per schema): Potentially faster, but adds build/runtime complexity, caching, security constraints, and tooling overhead. The iterative approach gets most of the win without codegen.
- Recursive validator: Simpler to write but introduces function-call overhead, stack depth issues, and less predictable control flow in hot loops.
- Keeping mixed-type order: Simpler but degrades IC stability and hurts throughput in large batches.

## Consequences

- Performance: Deeply nested schemas with primitive leaves now benefit from prefix reuse and type grouping; this flipped the Deeply Nested scenario to be significantly faster in practice.
- Maintainability: The fast path adds limited complexity confined to the nested-object validator; fallbacks still handle arrays/unions.
- Semantics: Validation order of sibling fields changes (by type grouping), but observable behavior is identical (presence/optional checks and primitive type checks are order independent).

## Rollback / Feature Flags

- If regressions appear, we can:
  - Reintroduce a depth cap or a feature flag to disable the iterative path.
  - Bypass type-grouping to restore original key order while keeping the prefix cache.

## Testing & Benchmarks

- Benchmarks: `benchmarks/realworld.ts` includes “Deeply Nested (Depth 5)”. The optimized path now runs there by default.
- Parallel validation: `benchmarks/parallel_nested.ts` exercises the same shape across threads.
- Unit/Type tests: Existing tests continue to pass; behavior is unchanged for correctness.

## References

- Code:
  - `src/typed.ts` — nested fast path and iterative DAG validator
  - `object().validateBatch` — fast-path selection
  - `createIterativeObjectValidator` — prefix DAG build + stack traversal + type grouping
- Benchmarks:
  - `benchmarks/realworld.ts` (Deeply Nested scenario)
  - `benchmarks/parallel_nested.ts`

