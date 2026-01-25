# dhi - Claude Code Context

Ultra-fast validation library for Python and TypeScript, powered by Zig.

## Performance Summary

| Ecosystem | dhi | Incumbent | Speedup |
|-----------|-----|-----------|---------|
| **Python** | 24.9M/sec | Pydantic: 48K/sec | **520x faster** |
| **TypeScript** | 46M/sec | Zod: 0.6M/sec | **77x faster** |

## Project Structure

```
houston/
├── src/                    # Zig core validators
│   ├── validator.zig       # Main validation logic
│   ├── simd_string.zig     # SIMD-optimized string ops
│   ├── wasm_api.zig        # WASM exports for TypeScript
│   └── c_api.zig           # C exports for Python
├── python-bindings/        # Python package (PyPI: dhi)
│   ├── dhi/
│   │   ├── _native.c       # C extension (fast path)
│   │   ├── model.py        # Pydantic-compatible BaseModel
│   │   └── validator.py    # Pure Python fallback
│   └── tests/
├── js-bindings/            # TypeScript package (npm: dhi)
│   ├── schema.ts           # Zod-compatible API
│   ├── dhi.wasm            # Compiled WASM (28KB)
│   └── benchmark-vs-zod.ts # Main benchmark
└── build.zig               # Zig build configuration
```

## Quick Commands

### Python
```bash
cd python-bindings
pip install -e .                    # Install in dev mode
python -m pytest tests/ -v          # Run tests
python benchmark_vs_all.py          # Run benchmarks
```

### TypeScript
```bash
cd js-bindings
bun install                         # Install deps
bun test                            # Run tests
bun run bench                       # Run benchmark (vs Zod)
```

### Zig (rebuild native libs)
```bash
zig build -Doptimize=ReleaseFast    # Build optimized
cp zig-out/lib/libsatya.dylib python-bindings/dhi/
```

### Python C Extension (rebuild)
```bash
cd python-bindings
python setup.py build_ext --inplace
```

## Architecture

### Python Path
```
Python → _dhi_native.so (C) → libsatya.dylib (Zig) → SIMD validators
              ↓
    Pre-compiled field specs (zero per-call overhead)
```

### TypeScript Path
```
TypeScript → dhi.wasm (Zig→WASM) → SIMD validators
                 ↓
         28KB, edge-runtime compatible
```

## Key Implementation Details

### Python Performance (model.py)
- `__dhi_compiled_specs__`: Pre-compiled C structs at class definition
- `model_dump_json()`: Native C JSON serialization (no intermediate dict)
- Single FFI call validates ALL fields (not one per field)

### TypeScript Performance (schema.ts)
- SIMD WASM validators for strings, numbers, arrays
- Full Zod 4 API compatibility
- 28KB bundle, works in browsers + edge runtimes

## Testing

```bash
# Python - 97 tests
cd python-bindings && python -m pytest tests/ -v

# TypeScript - Zod compatibility
cd js-bindings && bun test-zod4-compat.ts
```

## Versions

- **Python (PyPI)**: Check `python-bindings/pyproject.toml`
- **TypeScript (npm)**: Check `js-bindings/package.json`

## Common Tasks

### Update Python version
1. Edit `python-bindings/pyproject.toml` (version field)
2. Edit `python-bindings/dhi/__init__.py` (__version__)
3. Create tag: `git tag v1.x.x && git push --tags`
4. GitHub Actions builds wheels and publishes to PyPI

### Update TypeScript version
1. Edit `js-bindings/package.json` (version field)
2. `cd js-bindings && npm publish`

### Add new validator
1. Add to `src/validator.zig`
2. Export via `src/c_api.zig` (Python) or `src/wasm_api.zig` (TypeScript)
3. Rebuild native libs
4. Add Python wrapper in `dhi/` or TypeScript in `schema.ts`
5. Add tests

## Links

- **GitHub**: https://github.com/justrach/satya-zig
- **PyPI**: https://pypi.org/project/dhi/
- **npm**: https://www.npmjs.com/package/dhi
