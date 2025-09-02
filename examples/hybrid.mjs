// Hybrid validation demo (ESM, uses built dist/esm)
// Run with:
//   npm run build && npm run example:hybrid:dist

import { object, string, number, boolean as bool, array } from '../dist/esm/typed.js';
import { dhi } from '../dist/esm/core.js';

function makeData(n) {
  const valid = Array.from({ length: n }, (_, i) => ({
    name: `User ${i}`,
    age: (i % 80) + 1,
    active: (i % 2) === 0,
    tags: ['a', 'b', 'c']
  }));
  const invalid = Array.from({ length: n }, (_, i) => ({
    name: i,
    age: 'NaN',
    active: 'yes',
    tags: i % 3 === 0 ? ['a', 1] : 'nope'
  }));
  return { valid, invalid };
}

function bench(label, fn) {
  fn();
  console.time(label);
  fn();
  console.timeEnd(label);
}

function sumBools(arr) { return arr.reduce((a, b) => a + (b ? 1 : 0), 0); }

async function main() {
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
  const WasmUser = await dhi.object({ name: s, age: n, active: b, tags: arrS });

  function validateBatchAuto(data, threshold = 0.3) {
    const sampleN = Math.min(200, data.length);
    let invalid = 0;
    for (let i = 0; i < sampleN; i++) {
      if (!TypedUser.validateBatch([data[i]])[0]) invalid++;
    }
    const rate = sampleN ? invalid / sampleN : 0;
    if (rate > threshold) {
      return WasmUser.validate_batch(data).map((r) => !!r.success);
    }
    return TypedUser.validateBatch(data);
  }

  const { valid, invalid } = makeData(30000);

  bench('[Typed] valid', () => { TypedUser.validateBatch(valid); });
  bench('[Typed] invalid', () => { TypedUser.validateBatch(invalid); });
  bench('[WASM] valid', () => { WasmUser.validate_batch(valid); });
  bench('[WASM] invalid', () => { WasmUser.validate_batch(invalid); });

  console.time('[Hybrid] valid');
  const hv = validateBatchAuto(valid);
  console.timeEnd('[Hybrid] valid');
  console.time('[Hybrid] invalid');
  const hi = validateBatchAuto(invalid);
  console.timeEnd('[Hybrid] invalid');

  const tv = TypedUser.validateBatch(valid);
  const ti = TypedUser.validateBatch(invalid);
  const wv = WasmUser.validate_batch(valid);
  const wi = WasmUser.validate_batch(invalid);

  console.log('valid counts:',
    'typed:', sumBools(tv),
    'wasm:', wv.filter(r => r.success).length,
    'hybrid:', sumBools(hv));
  console.log('invalid counts:',
    'typed:', sumBools(ti),
    'wasm:', wi.filter(r => r.success).length,
    'hybrid:', sumBools(hi));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

