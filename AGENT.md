# AGENT.md

This repository contains DHI, a high‑performance TypeScript validation library with both a typed‑first API and a Zod‑like facade. This document captures the conventions and guardrails for automated agents and contributors when changing code, optimizing performance, and shipping releases.

## Repository map

- `src/` — TypeScript APIs and fast paths
  - `typed.ts` — Typed‑first API (recommended). Houses object/array primitives, `optional/nullable`, `union`, `discriminatedUnion`, deep‑nested fast paths, and array‑of‑object fast path.
  - `index.ts` — Public exports (typed‑first API, Zod compatibility layer, and types).
  - `zod-compat.ts` — Lightweight Zod‑like facade (migration aid).
- `rust/` — WASM core and optional native host library
  - `src/lib.rs` — Rust runtime with batch validators, JS interop, flattened path cache, and fused per‑schema JS validator.
  - `Cargo.toml` — Crate settings; profile tuned for perf.
- `scripts/build.sh` — Single entrypoint to build wasm + TS + native host.
- `benchmarks/` — Bench suites, including real‑world scenarios and Zod comparisons.
- `docs/adr/` — Architecture decision records.

## Build and test

- Install prerequisites: Node 18+/Bun, Rust stable, `wasm-pack`.
- Build everything: `bash scripts/build.sh`
- Run real‑world bench: `bun run benchmarks/realworld.ts`

Notes:
- The script applies aggressive RUSTFLAGS for both wasm and native builds, while avoiding LTO headaches in toolchains with proc‑macros.
- GitHub Actions workflow will run the same steps on release.

## Performance guardrails

When making changes in hot paths:

1) Prefer monomorphic property access
   - Avoid `Reflect.get` in loops when a fused validator can inline property access.
   - Keep key strings out of hot loops; precompute `JsValue`/strings once.

2) Collapse JS↔WASM boundary cost
   - Use the fused per‑schema JS validator for deep/compact objects (1 call per item).
   - Fall back to flattened‑getter path only when fusion is ineligible.

3) Use SmallVec and stack‑allocated scratch
   - For small collections (≤8 fields, ≤32 leaves), favor `SmallVec`.
   - Reuse scratch buffers/bitmaps in loops to avoid GC pressure.

4) Typed‑first API remains the recommendation
   - Keep fast paths in `typed.ts` (iterative deep‑object validator, array‑of‑object fast path).
   - The Zod‑like facade is for migration; do not regress typed‑first perf.

5) Build flags
   - WASM: SIMD, bulk‑memory, `wasm-opt -O3`.
   - Native: `-C target-cpu=native -C opt-level=3 -C codegen-units=1 -C panic=abort`.

## Commit style

Use conventional messages with scope and summary, e.g.:

- `core(rust): fused per-schema validator + prefix hoisting`
- `typed(api): add discriminatedUnion + optional/nullable`
- `build(native,wasm): tune compiler flags for speed`
- `docs(ADR): add ADR 0009 native build flags`

Prefer small, focused commits; include rationale when changing hot code.

## Release

- On GitHub release (published), CI builds the package and publishes to npm using `NPM_TOKEN`.
- Local: `npm version <patch|minor|major>` followed by pushing tags triggers the release workflow.

## Safety checklist for agents

- Do not introduce allocations inside tight loops unnecessarily.
- Preserve existing fast‑path branching conditions and heuristics.
- Keep TS public API stable; any breaking changes must be documented in README and CHANGELOG.
- Run `scripts/build.sh` before opening a PR and sanity‑check real‑world benchmarks.

