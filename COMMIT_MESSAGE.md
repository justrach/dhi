feat(typed): deeply nested fast path via path DAG; type-grouped leaves; pre-fail at prefix

Introduce an iterative, stack-based validator for nested object-only schemas that:
- Traverses each object prefix once per value (prefix/DAG compaction), reusing references for all children.
- Groups direct children by leaf type (string → number → boolean → object) to reduce polymorphism and stabilize ICs.
- Short-circuits entire subtrees when a parent is null/non-object or a required key is missing.

Also remove the depth cap so the nested fast path applies broadly when the shape contains nested objects.

perf(typed): remove depth gate for nested fast path

Previously we only used the nested path when maxDepth <= 4; this change enables it for all supported nested-object trees.

feat(typed): add record(valueSchema) with fused validation loop

Add a typed record validator that avoids Object.values()/entries allocations and Reflect.get in hot loops.
- Primitive fast path: direct typeof checks for string/number/boolean values.
- Generic path: in-place validation via valueSchema.validate without array allocations.

docs(adr): add ADR-0007 (Deeply Nested Fast Path) and ADR-0008 (Reduce Property Access Cost)

ADR-0007 covers the path DAG strategy, type-grouped leaves, and early subtree skips.
ADR-0008 documents hidden-class/shape stability guidance ("Fast Mode"), key atomization off the hot path, and fused record validation.
Bench results added to ADR-0008:

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

docs(summary): link new ADRs in SUMMARY.md

refactor(exports): export record() from src/index.ts

Notes
- No breaking API changes; performance-sensitive paths improved notably, especially for deep objects and record-like data.
- Follow-ups will target array-of-object fusion and stricter object modes (strict/strip/passthrough, catchall) to close remaining gaps with Zod.
