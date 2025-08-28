# ADR 0003: WASM Initialization and Distribution

- Status: Accepted
- Date: 2025-08-28

## Context
DHI ships a Rust core compiled to WebAssembly and also includes a native `.node` for Node runtimes. The glue code in `src/wasm.ts` dynamically imports the ES module wrapper (wasm-pack output) and initializes the core across Node and browser.

## Decision
- Use dynamic ESM import at runtime to avoid CJS/ESM interop pitfalls.
- In Node, locate `dhi_core.js` and `dhi_core_bg.wasm` via multiple candidate paths; prefer initializing from compiled `WebAssembly.Module` for robustness.
- In browsers, perform a relative import of `./dhi_core.js` with a `../dist` fallback in dev.
- Expose `ensureWasmInitialized()`, `isWasmReady()`, `getWasmModule()` and `getWasmModuleSync()`.

## Distribution Strategy
- Publish `dist/` with `dhi_core.js`, `dhi_core_bg.wasm`, `core.js`, `typed.js`, `zod-compat.js` and type definitions.
- Keep `sideEffects` minimal; avoid referencing non-existent paths (e.g., `./snippets/*`).
- Build script `scripts/build.sh` produces both WASM and native artifacts and copies them into `dist/`.

## Alternatives Considered
- Bundling WASM as data URI (hurts DX and caching).
- Forcing `file://` fetch on Node (incompatible with Node fetch; less reliable than module bytes init).

## Consequences
- Reliable initialization in Node and browser with improved error handling and fallbacks.
- Slightly larger init logic to cover diverse environments.

## References
- Code: `src/wasm.ts`
- Build: `scripts/build.sh`
- Artifacts: `dist/`
