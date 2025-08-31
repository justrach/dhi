# AGENTS.md — Guide for AI Agents Working on DHI

Last updated: 2025-08-30

This document is a concise, source‑of‑truth guide for AI coding agents contributing to this repository. It reflects what’s actually present in the repo (files, scripts, APIs) so agents can make correct, minimal, and verifiable changes.

## Overview

DHI is a high‑performance TypeScript validation library with:
- A recommended TypeScript‑first API (fast, type‑safe, no WASM dependency at call‑site)
- A legacy WASM‑backed API (class `DhiType`, async initialization)
- A temporary Zod‑compatible facade to ease migration

Core goals: performance, type safety, predictable DX, and small browser payloads.

Key references:
- README: features, performance, usage examples (`README.md`)
- LLM usage guide for this library (`llm.md`)
- Migration notes and examples (`MIGRATION.md`, `migrations/`)
- Tests (`tests/`)
- Benchmarks (`benchmarks/`)

Note: A previous `AGENT.md` exists but is out of sync (lists files that aren’t in `src/`). Prefer this AGENTS.md, README, and `src/*` for ground truth.

## Code Layout

Source (TypeScript):
- `src/index.ts`: Public exports. Re-exports legacy WASM API and recommended typed API, plus a temporary Zod‑compat surface.
- `src/typed.ts`: Recommended typed API implementation, including SIMD‑style batch paths and nested‑object fast paths.
- `src/core.ts`: Legacy WASM‑centric `DhiType` wrapper with batch validation and debug toggles.
- `src/wasm.ts`: WASM loader/initializer (Node and browser), robust init strategies.
- `src/zod-compat.ts`: Minimal Zod‑like surface to aid migrations.

Build artifacts:
- `dist/`: Compiled JS, types, and wasm/node glue. Do not edit by hand.

Docs and examples:
- `README.md`: Project overview, usage, perf notes.
- `llm.md`: Practical guidance for AI/LLM usage patterns with DHI.
- `examples/` and top‑level `example.ts`: Usage samples.

Other notable folders:
- `benchmarks/`: Micro and real‑world benchmark scripts (some use Bun).
- `frontend/`, `frontend2/`: Next.js demo apps (not required for core library changes).
- `migrations/`: Migration notes and scripts for Zod→DHI.
- `tests/`: Basic Jest tests for core flows.

## Public APIs (as exported in `src/index.ts`)

Recommended TypeScript‑first API:
- Constructors: `object`, `string`, `number`, `boolean`, `array`, `record`
- Composition/utilities: `model`, `union`, `discriminatedUnion`, `optional`, `nullable`
- Types: `Schema`, `ObjectSchema`, and `TypedInfer` (alias for `Infer`)

Temporary Zod‑compat (migration aid only):
- `z`, `ZodError` (subset; see `src/zod-compat.ts`)

Legacy WASM API:
- `dhi`, `createType` from `./core` (async initialization required via `ensureWasmInitialized` pathway in `src/wasm.ts`)

For usage examples of both styles, see `README.md` and `llm.md`.

## Build, Test, Benchmarks

Prerequisites (for full toolchain):
- Node.js environment
- Rust toolchain + `wasm-pack` (for WASM tests/build)
- Bun (for some benchmarks and examples)

Scripts (from `package.json`):
- Build: `npm run build` (runs `bash scripts/build.sh`)
- TypeScript only: `npm run build:ts`
- Tests: `npm test` (runs `test:wasm` and `test:jest`)
  - WASM tests: `npm run test:wasm` (requires Rust/wasm-pack)
  - Jest tests: `npm run test:jest`
- Benchmarks:
  - `npm run benchmark` → `bun run benchmarks/benchmark.ts`
  - `npm run benchmark:comprehensive`
  - `npm run benchmark:real`
  - `npm run benchmark:parallel` (Node + ts-node ESM loader)
- Examples:
  - `npm run example` → `bun run examples/example.ts`

Environment caveats for agents:
- Network access may be restricted; avoid adding dependencies unless requested.
- WASM build/tests require Rust and `wasm-pack`; do not assume availability unless explicitly enabled.
- Prefer local, fast checks (Jest unit tests, typecheck) when possible.

## Contribution Guidance (for AI agents)

General principles:
- Make minimal, targeted changes; avoid refactors that alter public API unless requested.
- Keep performance in mind; prefer fast paths and avoid allocations in hot loops.
- Do not edit generated artifacts (`dist/`) or lockfiles unless explicitly asked.
- Maintain existing code style and patterns used in `src/typed.ts` and `src/core.ts`.
- When changing behavior, update or add focused tests under `tests/`.

When touching the typed API (`src/typed.ts`):
- Preserve optimized paths:
  - SIMD‑style batch processing for ≤4‑field primitive objects
  - Nested‑object fast path (iterative validator, grouped leaves)
- Keep `__kind` discriminators consistent across schemas.
- Avoid deep call chains inside hot loops; prefer unrolled or batched operations.

When touching the legacy WASM API (`src/core.ts` and `src/wasm.ts`):
- Keep initialization robust across Node/browser; don’t regress fallback sequence.
- For object schemas, respect optional/nullable semantics handled at the wrapper level.
- Maintain `validate`/`validate_batch` result shapes.

Zod‑compat (`src/zod-compat.ts`):
- It’s intentionally limited; only expand coverage if requested.
- Ensure thrown errors become `ZodError` in `safeParse` paths.

Docs and examples:
- If you change API surface or semantics, update `README.md` and examples.
- If changing guidance for model usage, update `llm.md`.

Testing strategy for agents:
- Start with Jest unit tests that exercise only the changed surface.
- If WASM is required for your change, gate instructions clearly and avoid running in restricted environments.

Benchmarks (optional validation):
- Use `benchmarks/` to sanity‑check perf changes when environment permits.
- Prefer comparing before/after on the same machine; do not over‑interpret small deltas.

Commit and release notes:
- Prefer clear, semantic messages (scope: summary), e.g., `perf(typed): ...`, `feat(typed): ...`, `fix(core): ...`.
- See `COMMIT_MESSAGE.md` for a recent example style (informational, not a hard template).
- Do not publish or alter release tags unless explicitly asked.

## Known Mismatches and Pitfalls

- `AGENT.md` and `SUMMARY.md` contain references to files that do not exist in this repo; treat them as outdated. Use `src/` as truth.
- LICENSE references differ between `LICENSE` and `package.json`. Treat the `LICENSE` file as canonical for legal terms.
- Some docs (e.g., ADR references in `RELEASE.md`) are not present under `docs/`. Do not add phantom links; if asked, create/update real docs under `docs/`.

## Quick Examples

Typed‑first API:

```ts
import { object, string, number, boolean, optional, model, type ObjectSchema, type TypedInfer } from 'dhi';

interface User { name: string; age?: number; email: string; active: boolean }

const userSchema: ObjectSchema<User> = object({
  name: string(),
  age: optional(number()),
  email: string(),
  active: boolean()
});

type UserOut = TypedInfer<typeof userSchema>; // User
```

Legacy WASM API:

```ts
import { dhi } from 'dhi';

const User = await dhi.object({
  name: await dhi.string(),
  age: await dhi.number()
});

const ok = User.validate({ name: 'Jane', age: 42 });
```

Zod‑compat (temporary):

```ts
import { z } from 'dhi';
const User = z.object({ id: z.string(), name: z.string() });
```

## Zod → DHI (One‑Liner)

- In code: replace your Zod import with DHI’s facade. That’s it.

```ts
// Before
import { z } from 'zod';

// After (one‑liner)
import { z } from 'dhi';
```

- Optional codemod (tracked TS/TSX files):
  - macOS/BSD sed:
    `sed -i '' -e "s/from 'zod'/from 'dhi'/g" $(git ls-files "**/*.ts" "**/*.tsx" "**/*.mts" "**/*.cts")`
  - GNU sed:
    `sed -i -e "s/from 'zod'/from 'dhi'/g" $(git ls-files "**/*.ts" "**/*.tsx" "**/*.mts" "**/*.cts")`

Preview first:
`git grep -n "from 'zod'" -- "**/*.ts" "**/*.tsx" "**/*.mts" "**/*.cts"`

## When In Doubt

- Cross‑check exports in `src/index.ts`.
- Favor `README.md` + actual `src/*` over any outdated docs.
- Ask for confirmation (via a plan/update) before large refactors or adding dependencies.
