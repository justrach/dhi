// CJS benchmark using dist/index.js (CommonJS)
// Run with: node benchmarks/typed_vs_wasm.cjs

const typed = require('../dist/typed.js');
const core = require('../dist/core.js');
const { object, string, number, boolean: bool, array } = typed;
const { dhi } = core;

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

(async function main() {
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

  const { valid, invalid } = makeData(50000);

  bench('Typed.valid.validateBatch', () => {
    const r = TypedUser.validateBatch(valid);
    if (r.length !== valid.length) throw new Error('sanity');
  });

  bench('Typed.invalid.validateBatch', () => {
    const r = TypedUser.validateBatch(invalid);
    if (r.length !== invalid.length) throw new Error('sanity');
  });

  bench('WASM.valid.validate_batch', () => {
    const r = WasmUser.validate_batch(valid);
    if (r.length !== valid.length) throw new Error('sanity');
  });

  bench('WASM.invalid.validate_batch', () => {
    const r = WasmUser.validate_batch(invalid);
    if (r.length !== invalid.length) throw new Error('sanity');
  });
})().catch((e) => { console.error(e); process.exitCode = 1; });
