import { z, ZodError } from '../src';

describe('zod-compat M1 basics', () => {
  it('parses primitives and safeParse works', () => {
    const S = z.string();
    expect(S.parse('ok')).toBe('ok');
    expect(S.safeParse('ok')).toEqual({ success: true, data: 'ok' });
    const fail = S.safeParse(1);
    expect(fail.success).toBe(false);
    if (!fail.success) {
      expect(fail.error).toBeInstanceOf(ZodError);
      expect(fail.error.issues[0].code).toBe('invalid_type');
    }
  });

  it('has async parse variants', async () => {
    const N = z.number().gt(1);
    await expect(N.parseAsync(2)).resolves.toBe(2);
    const r = await N.safeParseAsync(0);
    expect(r.success).toBe(false);
  });

  it('optional and nullable wrappers', () => {
    const S = z.string().optional();
    expect(S.parse(undefined)).toBeUndefined();
    const T = z.string().nullable();
    expect(T.parse(null)).toBeNull();
  });

  it('string validators and transforms', () => {
    expect(() => z.string().min(2).parse('a')).toThrow(ZodError);
    expect(() => z.string().max(1).parse('ab')).toThrow(ZodError);
    expect(() => z.string().length(2).parse('a')).toThrow(ZodError);
    expect(() => z.string().email().parse('nope')).toThrow(ZodError);
    expect(() => z.string().url().parse('not a url')).toThrow(ZodError);
    expect(z.string().trim().parse('  x  ')).toBe('x');
    expect(z.string().toLowerCase().parse('A')).toBe('a');
  });

  it('number comparators', () => {
    expect(() => z.number().int().parse(1.5)).toThrow(ZodError);
    expect(() => z.number().gt(0).parse(0)).toThrow(ZodError);
    expect(() => z.number().gte(0).parse(-1)).toThrow(ZodError);
    expect(() => z.number().lt(0).parse(0)).toThrow(ZodError);
    expect(() => z.number().lte(0).parse(1)).toThrow(ZodError);
  });

  it('array length helpers and path propagation', () => {
    const A = z.array(z.object({ x: z.number() }));
    const r = A.safeParse([{ x: 1 }, { x: 'no' as any }]);
    expect(r.success).toBe(false);
    if (!r.success) {
      // path should include index then key
      expect(r.error.issues[0].path).toEqual([1, 'x']);
    }
    expect(() => z.array(z.string()).min(2).parse(['a'])).toThrow(ZodError);
    expect(() => z.array(z.string()).max(0).parse(['a'])).toThrow(ZodError);
    expect(() => z.array(z.string()).length(1).parse(['a', 'b'])).toThrow(ZodError);
  });

  it('object unknown key modes', () => {
    const Base = z.object({ a: z.string() });
    // default strip
    expect(Base.parse({ a: 'x', b: 1 } as any)).toEqual({ a: 'x' });
    // passthrough keeps extra
    expect(Base.passthrough().parse({ a: 'x', b: 1 } as any)).toEqual({ a: 'x', b: 1 });
    // strict rejects extra
    expect(() => Base.strict().parse({ a: 'x', b: 1 } as any)).toThrow(ZodError);
  });

  it('union and discriminatedUnion', () => {
    const U = z.union([z.string(), z.number()]);
    expect(U.parse('a')).toBe('a');
    expect(U.parse(1)).toBe(1);
    expect(U.safeParse(true as any).success).toBe(false);

    const E = z.discriminatedUnion('type', {
      a: z.object({ type: z.string(), x: z.number() }),
      b: z.object({ type: z.string(), y: z.string() })
    });
    expect(() => E.parse({ type: 'a', x: 1 })).not.toThrow();
    expect(() => E.parse({ type: 'b', y: 'yes' })).not.toThrow();
    expect(E.safeParse({ type: 'c' } as any).success).toBe(false);
  });

  it('ZodError.flatten provides fieldErrors and formErrors', () => {
    const schema = z.object({ a: z.string() }).strict();
    const res = schema.safeParse({ a: 1, b: 2 } as any);
    expect(res.success).toBe(false);
    if (!res.success) {
      const flat = res.error.flatten();
      expect(flat.fieldErrors).toBeDefined();
    }
  });
});

