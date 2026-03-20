# Contributing to dhi

## Repo Structure

```
src/              Zig core — validators, SIMD, C API, WASM API
js-bindings/      npm package (TypeScript, Zod 4 compatible)
python-bindings/  PyPI package (Python, Pydantic compatible)
docs/             Shared documentation and benchmark charts
```

The Zig core is the engine. JS and Python packages are bindings.

## Local Development

### Prerequisites

- [Zig 0.15.2](https://ziglang.org/download/)
- [Bun](https://bun.sh) (for JS)
- Python 3.9+ (for Python)

### Build & Test

```bash
# Zig core
zig build -Doptimize=ReleaseFast
zig build test

# Python bindings
cd python-bindings
pip install -e .
pytest tests/ -v

# JS bindings
cd js-bindings
bun install
bun run tests/test-zod4-compat.ts
bun run tests/test-all-features.ts
```

### Benchmarks

```bash
# Python
cd python-bindings && python benchmarks/benchmark_vs_all.py

# TypeScript
cd js-bindings && bun run benchmarks/benchmark-json.ts
```

## Branch & Merge Policy

- **Short-lived branches** off `main`
- **Squash merge only** — keep history clean
- **CI must pass** before merge (Zig + Python + JS)
- **Tags only from `main`** — releases are cut from main after merge
- No merge commits, no direct pushes to main (except emergency fixes)

## Pull Requests

- Keep PRs focused — one concern per PR
- Include a short description of what and why
- If adding a new validator: add it to Zig core, export via C API / WASM API, add bindings, add tests

## Versioning

npm, PyPI, and Zig versions are **independent** — they track binding-level changes, not just core changes. See [RELEASING.md](RELEASING.md) for details.
