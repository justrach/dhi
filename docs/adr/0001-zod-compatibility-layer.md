# ADR 0001: Zod Compatibility Layer

- Status: Accepted
- Date: 2025-08-28

## Context
Many codebases rely on Zod (`zod`) for schema validation. To enable near drop-in migration without large refactors, DHI provides a temporary Zod-compatibility layer exported as `z` and `ZodError` from `dhi` (`import { z } from 'dhi'`). Internally it uses DHI’s fast validators to retain performance while keeping Zod’s familiar API surface.

## Decision
- Provide a compatibility layer that mirrors core Zod ergonomics for the most common use-cases.
- Keep the API intentionally scoped so maintenance remains tractable and migration toward DHI’s native API is incentivized.
- Return a `ZodError`-compatible error shape from `safeParse` and related APIs for easy drop-in.
- Document feature support explicitly and encourage users to move to DHI’s native API for best performance and long-term support.

## Scope of Supported APIs (current snapshot)
- Primitives: `z.string()`, `z.number()`, `z.boolean()`
- Containers: `z.object({...})`, `z.array(schema)`, `z.record(schema)`
- Enums: `z.enum([...])`
- Modifiers & combinators: `.optional()`, `.nullable()`, `.transform(fn)`, `.pipe(schema)`
- Parsing: `.parse`, `.safeParse` (and async forms where applicable)
- Errors: `ZodError` with `issues` array

## Known Gaps vs. Full Zod API
Not yet implemented or partially implemented:
- Complex types: `tuple`, `union`, `discriminatedUnion`, `intersection`, `map`, `set`
- Extended primitives and helpers: `bigint`, `date`, `symbol`, numeric/string refinements (`min`, `max`, `int`, `multipleOf`, `email`, `url`, `uuid`, `regex`, etc.)
- Type-level helpers: `keyof`, `brand`, `describe`
- Advanced effects: `refine`, `superRefine`
- Function/promise schemas: `z.function()`, `z.promise()`
- `lazy`, `nativeEnum`, `literal`

These gaps are tracked to avoid over-committing to full 1:1 parity and to keep the focus on the native DHI API.

## Rationale
- Minimize short-term migration friction: change imports from `zod` to `dhi` and keep the rest of the code largely unchanged.
- Offer immediate performance wins without forcing an upfront rewrite.
- Allow teams to migrate incrementally from compatibility to native API when convenient.

## Consequences
- The compatibility layer is temporary and will be removed in a future major release. Users should plan to migrate to native APIs.
- Some advanced Zod features are not supported; projects depending on them should migrate feature-by-feature using DHI’s native primitives.

## Migration Guidance (high-level)
- Phase 1: Replace `import { z } from 'zod'` with `import { z } from 'dhi'`.
- Phase 2: Gradually replace schemas with DHI native API (`string()`, `number()`, `object()`, etc.).
- Phase 3: Remove remaining `z` usage and adopt DHI-native error handling and helpers.

## References
- Code: `src/zod-compat.ts`
- Entry: `src/index.ts` exports `z` and `ZodError`
- Migrations: `migrations/` examples
