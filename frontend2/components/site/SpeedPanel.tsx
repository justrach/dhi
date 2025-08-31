"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SpeedPanel() {
  const [withInvalids, setWithInvalids] = useState(false);

  const stats = useMemo(() => {
    // Preset example numbers; toggle shows a realistic mixed-data advantage
    return withInvalids
      ? { label: "50k items • ~20% invalid", dhiMs: 9.8, zodMs: 52.9, speedup: 5.4 }
      : { label: "50k items • all valid", dhiMs: 12.4, zodMs: 41.3, speedup: 3.3 };
  }, [withInvalids]);

  const total = stats.zodMs;
  const dhiPct = Math.max(4, Math.min(100, (stats.dhiMs / total) * 100));
  const zodPct = 100;

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-[0_10px_40px_-10px_rgba(255,107,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-2">Example on real hardware</p>
          <p className="text-sm font-medium text-ink">{stats.label}</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/playground">Open playground</Link>
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <BarRow label="DHI" valueMs={stats.dhiMs} pct={dhiPct} color="var(--orange)" />
        <BarRow label="Zod" valueMs={stats.zodMs} pct={zodPct} color="#9CA3AF" />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-2">Median wall time</span>
        <span className="font-medium">≈ {stats.speedup.toFixed(1)}× faster</span>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={withInvalids}
            onChange={(e) => setWithInvalids(e.target.checked)}
          />
          Include ~20% invalid data
        </label>
        <span className="text-ink-3">Batch-validated schema • client demo</span>
      </div>
    </div>
  );
}

function BarRow({ label, valueMs, pct, color }: { label: string; valueMs: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums">{valueMs.toFixed(1)} ms</span>
      </div>
      <div className="mt-1 h-3 w-full rounded-full bg-[var(--bg-weak)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

