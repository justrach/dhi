# DHI Repository Summary

This document provides a concise, file-by-file overview of the repository. Generated to help new contributors quickly understand structure and purpose.

Notes
- Excludes generated/vendor folders: `node_modules/`, `dist/`, and large datasets under `benchmarks/data/` (ignored).
- Paths are relative to repo root.

## Top-Level Files
- .DS_Store: macOS filesystem metadata (not functionally relevant).
- .gitignore: Ignore rules (targets, node_modules, dist, benchmarks/data).
- LICENSE: Project license (Apache 2.0).
- MIGRATION.md: Guidance for migrating between DHI API versions.
- README.md: Main project documentation, quickstart, features, performance notes.
- TODO.md: Roadmap and task list.
- bun.lockb: Bun package lockfile for reproducible installs.
- example.ts: Minimal TypeScript example using DHI APIs.
- jest.config.ts: Jest configuration for tests.
- llm.md: Notes related to LLM/dev context.
- package.json: Package metadata, scripts, dependencies.
- tsconfig.json: TypeScript compiler configuration.

## assets/
- assets/benchmark-execution-time.png: Benchmark chart (execution time).
- assets/benchmark-validations-per-second.png: Benchmark chart (throughput).
- assets/dhi_logo.jpg: Project logo used in README/website.

## benchmarks/
- benchmarks/benchmark.ts: Baseline benchmark script for core validation.
- benchmarks/benchmark2.ts: Extended benchmark scenario with different dataset mix.
- benchmarks/benchmark3.ts: Additional scenario focusing on varying fields.
- benchmarks/benchmark4.ts: Scenario targeting nested object validation.
- benchmarks/benchmark5.ts: Scenario exploring edge cases and scale.
- benchmarks/benchmark_any.ts: Benchmarks for `any`/generic validations.
- benchmarks/benchmark_optimized.ts: Optimized benchmark harness variants.
- benchmarks/comprehensive.ts: Comprehensive suite combining multiple schema types.
- benchmarks/k6.d.ts: Type definitions for k6 benchmarking integration.
- benchmarks/k6.ts: k6 load-testing/benchmark script.
- benchmarks/parallel_nested.ts: Benchmarks for parallelized nested validations.
- benchmarks/parallel_nested_worker.mjs: Worker script powering parallel benchmarks.
- benchmarks/realworld.ts: Real-world shaped datasets benchmark.
- benchmarks/typed-api.ts: Benchmarks for the TypeScript-first API.
- benchmarks/zod4_comparison.ts: Direct comparisons against Zod v4.
- benchmarks/data/ (ignored): Large JSON datasets used by benchmarks.

## docs/
- docs/.DS_Store: macOS metadata.
- docs/adr/0001-zod-compatibility-layer.md: ADR discussing Zod compatibility layer strategy.
- docs/adr/0002-native-typed-api.md: ADR for native TypeScript-first API design.
- docs/adr/0002-simd-batch-validation-optimizations.md: ADR on SIMD-style batch optimizations.
- docs/adr/0003-wasm-init-and-distribution.md: ADR on WASM initialization and packaging.
- docs/adr/0004-benchmarking-methodology.md: ADR defining benchmarking methodology.
- docs/adr/0005-migration-and-deprecation.md: ADR covering migration and deprecation policies.
- docs/adr/0006-validation-core-and-type-encoding.md: ADR on validation core and type representation.

## examples/
- examples/advanced.ts: Advanced usage patterns and schemas.
- examples/basic.ts: Basic usage example.
- examples/example.ts: Additional sample demonstrating common flows.

## frontend/ (Next.js demo app)
- frontend/.gitignore: Frontend-specific ignore rules.
- frontend/README.md: Frontend app usage and dev notes.
- frontend/bun.lockb: Lockfile for frontend workspace.
- frontend/components.json: UI component config (e.g., shadcn setup).
- frontend/eslint.config.mjs: ESLint configuration.
- frontend/next.config.mjs: Next.js config (MJS form).
- frontend/next.config.ts: Next.js config (TS form).
- frontend/package.json: Frontend package manifest and scripts.
- frontend/postcss.config.mjs: PostCSS configuration.
- frontend/public/*.svg: Public assets and icons.
- frontend/src/app/components/HeroSection.tsx: Landing hero with CTA and performance highlights.
- frontend/src/app/components/ValidationForm.tsx: Interactive form to run DHI vs Zod validations and time them.
- frontend/src/app/components/ValidationResults.tsx: Displays validation timing results and statuses.
- frontend/src/app/favicon.ico: Site favicon.
- frontend/src/app/globals.css: Global styles (Tailwind setup).
- frontend/src/app/haiku/actions.ts: Server actions for the Haiku demo.
- frontend/src/app/haiku/page.tsx: Haiku demo page.
- frontend/src/app/layout.tsx: Root layout component for the app.
- frontend/src/app/page.tsx: Home page combining hero, features, and demo.
- frontend/src/components/ui/*.tsx: Reusable UI primitives (accordion, button, card, dialog, input, tabs, textarea).
- frontend/src/lib/utils.ts: UI helper utilities (class merging, etc.).
- frontend/tailwind.config.ts: Tailwind config.
- frontend/tsconfig.json: TypeScript config for the frontend app.

## migrations/
- migrations/README.md: Guide and narrative for migration examples.
- migrations/01-simple-user/before.ts: Pre-migration simple user schema/example.
- migrations/01-simple-user/after.ts: Post-migration updated user schema.
- migrations/02-nested-objects/before.ts: Pre-migration nested schema example.
- migrations/02-nested-objects/after.ts: Post-migration nested schema using DHI.
- migrations/03-api-validation/before.ts: Pre-migration API validation approach.
- migrations/03-api-validation/after.ts: Post-migration API validation with DHI.
- migrations/04-form-validation/before.ts: Pre-migration form validation sample.
- migrations/04-form-validation/after-simple.ts: Simple post-migration form validation.
- migrations/04-form-validation/after.ts: Full post-migration form validation.
- migrations/benchmark-comparison.ts: Script to compare migration performance.
- migrations/bun.lock: Lockfile for migrations workspace.
- migrations/package.json: Package metadata for migrations examples.

## rust/ (WASM core)
- rust/Cargo.toml: Rust crate manifest (wasm32 target, deps, features).
- rust/Cargo.lock: Locked dependency versions.
- rust/src/lib.rs: Core Rust implementation of `DhiCore` with validation engine, fast paths (SIMD-style batch), flattened path cache, and WASM bindings.

## scripts/
- scripts/build.sh: Build script to compile Rust to WASM and package JS glue.

## src/ (TypeScript core)
- src/index.ts: Public entry-point; exports legacy WASM API and the recommended TypeScript-first API, plus temporary Zod compatibility exports.
- src/core.ts: Legacy WASM-centric `DhiType` API wrapper; initialization, schema building, and validation/batch methods.
- src/dhi_core.d.ts: Type declarations for the WASM glue module `dhi_core.js`.
- src/typed.ts: TypeScript-first schema system with compile-time types, fast batch validators, nested-object optimizations, and analysis utilities.
- src/wasm.ts: Cross-runtime WASM loader/initializer (Node and browser), handling multiple init strategies.
- src/zod-compat.ts: Temporary Zod compatibility layer (subset of Zod-like API for migration).

## tests/
- tests/basic.test.ts: Basic unit tests exercising core validation flows.

---

If you want deeper drill-downs (e.g., function-by-function summaries for `src/typed.ts` or `rust/src/lib.rs`) or auto-generated API docs, I can expand this document or generate a separate API reference.

