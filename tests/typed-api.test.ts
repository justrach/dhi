import {
  object,
  string,
  number,
  boolean as bool,
  array,
  record,
  union,
  discriminatedUnion,
  optional,
  nullable,
  model,
  type ObjectSchema,
  type TypedInfer
} from '../src';

// Type-level test helpers (compile-time only)
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

describe('Typed API', () => {
  it('validates objects and infers types', () => {
    interface User { name: string; age?: number; active: boolean }
    const userSchema: ObjectSchema<User> = object({
      name: string(),
      age: optional(number()),
      active: bool()
    });

    type Inferred = TypedInfer<typeof userSchema>;
    type _assertUser = Expect<Equal<Inferred, User>>;

    // runtime success
    const ok = userSchema.validate({ name: 'Jane', active: true });
    expect(ok).toEqual({ name: 'Jane', active: true });

    // runtime failure
    expect(() => userSchema.validate({ name: 1, active: true } as any)).toThrow();

    // safeParse
    const res = userSchema.safeParse({ name: 'A', age: 42, active: false });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.age).toBe(42);
    }

    // batch
    const batch = [
      { name: 'X', active: true },
      { name: 'Y', active: false, age: 1 },
      { name: 1 as any, active: true }
    ];
    expect(userSchema.validateBatch(batch)).toEqual([true, true, false]);
  });

  it('validates arrays and records', () => {
    const tags = array(string());
    expect(() => tags.validate(['a', 'b'])).not.toThrow();
    expect(() => tags.validate([1, 2] as any)).toThrow();

    const dict = record(number());
    expect(() => dict.validate({ a: 1, b: 2 })).not.toThrow();
    expect(() => dict.validate({ a: '1' } as any)).toThrow();
  });

  it('validates unions and discriminated unions', () => {
    const U = union([string(), number()]);
    expect(U.validateBatch(['a', 1, true as any])).toEqual([true, true, false]);

    const Event = discriminatedUnion('type', {
      click: object({ type: string(), x: number(), y: number() }),
      nav: object({ type: string(), url: string() })
    });

    expect(() => Event.validate({ type: 'click', x: 1, y: 2 })).not.toThrow();
    expect(() => Event.validate({ type: 'nav', url: '/home' })).not.toThrow();
    expect(() => Event.validate({ type: 'nav', x: 1 } as any)).toThrow();
  });

  it('validates nullable and model helpers', () => {
    const S = nullable(string());
    expect(S.validateBatch(['a', null, 1 as any])).toEqual([true, true, false]);

    const UserModel = model('User', { id: number(), name: string() });
    type M = TypedInfer<typeof UserModel>;
    type _assertModel = Expect<Equal<M, { id: number; name: string }>>;

    expect(() => UserModel.validate({ id: 1, name: 'Z' })).not.toThrow();
    expect(() => UserModel.validate({ id: '1', name: 'Z' } as any)).toThrow();
  });
});

