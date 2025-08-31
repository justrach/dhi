# ADR 0009: Bundler Side-Effects Normalization for WASM Package (Bun/Vite/ESBuild)

- Status: Accepted
- Date: 2025-08-29

## Context

When running migration scripts with Bun, a warning appeared:

```
wildcard sideEffects are not supported yet, which means this package will be deoptimized
   at /dist/package.json:13:5
```

The `dist/package.json` is produced by `wasm-pack` (Rust → WASM). It contained:

```json
{
  "sideEffects": ["./snippets/*"]
}
```

Bun (and some bundlers) don’t support wildcard arrays for `sideEffects`. As a result, the package is deoptimized (tree-shaking and other optimizations can be disabled), and a warning is shown. Our `dist/` also does not contain a `snippets/` directory, so the entry is superfluous.

## Decision

- Normalize `dist/package.json` to set `"sideEffects": false` after copying artifacts from `rust/pkg/`.
- Persist this normalization in the build pipeline so future builds do not reintroduce the wildcard entry.

## Implementation

- One-time fix: Edited `dist/package.json` to replace the wildcard array with `false`.
- Build hardening: Updated `scripts/build.sh` to run a small Node one-liner after copying `rust/pkg/*` to `dist/`:
  - If `sideEffects` is an array, rewrite it to `false`.
  - This keeps the output compatible with Bun/Vite/esbuild and avoids deoptimization warnings.

## Why This Works

- Bundlers interpret `sideEffects` as a hint for tree-shaking. `false` declares that files have no import-time side effects, allowing safe pruning and preventing deopts.
- Our generated JS glue and typed layers have no import-time side effects that must be preserved (initialization is explicit via functions), so `false` is correct.
- The unsupported wildcard pattern was causing Bun to fallback to a conservative (slower) path; replacing it with `false` lets the bundler optimize normally.

## Alternatives Considered

- Leave as-is: Keep the wildcard and accept deoptimization and warnings. Rejected due to avoidable performance/UX costs.
- Expand wildcard into explicit file paths: Increases build complexity and is unnecessary since `snippets/` is not present.
- Mark specific files as side-effectful: Not needed; there are no import-time effects.

## Consequences

- Improved bundler behavior (Bun, Vite, esbuild): no warning, better tree-shaking.
- If future WASM packaging introduces real side-effectful files, we must revisit and explicitly mark them (or scope `sideEffects` to those files).

## Verification

- Run migration scripts with Bun after normalization: warning disappears.
- Re-run full build and confirm `dist/package.json` keeps `"sideEffects": false`.

## Rollback

- If we discover required import-time effects, set `sideEffects` to an explicit list of files that must be preserved, or remove the normalization step.

## References

- File: `dist/package.json` (normalized)
- Build: `scripts/build.sh` (post-copy normalization)
- Background: webpack docs on `sideEffects`, Bun/Vite behavior regarding tree-shaking and side effects
