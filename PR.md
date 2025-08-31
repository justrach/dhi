# ci(publish): Add npm publish workflow with provenance, dry-run, and WASM verifiers

## Summary

Introduce a GitHub Actions workflow to publish the package to npm on version tags with supply‑chain provenance, plus a manual dry‑run mode. The workflow builds the project (Node + Rust/wasm), runs Jest tests, verifies key artifacts and package contents, enforces tag/version alignment, and then publishes with an npm Automation token. Added fork protection to avoid runs on forks. Updated `RELEASE.md` with end‑to‑end instructions and prerequisites.

## Changes

- Add `.github/workflows/publish.yml`:
  - Triggers: tag pushes `v*.*.*` and `workflow_dispatch` (manual).
  - Fork protection: `if: github.repository == 'justrach/dhi'`.
  - Sets up Node 20, Rust stable, and `wasm-pack`.
  - Runs `npm ci`, `npm run test:jest`, and `npm run build`.
  - Verifiers:
    - Ensure `dist/index.js`, `dist/index.d.ts` exist.
    - Ensure WASM glue and binary exist: `dist/dhi_core.js`, `dist/dhi_core_bg.wasm`.
    - `npm pack --dry-run` includes all of the above.
    - Tag/version check (`package.json` version matches tag `vX.Y.Z`).
  - Dry‑run path: `workflow_dispatch` with `dry_run: true` performs build + verifiers and `npm publish --dry-run` only.
  - Real publish: on tag and not in dry‑run, uses `npm publish --access public --provenance`.
- Update `RELEASE.md`:
  - New “Publishing to npm” section with prerequisites, steps, CI verifiers, and dry‑run instructions.

## Requirements for CI to publish

- Repo secret `NPM_TOKEN`: npm Automation token with publish rights to the `dhi` package (or its scope).
- `package.json` points to built artifacts and includes them:
  - `main: dist/index.js`, `types: dist/index.d.ts`.
  - `files` includes `dist` (already present).
- Build script must output all runtime assets into `dist/` (JS, d.ts, `.wasm` glue/binary, and any native glue as applicable).
- No 2FA prompts for CI: use an npm Automation token.

## Release flow

1) Local version bump: `npm version patch|minor|major` (creates tag `vX.Y.Z`).
2) Push: `git push && git push --tags`.
3) CI builds, tests, verifies, and publishes with provenance.

Manual validation without publish:
- Actions → “Publish to npm” → keep `dry_run: true` to run build, verifiers, and `npm publish --dry-run` only.

## Test Plan

- Verify CI green on a test tag in a dry‑run: confirm artifact checks and `npm pack` entries for `dist/index.js`, `dist/index.d.ts`, `dist/dhi_core.js`, `dist/dhi_core_bg.wasm`.
- For a real tag `vX.Y.Z`, confirm publish succeeds and package installs without postinstall builds.

## Risks and Mitigations

- Missing WASM assets → Build/verifier steps fail fast; pack check ensures inclusion.
- Tag/version mismatch → Explicit guard halts publish.
- Fork runs → Fork protection prevents unintended publishes.
- 2FA issues → Use npm Automation token via `NPM_TOKEN` secret.

## Rollout

- Add `NPM_TOKEN` secret.
- Run a manual dry‑run in Actions to validate pipeline.
- Bump + push a real version tag to publish.

