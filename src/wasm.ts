// We dynamically import the wasm-pack glue to avoid CJS/ESM interop issues.
// Type definitions are provided via a local .d.ts declaration.
declare const __dirname: string;
declare const process: any;
let wasmModule: any | null = null;
let initPromise: Promise<void> | null = null;
let ready = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isNode(): boolean {
  // Detect classic Node.js runtime
  return typeof process !== 'undefined' && !!(process as any).versions && !!(process as any).versions.node;
}

export function isWasmReady(): boolean {
  return ready;
}

export async function ensureWasmInitialized(): Promise<void> {
  if (ready) return;
  if (!initPromise) {
    initPromise = (async () => {
      // Use runtime dynamic import to avoid TS downleveling to require in CJS
      const dynamicImport = new Function('p', 'return import(p)');
      let mod: any;

      if (isNode()) {
        const path: any = await (dynamicImport as any)('node:path');
        const fs: any = await (dynamicImport as any)('node:fs');
        const url: any = await (dynamicImport as any)('node:url');

        // Base directory when running tests from project root
        const baseDir = (typeof process !== 'undefined' && process.cwd) ? process.cwd() : '.';

        // Resolve ESM glue path across source/dev and built/package contexts
        const candidatesJs = [
          path.resolve(baseDir, 'src/dhi_core.js'),
          path.resolve(baseDir, 'dist/dhi_core.js'),
          path.resolve(baseDir, 'rust/pkg/dhi_core.js'),
        ];
        let gluePath = candidatesJs.find((p: string) => fs.existsSync(p));
        if (!gluePath) gluePath = candidatesJs[0];

        const glueUrl = url.pathToFileURL(gluePath).href;
        mod = await (dynamicImport as any)(glueUrl);

        // Initialize with bytes to avoid URL/fetch issues
        const candidatesWasm = [
          path.resolve(path.dirname(gluePath), 'dhi_core_bg.wasm'),
          path.resolve(baseDir, 'src/dhi_core_bg.wasm'),
          path.resolve(baseDir, 'dist/dhi_core_bg.wasm'),
          path.resolve(baseDir, 'rust/pkg/dhi_core_bg.wasm'),
        ];
        const wasmPath = candidatesWasm.find((p: string) => fs.existsSync(p)) || candidatesWasm[0];
        const bytes = fs.readFileSync(wasmPath);

        const init = mod.default || mod.init || (mod as any).__wbg_init;
        if (!init) throw new Error('Failed to load DHI WASM init');

        // Prefer compiled WebAssembly.Module, then other forms as fallback
        const bytesU8: Uint8Array = bytes instanceof Uint8Array ? (bytes as Uint8Array) : new Uint8Array(bytes);
        // Create a clean ArrayBuffer view over just the WASM bytes slice. This avoids TS typing issues
        // (BufferSource expects ArrayBuffer) and any potential SharedArrayBuffer incompat.
        const wasmAb: ArrayBuffer = (bytesU8.buffer instanceof ArrayBuffer)
          ? bytesU8.buffer.slice(bytesU8.byteOffset, bytesU8.byteOffset + bytesU8.byteLength)
          : new Uint8Array(bytesU8).buffer;
        const wasmUrl = url.pathToFileURL(wasmPath).href;
        let inited = false;
        try {
          const compiled = await WebAssembly.compile(wasmAb);
          if (typeof (mod as any).initSync === 'function') {
            // Prefer the modern object form to avoid deprecation warnings
            try {
              (mod as any).initSync({ module_or_path: compiled });
            } catch (_eInitSyncObj) {
              // Fallback to legacy positional arg if needed
              (mod as any).initSync(compiled);
            }
            inited = true;
          } else {
            try {
              await init({ module_or_path: compiled } as any);
              inited = true;
            } catch (_eObjModule) {
              await init(compiled as any);
              inited = true;
            }
          }
        } catch (_eCompile) {
          // Fallback attempts if compilation path fails
          try {
            // Try Node fetchable URL first (Node fetch does not support file://, but leave as best-effort)
            await init(wasmUrl as any);
            inited = true;
          } catch (_e1) {
            try {
              // Try raw bytes (ArrayBuffer)
              await init(wasmAb);
              inited = true;
            } catch (_e2) {
              try {
                // Try new object-form with URL and bytes
                await init({ module_or_path: wasmUrl } as any);
                inited = true;
              } catch (_e3) {
                try {
                  await init({ module_or_path: wasmAb } as any);
                  inited = true;
                } catch (e) {
                  throw new Error(`Failed to initialize DHI WASM (tried compiled module, URL, bytes, object URL, object bytes): ${String(e)}`);
                }
              }
            }
          }
        }
      } else {
        // Browser/Edge runtimes: import relative to compiled module
        try {
          mod = await (dynamicImport as any)('./dhi_core.js');
        } catch (_e) {
          // Fallback for dev/source
          mod = await (dynamicImport as any)('../dist/dhi_core.js');
        }
        wasmModule = mod;
        const init = mod.default || mod.init || (mod as any).__wbg_init;
        if (!init) throw new Error('Failed to load DHI WASM init');
        await init();
      }

      wasmModule = mod;
      ready = true;
    })();
  }
  return initPromise;
}

export async function getWasmModule(): Promise<any> {
  await ensureWasmInitialized();
  return wasmModule;
}

export function getWasmModuleSync(): any {
  if (!wasmModule) throw new Error('DHI WASM not initialized');
  return wasmModule;
}
