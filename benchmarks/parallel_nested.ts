import { object, string, number, boolean, array } from '../src/index';
import { Worker } from 'node:worker_threads';
import os from 'node:os';

// Deeply nested schema generator (matches realworld.ts)
function makeDeepSchema() {
  return object({
    a: object({ b: object({ c: object({ d: object({ e: object({ name: string(), score: number() }) }) }) }) })
  });
}

function genDeep(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    a: { b: { c: { d: { e: { name: `n${i}`, score: i % 100 } } } } }
  }));
}

type Msg = { id: number; data: any[] } | { done: true };

async function main() {
  const total = Number(process.env.COUNT || 200_000);
  const workers = Math.max(1, Number(process.env.WORKERS || os.cpus().length));
  const chunks = Math.ceil(total / workers);

  console.log(`Parallel nested benchmark: total=${total.toLocaleString()}, workers=${workers}, chunk=${chunks.toLocaleString()}`);

  const dataset = genDeep(total);

  const start = performance.now();
  const promises: Promise<number>[] = [];

  for (let i = 0; i < workers; i++) {
    const from = i * chunks;
    const to = Math.min(from + chunks, total);
    const slice = dataset.slice(from, to);

    promises.push(new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./parallel_nested_worker.mjs', import.meta.url), {
        type: 'module',
        workerData: { id: i, data: slice }
      });
      worker.on('message', (count: number) => resolve(count));
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker ${i} exited with code ${code}`));
      });
    }));
  }

  const counts = await Promise.all(promises);
  const end = performance.now();
  const elapsed = end - start;
  const totalValidated = counts.reduce((a, b) => a + b, 0);
  const thr = (totalValidated / (elapsed / 1000));

  console.log(`Validated ${totalValidated.toLocaleString()} in ${elapsed.toFixed(2)}ms`);
  console.log(`Throughput: ${Math.round(thr).toLocaleString()} ops/sec`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

