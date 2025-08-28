# ADR 0002: Native Typed API (TypeScript-first)

- Status: Accepted
- Date: 2025-08-28

## Context
DHI exposes a TypeScript-first API in `src/typed.ts`, exported from `src/index.ts` as `object`, `string`, `number`, `boolean`, `optional`, `nullable`, `model`, and types like `Schema`, `ObjectSchema`, and `TypedInfer`. This API offers compile-time safety, fast validation paths, and a better DX than the Zod-compat layer.

## Decision
- Make the typed API the recommended public interface.
- Keep method surface minimal and composable. Prefer primitives + object composition.
- Provide batch validation methods optimized for hot paths.
- Provide `model(name, shape)` for contextual errors and ergonomic DX.

## Key Design Points
- `Schema<T>` interface with `validate`, `validateBatch`, `safeParse`.
- `object()` uses an ultra-fast path for simple schemas (≤4 keys) with unrolled checks, falling back to generic logic otherwise.
- `optional(schema)` and `nullable(schema)` are wrappers that do not burden hot paths.
- `model(name, shape)` decorates an `ObjectSchema`, preserving types while adding contextual error messages.

## Alternatives Considered
- Full builder-chaining on all nodes (higher complexity, harder to optimize).
- Proxy-based magic (fragile type inference, poorer tooling).

## Consequences
- Smaller API surface reduces learning overhead but may require users to build helpers for advanced use cases.
- Clear migration story away from the Zod-compat layer.

## References
- Code: `src/typed.ts`
- Exports: `src/index.ts`
