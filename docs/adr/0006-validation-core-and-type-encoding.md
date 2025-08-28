# ADR 0006: Validation Core and Type Encoding (Rust ⇄ TS)

- Status: Accepted
- Date: 2025-08-28

## Context
`src/core.ts` builds a `DhiType` wrapper over the Rust core (`DhiCore`). Types are encoded as strings (e.g., `string`, `number`, `Array<T>`, `Record<T>`, `object`) and field metadata (required/optional/nullable) to drive fast validators.

## Decision
- Keep a narrow set of encodings that the Rust core recognizes via `parse_field_type` and friends.
- For object roots, validate the object directly; for primitives/arrays/record/etc., create a single field named `value` for uniformity.
- Defer optional/nullable handling for object fields to object construction time so hot code paths stay branch-light.
- Provide `validate_batch` returning parallel results for throughput.

## Performance Considerations
- Short-circuit invalid paths early; unroll simple loops where helpful (TS side) and chunk processing on Rust/WASM side.
- Provide `set_debug` to toggle tracing without affecting hot paths.

## Alternatives Considered
- AST-based rich type graph (higher fidelity, heavier serialization and runtime cost).
- JSON Schema compatibility at the core (nice interop, slower and more complex).

## Consequences
- Simpler compiler/bridge layer; easier to extend incrementally (e.g., tuples/unions later).
- Clear mapping from TS wrappers to Rust validators.

## References
- TS core: `src/core.ts`
- Rust core: `rust/src/lib.rs`
