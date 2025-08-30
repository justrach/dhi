"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CodeBlock({ code, language = "ts" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg overflow-hidden border bg-[var(--bg-weak)]">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white/60">
        <span className="text-xs uppercase tracking-wide text-ink-2/70">{language}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-4 text-[13px] leading-6 text-ink-2 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

