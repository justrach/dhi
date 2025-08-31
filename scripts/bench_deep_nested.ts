import { object, string, number } from '../src/index';
import { z } from 'zod';

function makeDeepSchema() {
  return object({ a: object({ b: object({ c: object({ d: object({ e: object({ name: string(), score: number() }) }) }) }) }) });
}

const dhiDeepSchema = makeDeepSchema();
const zodDeepSchema = z.object({ a: z.object({ b: z.object({ c: z.object({ d: z.object({ e: z.object({ name: z.string(), score: z.number() }) }) }) }) }) });

function genDeep(n: number) {
  return Array.from({ length: n }, (_, i) => ({ a: { b: { c: { d: { e: { name: `n${i}`, score: i % 100 } } } } } }));
}

function bench(fn: () => void, iters = 5) {
  const times: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    times.push(t1 - t0);
  }
  times.sort((a,b)=>a-b);
  const mean = times.reduce((a,b)=>a+b,0)/times.length;
  return { mean, times };
}

(async function main(){
  const N = Number(process.env.N || 100000);
  const data = genDeep(N);
  // warmup
  dhiDeepSchema.validateBatch(data.slice(0, 1000));
  data.slice(0, 1000).forEach(d => zodDeepSchema.safeParse(d));

  const dhi = bench(()=>{ dhiDeepSchema.validateBatch(data); }, 6);
  const zodR = bench(()=>{ data.forEach(d=>zodDeepSchema.safeParse(d)); }, 6);
  const dhiThr = N / (dhi.mean/1000);
  const zodThr = N / (zodR.mean/1000);
  console.log(JSON.stringify({ N, dhiMs: Number(dhi.mean.toFixed(2)), zodMs: Number(zodR.mean.toFixed(2)), dhiThr: Math.round(dhiThr), zodThr: Math.round(zodThr), speedup: Number((dhiThr/zodThr).toFixed(2)) }));
})();
