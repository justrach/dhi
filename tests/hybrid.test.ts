import { object, string, number, boolean as bool, array, type ObjectSchema } from '../src';
import { dhi } from '../src';
import { createHybridValidator } from '../src';

type User = { name: string; age: number; active: boolean; tags: string[] };

describe('Hybrid validator', () => {
  let typedUser: ObjectSchema<User>;
  let wasmUser: any;

  beforeAll(async () => {
    typedUser = object({
      name: string(),
      age: number(),
      active: bool(),
      tags: array(string())
    });

    const s = await dhi.string();
    const n = await dhi.number();
    const b = await dhi.boolean();
    const arrS = await dhi.array(await dhi.string());
    wasmUser = await dhi.object<User>({ name: s, age: n, active: b, tags: arrS });
  });

  function makeData(n: number) {
    const valid: User[] = Array.from({ length: n }, (_, i) => ({
      name: `U${i}`,
      age: (i % 80) + 1,
      active: (i % 2) === 0,
      tags: ['a','b']
    }));
    const invalid: any[] = Array.from({ length: n }, (_, i) => ({
      name: i,
      age: 'NaN',
      active: 'yes',
      tags: i % 3 === 0 ? ['a', 1] : 'nope'
    }));
    return { valid, invalid };
  }

  it('returns identical boolean results and routes invalid-heavy to WASM', () => {
    const H = createHybridValidator(typedUser, wasmUser, { threshold: 0.3, sample: 100 });
    const { valid, invalid } = makeData(1000);
    const tv = typedUser.validateBatch(valid);
    const hv = H.validateBatch(valid);
    expect(hv).toEqual(tv);

    const ti = typedUser.validateBatch(invalid);
    const hv2 = H.validateBatch(invalid);
    expect(hv2).toEqual(ti);
  });
});
