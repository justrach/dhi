"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const commands = [
  { label: "npm", cmd: "npm i dhi" },
  { label: "pnpm", cmd: "pnpm add dhi" },
  { label: "bun", cmd: "bun add dhi" },
];

export function InstallBlock() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  return (
    <div className="rounded-xl border bg-white p-2 sm:p-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {commands.map((c, i) => (
          <div key={c.label} className="flex items-center gap-2 rounded-lg border bg-[var(--bg-weak)] px-3 py-2 grow">
            <code className="font-mono text-sm text-ink-2">{c.cmd}</code>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={async () => {
                await navigator.clipboard.writeText(c.cmd);
                setCopiedIdx(i);
                setTimeout(() => setCopiedIdx(null), 1200);
              }}
            >
              {copiedIdx === i ? "Copied" : "Copy"}
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-2/70 mt-2">Node 18+ • TypeScript 5+</p>
    </div>
  );
}

