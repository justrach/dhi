"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { object, string, number, boolean as bool } from "dhi";
import { z } from "zod";

type BenchRow = { label: string; dhi: number; zod: number };

function median(ns: number[]) {
  const a = [...ns].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export default function PlaygroundPage() {
  const [count, setCount] = useState(50000);
  const [runs, setRuns] = useState(5);
  const [data, setData] = useState<BenchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [invalidRatio, setInvalidRatio] = useState(0);

  const sample = useMemo(() => makeSample(count, invalidRatio), [count, invalidRatio]);

  async function run() {
    setRunning(true);
    try {
      // Schemas (similar surface)
      const DhiUser = object({ id: number(), name: string(), active: bool() });
      const ZodUser = z.object({ id: z.number(), name: z.string(), active: z.boolean() });

      // Warm-up (avoid throwing on intentionally invalid first item)
      DhiUser.validateBatch(sample.items);
      const firstValid = sample.items.find(
        (v) => typeof v.id === 'number' && typeof v.name === 'string' && typeof v.active === 'boolean'
      ) ?? sample.items[0];
      try { ZodUser.parse(firstValid); } catch { /* ignore warm-up errors */ }

      // Timed runs
      const dhiTimes: number[] = [];
      const zodTimes: number[] = [];
      for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        const res = DhiUser.validateBatch(sample.items);
        void res; // ensure not optimized out
        const t1 = performance.now();
        dhiTimes.push(t1 - t0);

        const z0 = performance.now();
        for (let j = 0; j < sample.items.length; j++) {
          try { ZodUser.parse(sample.items[j]); } catch { /* ignore */ }
        }
        const z1 = performance.now();
        zodTimes.push(z1 - z0);
      }

      const rows: BenchRow[] = [
        { label: "median", dhi: median(dhiTimes), zod: median(zodTimes) },
      ];
      setData(rows);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Playground</h1>
      <p className="mt-2 text-ink-2">Compare DHI (typed API) vs Zod on your machine.</p>

      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Sample size
          <input
            type="number"
            className="ml-2 border rounded px-2 py-1 w-28"
            value={count}
            min={1000}
            max={200000}
            step={1000}
            onChange={(e) => setCount(parseInt(e.target.value || "0", 10))}
          />
        </label>
        <label className="text-sm">
          Invalids
          <select
            className="ml-2 border rounded px-2 py-1"
            value={invalidRatio}
            onChange={(e) => setInvalidRatio(parseFloat(e.target.value))}
          >
            <option value={0}>0%</option>
            <option value={0.1}>10%</option>
            <option value={0.2}>20%</option>
            <option value={0.3}>30%</option>
          </select>
        </label>
        <label className="text-sm">
          Runs
          <input
            type="number"
            className="ml-2 border rounded px-2 py-1 w-20"
            value={runs}
            min={1}
            max={15}
            onChange={(e) => setRuns(parseInt(e.target.value || "0", 10))}
          />
        </label>
        <Button disabled={running} onClick={run}>{running ? "Running..." : "Run"}</Button>
        <Button variant="outline" onClick={() => setData([])}>Reset</Button>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" />
              <YAxis unit="ms" />
              <Tooltip formatter={(v: unknown) => `${(typeof v === 'number' ? v : Number(v)).toFixed(2)} ms`} />
              <Legend />
              <Bar dataKey="dhi" name="DHI (ms)" fill="var(--orange)" radius={[4,4,0,0]} />
              <Bar dataKey="zod" name="Zod (ms)" fill="#9CA3AF" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-2">
        Notes: This runs in your browser tab. DHI uses a TypeScript-first API with batch validation fast paths. Zod parses each item serially. Results vary by hardware and sample.
      </p>
    </div>
  );
}

type SampleItem = { id: number | string; name: string | number; active: boolean | string };

function makeSample(n: number, invalidRatio: number) {
  const items: SampleItem[] = new Array(n);
  const invalidEvery = invalidRatio > 0 ? Math.max(2, Math.round(1 / invalidRatio)) : 0;
  for (let i = 0; i < n; i++) {
    const isInvalid = invalidEvery !== 0 && i % invalidEvery === 0;
    if (isInvalid) {
      // Corrupt one or more fields to simulate realistic invalids
      items[i] = { id: String(i), name: i, active: "yes" };
    } else {
      items[i] = { id: i, name: `user-${i}`, active: (i & 1) === 0 };
    }
  }
  return { items };
}
