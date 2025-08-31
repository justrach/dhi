# 0010 — Enable WASM Threading via wasm-bindgen-rayon for Parallel Validation

- Status: Proposed
- Date: 2025-08-29
- Owners: DHI Core

## Context

Current DHI WASM builds include feature flags for SIMD, bulk memory, and threads (atomics). Benchmarks show strong gains overall, but some scenarios are at parity where per-item work is small and highly parallelizable. WebAssembly threads with `SharedArrayBuffer` can improve throughput by processing large batches concurrently, especially on multi-core machines (Node and Bun today; browsers with cross-origin isolation).

Constraints and realities:
- `SharedArrayBuffer` requires cross-origin isolation (COOP/COEP) in browsers; Node/Bun do not require special headers.
- Thread initialization has non-trivial startup cost; wins appear for sufficiently large workloads only.
- Packaging differs by environment: worker bootstrapping for `wasm-bindgen-rayon` needs bundler or explicit worker URL/Blob.

## Decision

Adopt `wasm-bindgen-rayon` to enable a thread pool in the WASM module and add an opt-in parallel validation path for large inputs. Roll out in phases:

1) Node/Bun support (default off; opt-in `initThreads(n)`),
2) Browser support behind an explicit `enableThreads()` that no-ops unless cross-origin isolation is detected (or a worker URL is supplied),
3) Heuristic auto-switch: use parallel path when input size exceeds a tunable threshold and a thread pool is initialized.

## Alternatives Considered

- Do nothing: keep single-threaded SIMD + bulk-memory. Simpler, but leaves multi-core gains untapped.
- Manual worker sharding in JS: flexible, but extra serialization and maintenance vs. sharing linear memory in WASM.
- Portable SIMD-only: keeps good single-core performance but doesn’t scale across cores.

## Implementation Plan

- Dependencies: add `wasm-bindgen-rayon = "0.4"` to `rust/Cargo.toml`.
- Build flags: keep existing atomics/threads flags (`+atomics`) and `wasm-opt --enable-threads` (already enabled).
- Initialization API:
  - Rust (async): `#[wasm_bindgen] pub async fn init_threads(n: Option<u32>) -> Result<(), JsValue>` calling `wasm_bindgen_rayon::init_thread_pool(num).await`.
  - JS wrapper: `await initThreads(n?: number)`; store `threadPoolReady = true` on success.
- Parallel path:
  - Add `validate_parallel(values: JsValue)` that partitions work across threads. Strategy: divide input into equal chunks; avoid synchronization by writing to disjoint result slices; merge at end.
  - Fallback to single-thread path when pool not ready or input < threshold (e.g., < 20k items).
- Packaging:
  - Node/Bun: continue `wasm-pack --target web` for now; Rayon uses Node worker threads via the generated glue in these runtimes.
  - Browser: add helper to pass a worker script URL or use Blob-URL initialization. If needed, provide a `--target bundler` variant later to let bundlers resolve worker URLs automatically.

## API Surface (proposed)

- JS:
  - `async initThreads(n?: number): Promise<void>` — initialize thread pool.
  - `setParallelThreshold(count: number)` — minimum items to switch to parallel path.
  - `validateBatch(values: unknown[]): ValidationResult[]` — existing; internally chooses parallel path when enabled and beneficial.
  - `validateBatchParallel(values: unknown[]): Promise<ValidationResult[]>` — explicit parallel hook (optional).

## Performance Expectations

- CPU-bound, embarrassingly parallel workloads (independent records) should see near-linear gains up to physical cores, bounded by memory bandwidth and per-worker overhead.
- Expected improvements: 1.5–3× on 4–8 core developer machines for large batches (≥100k items), smaller or negative for tiny batches due to startup costs.

## Risks and Mitigations

- Environment support: Threads require SAB; browsers need COOP/COEP. Mitigate by feature-detecting and cleanly falling back.
- Startup cost: Thread pool init is async and non-trivial. Mitigate with explicit `initThreads()` and a size threshold.
- Ordering and determinism: Parallel chunks may complete out of order. Preserve output order by writing results into fixed slice offsets.
- Bundling/worker URL issues: Provide helper to pass a Worker URL; document bundler guidance. Optionally add a `bundler` target build later.
- Debuggability: More complex concurrency bugs. Keep the parallel path isolated and gated; add tests and telemetry counters.

## Security & Deployment

- Browser: Document required headers (COOP: `same-origin`, COEP: `require-corp`). Offer a clear error message when SAB unavailable.
- Node/Bun: No special flags typically needed on modern versions; ensure CI uses versions with WASM threads enabled.

## Testing & Validation

- Unit tests for partitioning, result merging, and fallback behavior.
- Benchmarks: extend existing suite with parallel-on vs off; report cores and thread count.
- Soak tests in CI for races/regressions on different OSes.

## Rollout Plan

1. Land API and Node/Bun implementation behind opt-in; off by default.
2. Add benchmark toggles to compare parallel vs single-thread on large datasets.
3. Add browser initialization helper and docs; gate on SAB detection.
4. Consider `--target bundler` build variant if needed for worker URL resolution.

## Open Questions

- Should we expose an environment-driven default thread count (e.g., `navigator.hardwareConcurrency` or `os.cpus().length`), or require explicit `n`?
- Where to set the default threshold for auto-parallelization? Start with 20k and tune via benchmarks.
- Do we also shard nested-object validation, or start with flat/batch-only first?

