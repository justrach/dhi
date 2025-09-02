// Compare DHI typed-first API vs legacy WASM-backed API
// Run with:
//   npm run benchmark:node
// or directly:
//   node --experimental-modules --no-warnings --loader ts-node/esm benchmarks/typed_vs_wasm.ts

import { object, string, number, boolean, array } from '../src';
import { dhi } from '../src';

type User = { name: string; age: number; active: boolean; tags: string[] };

async function buildSchemas() {
  const TypedUser = object({
    name: string(),
    age: number(),
    active: boolean(),
    tags: array(string())
  });

  const str = await dhi.string();
  const num = await dhi.number();
  const bool = await dhi.boolean();
  const arrStr = await dhi.array(await dhi.string());
  const WasmUser = await dhi.object<User>({
    name: str,
    age: num,
    active: bool,
    tags: arrStr
  });

  return { TypedUser, WasmUser };
}

function makeData(n: number) {
  const valid: User[] = new Array(n).fill(0).map((_, i) => ({
    name: `User ${i}`,
    age: (i % 80) + 1,
    active: (i % 2) === 0,
    tags: ['a', 'b', 'c']
  }));
  const invalid: any[] = new Array(n).fill(0).map((_, i) => ({
    name: i, // wrong type
    age: 'NaN', // wrong type
    active: 'yes', // wrong type
    tags: i % 3 === 0 ? ['a', 1] : 'nope' // sometimes mixed array, sometimes not array
  }));
  return { valid, invalid };
}

function bench(label: string, fn: () => void) {
  // Warmup
  fn();
  console.time(label);
  fn();
  console.timeEnd(label);
}

async function main() {
  const { TypedUser, WasmUser } = await buildSchemas();
  const { valid, invalid } = makeData(50000);

  // Typed API
  bench('Typed.valid.validateBatch', () => {
    const r = TypedUser.validateBatch(valid);
    if (r.length !== valid.length) throw new Error('sanity');
  });

  bench('Typed.invalid.validateBatch', () => {
    const r = TypedUser.validateBatch(invalid);
    if (r.length !== invalid.length) throw new Error('sanity');
  });

  // WASM API (legacy)
  bench('WASM.valid.validate_batch', () => {
    const r = WasmUser.validate_batch(valid);
    if (r.length !== valid.length) throw new Error('sanity');
  });

  bench('WASM.invalid.validate_batch', () => {
    const r = WasmUser.validate_batch(invalid);
    if (r.length !== invalid.length) throw new Error('sanity');
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

