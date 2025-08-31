#!/usr/bin/env bun
/**
 * Quick benchmark: DHI (typed API) vs Zod with optional invalid dataset ratio.
 * Usage:
 *   bun run benchmarks/quick_invalid_bench.ts --size 50000 --invalid 0.2 --runs 5
 */
import { performance } from 'node:perf_hooks';
import { z } from 'zod';

// Resolve DHI from installed package if available; fallback to local build output
const DHI: any = await (async () => {
  try {
    return await import('dhi');
  } catch {
    try {
      return await import('../dist/esm/index.js');
    } catch {
      return await import('../dist/index.js');
    }
  }
})();

type Args = { size: number; invalid: number; runs: number };

function parseArgs(argv: string[]): Args {
  const out: Args = { size: 50000, invalid: 0.2, runs: 52 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--size' && next) { out.size = parseInt(next, 10); i++; }
    else if (a === '--invalid' && next) { out.invalid = parseFloat(next); i++; }
    else if (a === '--runs' && next) { out.runs = parseInt(next, 10); i++; }
  }
  return out;
}

type Item = { id: number | string; name: string | number; active: boolean | string };

function makeSample(n: number, invalidRatio: number): Item[] {
  const items: Item[] = new Array(n);
  const invalidEvery = invalidRatio > 0 ? Math.max(2, Math.round(1 / invalidRatio)) : 0;
  for (let i = 0; i < n; i++) {
    const isInvalid = invalidEvery !== 0 && i % invalidEvery === 0;
    items[i] = isInvalid
      ? { id: String(i), name: i, active: 'yes' }
      : { id: i, name: `user-${i}`, active: (i & 1) === 0 };
  }
  return items;
}

function median(ns: number[]) {
  const a = [...ns].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

async function main() {
  const { size, invalid, runs } = parseArgs(process.argv.slice(2));
  const items = makeSample(size, invalid);

  const DhiUser = DHI.object({ id: DHI.number(), name: DHI.string(), active: DHI.boolean() });
  const ZodUser = z.object({ id: z.number(), name: z.string(), active: z.boolean() });

  // Warm-up
  DhiUser.validateBatch(items);
  const fv = items.find((v) => typeof v.id === 'number' && typeof v.name === 'string' && typeof v.active === 'boolean') ?? items[0];
  try { ZodUser.parse(fv as any); } catch {}

  const dhiTimes: number[] = [];
  const zodTimes: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = DhiUser.validateBatch(items);
    void res;
    const t1 = performance.now();
    dhiTimes.push(t1 - t0);

    const z0 = performance.now();
    for (let j = 0; j < items.length; j++) { try { ZodUser.parse(items[j]); } catch {} }
    const z1 = performance.now();
    zodTimes.push(z1 - z0);
  }

  const out = {
    size,
    invalid,
    runs,
    dhi: { ms: median(dhiTimes) },
    zod: { ms: median(zodTimes) },
    speedup: median(zodTimes) / median(dhiTimes)
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
