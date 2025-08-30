"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const initial = [
  { label: "median", dhi: 8.2, zod: 15.9 },
  { label: "p95", dhi: 12.6, zod: 44.3 },
];

export default function PlaygroundPage() {
  const [data, setData] = useState(initial);
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Playground</h1>
      <p className="mt-2 text-ink-2">Live editor and local micro-benchmarks (WASM/worker coming).</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => setData(initial.map(d => ({ ...d, dhi: d.dhi * (0.9 + Math.random()*0.2), zod: d.zod * (0.9 + Math.random()*0.2) })))}>Run</Button>
        <Button variant="outline" onClick={() => setData(initial)}>Reset</Button>
      </div>
      <div className="mt-4 rounded-xl border p-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" />
              <YAxis unit="ms" />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ms`} />
              <Legend />
              <Bar dataKey="dhi" name="DHI (ms)" fill="var(--orange)" radius={[4,4,0,0]} />
              <Bar dataKey="zod" name="Zod (ms)" fill="#9CA3AF" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
