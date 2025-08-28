# ADR 0004: Benchmarking Methodology

- Status: Accepted
- Date: 2025-08-28

## Context
We maintain benchmarks under `benchmarks/` including `comprehensive.ts`. We compare DHI (native) vs Zod across varied shapes and data distributions to reflect realistic workloads.

## Decision
- Provide scenario-based benchmarks: simple objects, nested objects, array-heavy, and mixed valid/invalid datasets.
- Measure mean, median, p95, p99, min, max, stddev. Report throughput (validations/sec) and speedup vs Zod.
- Warm-up runs before timed iterations to minimize startup noise.
- Ensure generators produce deterministic shapes with configurable sizes.

## Execution
- Use Bun/Node runtime with `bun run benchmarks/benchmark*.ts` (see `package.json` scripts).
- Prefer batch APIs for DHI when available to measure realistic vectorized performance.

## Consequences
- Benchmark numbers are representative and reproducible, aiding regressions detection and perf marketing.

## References
- Files: `benchmarks/benchmark*.ts`, `benchmarks/comprehensive.ts`
- Library code: `src/typed.ts`, `src/core.ts`
