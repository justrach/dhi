# DHI Release Notes — Nested Fast Path & Property Access Optimizations

Date: 2025-08-29

## Highlights

- Deeply Nested Fast Path
  - Iterative path-DAG validator evaluates each object prefix once, reusing references for children.
  - Leaf grouping by type (string → number → boolean → object) improves JIT monomorphism.
  - Pre-fail strategy: skip entire subtrees when a parent is null/non-object or a required key is missing.
  - Depth cap removed: optimization applies to all supported nested-object trees.

- Fused Record Validator
  - New `record(valueSchema)` API with a fused loop that avoids `Object.values()`/`entries` allocations and `Reflect.get` in hot loops.
  - Primitive fast path uses direct `typeof` checks for maximal throughput.

- Documentation
  - ADR-0007: Deeply Nested Fast Path via Path DAG + Type-Grouped Leaves.
  - ADR-0008: Reduce Property Access Cost (V8 Hidden-Class & Shape Wins) + benchmark results.

## Performance Snapshot (Real-World Suite)

```
Analytics Events (Union)
  Size: 500,000
  DHI: 28.85ms ± 1.71ms (17,330,760 ops/s)
  Zod: 177.32ms ± 3.65ms (2,819,684 ops/s)
  Speedup: 6.15x

User Profiles (Optional-heavy)
  Size: 500,000
  DHI: 41.55ms ± 2.25ms (12,034,687 ops/s)
  Zod: 47.39ms ± 1.71ms (10,551,702 ops/s)
  Speedup: 1.14x

Deeply Nested (Depth 5)
  Size: 100,000
  DHI: 10.42ms ± 1.30ms (9,593,155 ops/s)
  Zod: 12.20ms ± 0.22ms (8,198,881 ops/s)
  Speedup: 1.17x

Orders (Compact)
  Size: 200,000
  DHI: 48.28ms ± 2.26ms (4,142,790 ops/s)
  Zod: 43.74ms ± 1.68ms (4,572,541 ops/s)
  Speedup: 0.91x

🏁 Average speedup: 2.34x
```

Notes:
- Largest gains in Analytics Events due to monomorphic shapes + fused loops.
- Deeply Nested flips to a win via prefix reuse + type grouping.
- Orders is array-heavy; further work will focus on array-of-object fusion.

## Upgrade Guide

- No breaking changes.
- New `record(valueSchema)` available via `import { record } from 'dhi'`.
- The nested fast path is automatically used for object-only nested schemas; no action needed.
- For best results, follow “Fast Mode” guidance (stable property order, avoid deletes/ad-hoc spreads, consider `seal/freeze`).

## Known Gaps (Next Milestones)

- Strict/strip/passthrough object modes and `catchall(schema)`.
- Refinements: `string().min/max/regex/email/url/uuid`, `number().min/max/int/multipleOf`.
- Tuple and array length constraints (nonempty/min/max).
- Extended Zod-compat coverage (refine/superRefine/transform/lazy/tuple/etc.).
- Array-of-object fused validator and layout stability improvements.

## References

- Code: `src/typed.ts` (nested fast path, record validator), `src/index.ts` (export updates)
- ADRs: `docs/adr/0007-deeply-nested-fast-path.md`, `docs/adr/0008-reduce-property-access-cost.md`

## Publishing to npm

- Workflow: `.github/workflows/publish.yml` builds, tests, verifies, and publishes with provenance.
- Triggers: tag pushes matching `v*.*.*` and manual runs (`workflow_dispatch`).
- Fork protection: job runs only on `justrach/dhi` (`if: github.repository == 'justrach/dhi'`).

Prerequisites (what you need to add)
- `NPM_TOKEN` secret: Create an npm “Automation” token and add it to the repo secrets as `NPM_TOKEN`.
  - Ensure the npm account owning the token has publish rights to the `dhi` package (or the scope if scoped).
- Package metadata: `package.json` should point to built files and include them in the tarball.
  - `main: dist/index.js`, `types: dist/index.d.ts`, and `files` includes `dist` (already set).
- Build artifacts: `scripts/build.sh` must produce all runtime artifacts into `dist/` (JS, d.ts, and any `.wasm`/native glue files).
- GitHub permissions: default is fine; the workflow requests `id-token: write` for npm provenance.

Release steps (tagged publish)
- Bump version: `npm version patch|minor|major` (updates `package.json` and creates a tag `vX.Y.Z`).
- Push: `git push && git push --tags`.
- CI runs: `npm ci` → `npm run test:jest` → `npm run build` → verifiers → publish to npm with `--provenance`.

CI verifiers
- Version check: ensures `package.json` version equals the tag (e.g., `v1.2.3`).
- Artifact checks: asserts `dist/index.js`, `dist/index.d.ts`, `dist/dhi_core.js`, and `dist/dhi_core_bg.wasm` exist after build.
- Pack check: runs `npm pack --dry-run` and confirms these files are in the tarball.

Manual dry-run (no publish)
- From the Actions tab, run “Publish to npm” with the default `dry_run: true`.
- CI runs the full build and verifications, plus an `npm publish --dry-run`, but does NOT publish.
- Use this to validate a release before tagging.

Manual publish via dispatch
- You can run the workflow on a tag ref and set `dry_run: false` to publish from a manual dispatch.
- Publishing still requires the ref to be a tag (`vX.Y.Z`); otherwise the publish step is skipped.

Notes
- The build uses Rust + `wasm-pack` to produce WASM and native artifacts into `dist/`.
- Installs “just work”: consumers receive prebuilt files; no postinstall build is required.
