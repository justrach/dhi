import { z } from '../schema';

let fail = 0;
function eq(a: any, b: any): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function check(label: string, schema: any, data: any) {
  const jitRes = schema.safeParse(data);
  // fresh clone of schema graph isn't trivial; instead disable JIT and re-parse
  (schema as any)._jit = null;
  (schema as any)._jitTop = null;
  const slowRes = schema.safeParse(data);
  (schema as any)._jit = undefined;
  (schema as any)._jitTop = undefined;
  const ok = jitRes.success === slowRes.success &&
    (!jitRes.success || eq(jitRes.data, slowRes.data));
  if (!ok) { fail++; console.log(`MISMATCH ${label}:`, JSON.stringify(jitRes), 'vs', JSON.stringify(slowRes)); }
  else console.log(`ok ${label} (success=${jitRes.success})`);
}

// arrays of objects: valid + invalid + transform inside
check('arr-obj valid', z.object({ items: z.array(z.object({ id: z.number() })) }), { items: [{ id: 1 }, { id: 2 }] });
check('arr-obj invalid', z.object({ items: z.array(z.object({ id: z.number() })) }), { items: [{ id: 'x' }] });
check('arr-obj strip extras', z.object({ items: z.array(z.object({ id: z.number() })) }), { items: [{ id: 1, junk: true }] });
check('arr trim transform', z.object({ tags: z.array(z.string().trim()) }), { tags: ['  a  ', 'b'] });
check('arr len min fail', z.object({ t: z.array(z.string()).min(3) }), { t: ['a'] });
check('arr len max ok', z.object({ t: z.array(z.string()).max(3) }), { t: ['a'] });
check('arr nonempty fail', z.object({ t: z.array(z.number()).nonempty() }), { t: [] });
check('arr enum', z.object({ r: z.array(z.enum(['a','b'])) }), { r: ['a','b'] });
check('arr enum bad', z.object({ r: z.array(z.enum(['a','b'])) }), { r: ['a','z'] });

// defaults
check('default applied', z.object({ n: z.string(), role: z.string().default('user') }), { n: 'x' });
check('default not applied', z.object({ n: z.string(), role: z.string().default('user') }), { n: 'x', role: 'admin' });
check('default factory', z.object({ l: z.array(z.number()).default(() => [1]) }), {});
check('default inner fail', z.object({ role: z.string().default('user') }), { role: 5 });

// dates
check('date valid', z.object({ d: z.date() }), { d: new Date(1000) });
check('date invalid', z.object({ d: z.date() }), { d: 'nope' });
check('date NaN', z.object({ d: z.date() }), { d: new Date('garbage') });
check('date min fail', z.object({ d: z.date().min(new Date(2000)) }), { d: new Date(1000) });

// unions
check('union str ok', z.object({ id: z.union([z.string(), z.number()]) }), { id: 'a' });
check('union num ok', z.object({ id: z.union([z.string(), z.number()]) }), { id: 7 });
check('union fail', z.object({ id: z.union([z.string(), z.number()]) }), { id: true });
check('union w/ transform', z.object({ id: z.union([z.string().trim(), z.number()]) }), { id: ' x ' });

// null / any / unknown / undefined
check('null field', z.object({ x: z.null() }), { x: null });
check('null fail', z.object({ x: z.null() }), { x: 1 });
check('any field', z.object({ x: z.any() }), { x: { deep: [1] } });
check('unknown field', z.object({ x: z.unknown() }), { x: undefined });

// passthrough / strict
check('passthrough keeps extras', z.object({ a: z.string() }).passthrough(), { a: 'x', b: 1, c: [2] });
check('passthrough invalid', z.object({ a: z.string() }).passthrough(), { a: 5, b: 1 });
check('strict ok', z.object({ a: z.string() }).strict(), { a: 'x' });
check('strict extra fail', z.object({ a: z.string() }).strict(), { a: 'x', b: 1 });

// strict error must include unrecognized_keys issue
const strictS = z.object({ a: z.string() }).strict();
const r = strictS.safeParse({ a: 'x', b: 1 });
if (!r.success && r.error.issues.some((i: any) => i.code === 'unrecognized_keys')) console.log('ok strict issue code');
else { fail++; console.log('MISMATCH strict issue code:', JSON.stringify(r)); }

// optional + nullable still fine
check('optional missing', z.object({ a: z.string().optional() }), {});
check('nullable null', z.object({ a: z.string().nullable() }), { a: null });

// tuples
check('tuple ok', z.object({ p: z.tuple([z.string(), z.number()]) }), { p: ['a', 1] });
check('tuple wrong len', z.object({ p: z.tuple([z.string(), z.number()]) }), { p: ['a'] });
check('tuple bad elem', z.object({ p: z.tuple([z.string(), z.number()]) }), { p: ['a', 'b'] });
check('tuple w/ rest', z.object({ p: z.tuple([z.string()]).rest(z.number()) }), { p: ['a', 1, 2] });
check('tuple rest bad', z.object({ p: z.tuple([z.string()]).rest(z.number()) }), { p: ['a', 1, 'x'] });

// records
check('record ok', z.object({ s: z.record(z.string(), z.number()) }), { s: { a: 1, b: 2 } });
check('record bad val', z.object({ s: z.record(z.string(), z.number()) }), { s: { a: 'x' } });
check('record key transform', z.object({ s: z.record(z.string().trim(), z.number()) }), { s: { ' a ': 1 } });
check('record empty', z.object({ s: z.record(z.string(), z.number()) }), { s: {} });

// discriminated unions
const du = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('a'), x: z.number() }),
  z.object({ kind: z.literal('b'), y: z.string() }),
]);
check('disc union a', z.object({ ev: du }), { ev: { kind: 'a', x: 1 } });
check('disc union b', z.object({ ev: du }), { ev: { kind: 'b', y: 's' } });
check('disc union bad kind', z.object({ ev: du }), { ev: { kind: 'z', x: 1 } });
check('disc union bad field', z.object({ ev: du }), { ev: { kind: 'a', x: 'no' } });

// top-level shapes (JIT on the schema itself)
check('top-level array', z.array(z.object({ id: z.number() })), [{ id: 1 }, { id: 2 }]);
check('top-level array bad', z.array(z.object({ id: z.number() })), [{ id: 'x' }]);
check('top-level tuple', z.tuple([z.string(), z.number()]), ['a', 1]);
check('top-level record', z.record(z.string(), z.number()), { a: 1 });
check('top-level disc union', du, { kind: 'b', y: 's' });
check('top-level array non-array', z.array(z.number()), 'nope');

// coercion (was broken: coerced subclasses matched parent JIT branches)
check('coerce number obj', z.object({ n: z.coerce.number() }), { n: '42' });
check('coerce number bad', z.object({ n: z.coerce.number() }), { n: 'abc' });
check('coerce string obj', z.object({ s: z.coerce.string() }), { s: 42 });
check('coerce boolean obj', z.object({ b: z.coerce.boolean() }), { b: 1 });
check('coerce in array', z.object({ a: z.array(z.coerce.number()) }), { a: ['1', '2'] });
check('top-level coerce array', z.array(z.coerce.number()), ['1', 2]);

// transforms / refines / pipes
check('transform field', z.object({ r: z.string().transform(x => x.length) }), { r: 'hello' });
check('transform throws', z.object({ r: z.string().transform(() => { throw new Error('x'); }) }), { r: 'a' });
check('refine field ok', z.object({ n: z.number().refine(v => v > 0) }), { n: 5 });
check('refine field fail', z.object({ n: z.number().refine(v => v > 0) }), { n: -5 });
check('refine top-level', z.object({ a: z.number() }).refine(v => v.a > 0), { a: 1 });
check('refine top-level fail', z.object({ a: z.number() }).refine(v => v.a > 0), { a: -1 });
check('superRefine field', z.object({ n: z.number().superRefine((v, ctx) => { if (v < 0) ctx.addIssue({ message: 'neg' }); }) }), { n: -1 });
check('pipe field', z.object({ n: z.string().transform(Number).pipe(z.number().min(5)) }), { n: '10' });
check('pipe field fail', z.object({ n: z.string().transform(Number).pipe(z.number().min(5)) }), { n: '1' });

// sets and maps
const setS = z.object({ ids: z.set(z.number()) });
{
  const r1 = setS.safeParse({ ids: new Set([1, 2]) }) as any;
  (setS as any)._jit = null;
  const r2 = setS.safeParse({ ids: new Set([1, 2]) }) as any;
  (setS as any)._jit = undefined;
  const ok = r1.success && r2.success && JSON.stringify([...r1.data.ids]) === JSON.stringify([...r2.data.ids]);
  if (ok) console.log('ok set field parity'); else { fail++; console.log('MISMATCH set field'); }
}
check('set field bad elem', z.object({ ids: z.set(z.number()) }), { ids: new Set(['x']) });
check('set min fail', z.object({ ids: z.set(z.number()).min(3) }), { ids: new Set([1]) });
const mapS = z.object({ m: z.map(z.string(), z.number()) });
{
  const r1 = mapS.safeParse({ m: new Map([['a', 1]]) }) as any;
  (mapS as any)._jit = null;
  const r2 = mapS.safeParse({ m: new Map([['a', 1]]) }) as any;
  (mapS as any)._jit = undefined;
  const ok = r1.success && r2.success && JSON.stringify([...r1.data.m]) === JSON.stringify([...r2.data.m]);
  if (ok) console.log('ok map field parity'); else { fail++; console.log('MISMATCH map field'); }
}
check('map bad value', z.object({ m: z.map(z.string(), z.number()) }), { m: new Map([['a', 'x']]) });

// lazy (recursive schemas)
const Node: any = z.object({ value: z.number(), children: z.array(z.lazy(() => Node)).optional() });
check('lazy recursive ok', Node, { value: 1, children: [{ value: 2, children: [{ value: 3 }] }] });
check('lazy recursive bad leaf', Node, { value: 1, children: [{ value: 'x' }] });
check('lazy recursive empty', Node, { value: 1 });

// intersection
const IxA = z.object({ a: z.string() });
const IxB = z.object({ b: z.number() });
check('intersection top ok', z.intersection(IxA, IxB), { a: 'x', b: 1 });
check('intersection top bad', z.intersection(IxA, IxB), { a: 'x', b: 'no' });
check('intersection nested', z.object({ both: z.intersection(IxA, IxB) }), { both: { a: 'x', b: 1 } });

// copy-on-transform: original array must not be mutated
const sch = z.object({ tags: z.array(z.string().trim()) });
const input = { tags: [' a '] };
const out = sch.safeParse(input) as any;
if (input.tags[0] === ' a ' && out.data.tags[0] === 'a' && out.data.tags !== input.tags) console.log('ok copy-on-transform');
else { fail++; console.log('MISMATCH copy-on-transform', JSON.stringify({ input, out: out.data })); }

// no-transform: array identity preserved
const sch2 = z.object({ nums: z.array(z.number().int()) });
const input2 = { nums: [1, 2] };
const out2 = sch2.safeParse(input2) as any;
if (out2.data.nums === input2.nums) console.log('ok identity preserved');
else { fail++; console.log('MISMATCH identity'); }

console.log(fail === 0 ? '\nALL SEMANTICS MATCH' : `\n${fail} FAILURES`);
process.exit(fail ? 1 : 0);
