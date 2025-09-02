// Hybrid validation demo: choose typed or WASM based on invalid rate
// Run with:
//   node --experimental-modules --no-warnings --loader ts-node/esm examples/hybrid.ts

import { object, string, number, boolean as bool, array } from '../src';
import { dhi } from '../src';

type User = { name: string; age: number; active: boolean; tags: string[] };

async function main() {
  // Build both schemas once
  const TypedUser = object({
    name: string(),
    age: number(),
    active: bool(),
    tags: array(string())
  });

  const s = await dhi.string();
  const n = await dhi.number();
  const b = await dhi.boolean();
  const arrS = await dhi.array(await dhi.string());
  const WasmUser = await dhi.object<User>({ name: s, age: n, active: b, tags: arrS });

  function validateBatchAuto(data: unknown[], threshold = 0.3): boolean[] {
    const sampleN = Math.min(200, data.length);
    let invalid = 0;
    for (let i = 0; i < sampleN; i++) {
      if (!TypedUser.validateBatch([data[i]])[0]) invalid++;
    }
    const rate = sampleN ? invalid / sampleN : 0;
    if (rate > threshold) {
      // Map WASM ValidationResult[] to booleans
      return WasmUser.validate_batch(data).map((r) => !!r.success);
    }
    return TypedUser.validateBatch(data);
  }

  // Generate data
  function makeData(n: number) {
    const valid: User[] = new Array(n).fill(0).map((_, i) => ({
      name: `User ${i}`,
      age: (i % 80) + 1,
      active: (i % 2) === 0,
      tags: ['a', 'b', 'c']
    }));
    const invalid: any[] = new Array(n).fill(0).map((_, i) => ({
      name: i,
      age: 'NaN',
      active: 'yes',
      tags: i % 3 === 0 ? ['a', 1] : 'nope'
    }));
    return { valid, invalid };
  }

  const { valid, invalid } = makeData(30000);

  // Baselines
  console.time('[Typed] valid');
  const tv = TypedUser.validateBatch(valid);
  console.timeEnd('[Typed] valid');
  console.time('[Typed] invalid');
  const ti = TypedUser.validateBatch(invalid);
  console.timeEnd('[Typed] invalid');

  console.time('[WASM] valid');
  const wv = WasmUser.validate_batch(valid);
  console.timeEnd('[WASM] valid');
  console.time('[WASM] invalid');
  const wi = WasmUser.validate_batch(invalid);
  console.timeEnd('[WASM] invalid');

  // Hybrid
  console.time('[Hybrid] valid');
  const hv = validateBatchAuto(valid);
  console.timeEnd('[Hybrid] valid');
  console.time('[Hybrid] invalid');
  const hi = validateBatchAuto(invalid);
  console.timeEnd('[Hybrid] invalid');

  // Sanity checks
  const sum = (arr: boolean[]) => arr.reduce((a, b) => a + (b ? 1 : 0), 0);
  console.log('valid counts:
    typed:', sum(tv),
    'wasm:', wv.filter(r => r.success).length,
    'hybrid:', sum(hv));
  console.log('invalid counts:
    typed:', sum(ti),
    'wasm:', wi.filter(r => r.success).length,
    'hybrid:', sum(hi));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

