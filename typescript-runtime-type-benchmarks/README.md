# Testing dhi against typescript-runtime-type-benchmarks

This directory contains the test case for running dhi in the comprehensive [typescript-runtime-type-benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks) suite.

## How to Run

```bash
# Clone the benchmark repo
git clone https://github.com/moltar/typescript-runtime-type-benchmarks.git
cd typescript-runtime-type-benchmarks

# Install dependencies
bun install

# Copy dhi files
cp /path/to/dhi/js-bindings/dhi.wasm cases/
cp /path/to/dhi/js-bindings/schema.ts cases/dhi-schema.ts
cp /path/to/dhi/typescript-runtime-type-benchmarks/dhi.ts cases/

# Run dhi benchmark
bun index.ts run dhi

# Compare with other libraries
bun index.ts run dhi zod valibot arktype
```

## Results

See [BENCHMARK_COMPARISON.md](../BENCHMARK_COMPARISON.md) for detailed results.

**Summary:**
- **3.28x faster than Zod** (parseSafe)
- **5.27x faster than Zod** (parseStrict)
- **5.37x faster than Zod** (assertLoose)
- **5.53x faster than Zod** (assertStrict)

**Average: 4.86x faster than Zod!** 🔥
