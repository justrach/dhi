"use client";
import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Row = {
  scenario: string;
  size: string;
  dhiMs: number;
  dhiOps: number;
  zodMs: number;
  zodOps: number;
  speedup: number;
};

const rows: Row[] = [
  {
    scenario: "Simple 4-Field (benchmark2.ts)",
    size: "1,000,000",
    dhiMs: 58.02,
    dhiOps: 17235938.549,
    zodMs: 61.8,
    zodOps: 16182176.902,
    speedup: 1.07,
  },
  {
    scenario: "Nested Object",
    size: "100,000",
    dhiMs: 9.11,
    dhiOps: 10979509.37,
    zodMs: 17.32,
    zodOps: 5773027.723,
    speedup: 1.9,
  },
  {
    scenario: "Array-Heavy",
    size: "50,000",
    dhiMs: 9.07,
    dhiOps: 5511430.978,
    zodMs: 28.97,
    zodOps: 1725761.289,
    speedup: 3.19,
  },
  {
    scenario: "Mixed Valid/Invalid",
    size: "500,000",
    dhiMs: 30.41,
    dhiOps: 16441838.23,
    zodMs: 661.28,
    zodOps: 756110.688,
    speedup: 21.75,
  },
];

export default function BenchmarksPage() {
  const [unit, setUnit] = useState<"ms" | "ops">("ms");
  // const maxMs = useMemo(() => Math.max(...rows.map((r) => r.zodMs)), []);
  // const maxOps = useMemo(() => Math.max(...rows.map((r) => r.dhiOps)), []);

  return (
    <div className="py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Benchmarks</h1>
          <p className="text-ink-2 mt-2">
            Average 6.98× (range 1.07×–21.75×). Transparent and reproducible.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm" role="group" aria-label="Toggle units">
          <button
            className={`px-3 py-1.5 rounded-md border ${unit === "ms" ? "bg-primary text-white" : "bg-white"}`}
            onClick={() => setUnit("ms")}
            aria-pressed={unit === "ms"}
          >
            ms
          </button>
          <button
            className={`px-3 py-1.5 rounded-md border ${unit === "ops" ? "bg-primary text-white" : "bg-white"}`}
            onClick={() => setUnit("ops")}
            aria-pressed={unit === "ops"}
          >
            ops/sec
          </button>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm border rounded-lg">
          <thead className="bg-[var(--bg-weak)] text-left">
            <tr>
              <th className="p-3">Scenario</th>
              <th className="p-3">Data Size</th>
              <th className="p-3">DHI</th>
              <th className="p-3">Zod</th>
              <th className="p-3">Speedup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.scenario} className="border-t">
                <td className="p-3 align-top min-w-[220px]">{r.scenario}</td>
                <td className="p-3 align-top whitespace-nowrap">{r.size}</td>
                <td className="p-3 align-top">
                  <Metric unit={unit} ms={r.dhiMs} ops={r.dhiOps} color="var(--orange)" />
                </td>
                <td className="p-3 align-top">
                  <Metric unit={unit} ms={r.zodMs} ops={r.zodOps} color="#9CA3AF" />
                </td>
                <td className="p-3 align-top">{r.speedup.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6" aria-live="polite">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Scenarios</h2>
            <span className="text-sm text-ink-2/80">DHI = orange, Zod = gray</span>
          </div>
          <div className="mt-3 h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ left: 10, right: 10 }}>
                <XAxis dataKey="scenario" tick={{ fontSize: 12 }} interval={0} angle={-12} height={60} textAnchor="end" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => unit === "ms" ? `${v}ms` : `${shortOps(v)}`} />
                <Tooltip formatter={(val: unknown) => {
                  const n = typeof val === "number" ? val : Number(val);
                  return unit === "ms" ? `${n.toFixed(2)} ms` : `${n.toLocaleString()} ops/s`;
                }} />
                <Legend />
                {unit === "ms" ? (
                  <>
                    <Bar dataKey="dhiMs" name="DHI (ms)" fill="var(--orange)" radius={[4,4,0,0]} />
                    <Bar dataKey="zodMs" name="Zod (ms)" fill="#9CA3AF" radius={[4,4,0,0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="dhiOps" name="DHI (ops/sec)" fill="var(--orange)" radius={[4,4,0,0]} />
                    <Bar dataKey="zodOps" name="Zod (ops/sec)" fill="#9CA3AF" radius={[4,4,0,0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="mt-10 rounded-xl border p-5">
        <h2 className="font-medium">Methodology</h2>
        <ul className="mt-2 text-sm text-ink-2 list-disc pl-5 space-y-1">
          <li>Environment: Node 20+, macOS/Windows/Linux; CPU noted in CSV.</li>
          <li>Flags: default optimization; libraries pinned; warmup before sampling.</li>
          <li>Metric: ops/sec and wall-clock ms; report mean ± stdev.</li>
          <li>Runs: multiple iterations; discard outliers; fixed dataset sizes.</li>
        </ul>
        <div className="mt-4 flex gap-3 text-sm">
          <a className="underline" href="/benchmarks.csv" download>
            Download raw CSV
          </a>
          <a className="underline" href="https://github.com/" target="_blank" rel="noreferrer">
            Open benchmark repo
          </a>
          <Link className="underline" href="/docs/benchmarks">Reproduce locally</Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ unit, ms, ops, color }: { unit: "ms" | "ops"; ms: number; ops: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="tabular-nums" style={{ color }}>
        {unit === "ms" ? `${ms.toFixed(2)}ms` : `${formatOps(ops)} ops/sec`}
      </span>
      <span className="text-ink-2/70">± stdev</span>
    </div>
  );
}

function shortOps(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function formatOps(n: number) {
  // Human-friendly formatting for ops/sec in table cells
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return Math.round(n).toString();
}
