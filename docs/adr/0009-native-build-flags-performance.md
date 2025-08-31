# ADR 0009: Native Build Flags for Higher Throughput

- Status: Accepted
- Date: 2025-08-29
- Owners: DHI Core/Runtime
- Related: ADR-0002 (Reduce property access cost), ADR-0001 (Benchmarks)

## Context

DHI ships a native Node host library (Rust) alongside the WASM package. Profiling showed the native side still incurs CPU for validation dispatch and batching. We can unlock additional perf with compiler/linker settings that better utilize local CPUs and the optimizer.

## Decision

Adopt aggressive but safe Rust/LLVM flags for the native build:

- `-C target-cpu=native`: enables ISA features on the host CPU (e.g., AVX2/SSE4.2 on x86_64, NEON on ARM64) and tunes code generation for the local micro-architecture.
- `-C opt-level=3`: enables highest general-purpose optimizations (inlining, vectorization, loop unrolling where profitable).
- `-C codegen-units=1`: forces whole-crate optimization to improve cross-module inlining and eliminate abstraction overhead in hot loops.
- `-C panic=abort`: drops unwinding tables for smaller/faster binaries and tighter hot paths.
- (Optional) `-C lto=fat`: only when build setup allows; provides whole-program optimization across crates. We intentionally keep LTO off by default in the native build to avoid known conflicts with proc-macros/build scripts unless a flag/CI job explicitly enables it.

These flags are applied in `scripts/build.sh` for the native `cargo build --release` stage. They do not affect the WASM build (which has its own tuned flags and `wasm-opt` pipeline).

## Rationale

- Host-specific codegen (`target-cpu=native`) produces better vectorization and instruction selection than generic targets.
- `opt-level=3` and `codegen-units=1` allow the optimizer to see across crate boundaries, improving inlining for hot call chains (batch validators and fast paths).
- `panic=abort` reduces runtime overhead and binary size by removing unwinder dependencies.
- LTO is powerful but can conflict with `proc-macro` crates and build scripts. We keep it opt-in to avoid destabilizing builds.

## Expected Impact

- Throughput gains: empirically 5–15% wall-clock on CPU-bound runs depending on hardware (better with wider SIMD and larger caches).
- Variability: more noticeable improvements on machines where `target-cpu=native` unlocks wider vector units or newer instruction sets.

## Implementation

- Build script (`scripts/build.sh`):
  - Native:
    - `RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C codegen-units=1 -C panic=abort"`
    - Optionally add `-C lto=fat -C embed-bitcode=yes` behind a CI flag when compatible.
  - WASM (unchanged focus here): keeps SIMD/bulk-memory and uses `wasm-opt -O3`.

## Alternatives Considered

- Always-on LTO: dismissed due to recurring build failures with `proc-macro` crates unless using nightly `-Z dylib-lto`. We keep LTO as an opt-in.
- `opt-level=z`/size-first: not appropriate for performance-critical paths.

## Risks & Mitigations

- `target-cpu=native` reduces binary portability across heterogeneous fleets when distributing prebuilt native artifacts. Our distribution model builds locally, so this is acceptable. If distributing binaries, use a conservative target and gate native builds.
- Longer compile times with `codegen-units=1` and high optimization: mitigated by retaining a separate fast dev build.

## Rollout & Verification

- Rollout: already used in `scripts/build.sh` for local builds; CI to gate optional LTO via an env var.
- Verification: compare `benchmarks/realworld.ts` native runs before/after; confirm stability across supported Node versions.

## Future Work

- Guarded LTO: enable on CI with `-Z dylib-lto` when toolchain/build scripts allow.
- Profile-guided optimization (PGO) for further gains on representative workloads.
- Separate "dev" vs "perf" build targets to keep a fast iteration loop.
