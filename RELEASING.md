# Releasing dhi

## Version Independence

The three packages version independently:

| Package | Version source | Registry |
|---------|---------------|----------|
| **JS** (npm) | `js-bindings/package.json` | [npmjs.com/package/dhi](https://www.npmjs.com/package/dhi) |
| **Python** (PyPI) | `python-bindings/pyproject.toml` + `dhi/__init__.py` | [pypi.org/project/dhi](https://pypi.org/project/dhi/) |
| **Zig** | `build.zig` | Source only |

This is intentional — a Python-only bugfix shouldn't bump the JS version.

## Release Steps

### npm (TypeScript)

1. Update version in `js-bindings/package.json`
2. Commit: `git commit -m "release: dhi-js vX.Y.Z"`
3. Tag and push: `git tag vX.Y.Z && git push && git push --tags`
4. CI runs `.github/workflows/publish-npm.yml` → builds N-API addon → runs tests → publishes to npm → creates GitHub Release

### PyPI (Python)

1. Update version in `python-bindings/pyproject.toml` and `python-bindings/dhi/__init__.py`
2. Commit: `git commit -m "release: dhi-python vX.Y.Z"`
3. Tag and push: `git tag vX.Y.Z && git push && git push --tags`
4. CI runs `.github/workflows/build-wheels.yml` → cross-compiles Zig → builds wheels (Linux x86_64/aarch64, macOS arm64) → publishes to PyPI

### Zig (source only)

Zig users consume dhi as a source dependency. Bump the version in `build.zig` when the core API changes.

## Pre-Release Checklist

- [ ] All CI checks pass on `main`
- [ ] Benchmarks look reasonable (`python benchmarks/benchmark_vs_all.py`)
- [ ] Version bumped in the correct files
- [ ] CHANGELOG or commit messages describe what changed
- [ ] Tag matches the version being published
