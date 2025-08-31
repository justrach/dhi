"use client";
import { useEffect, useState } from "react";

type HeroProps = {
  variants?: string[];
  intervalMs?: number;
};

export function Hero({
  variants = [
    "Validation at escape velocity.",
    "Type-safe. Tiny API. Big speed.",
    "Schemas that keep up with prod.",
    "Fast where it matters: hot paths.",
  ],
}: HeroProps) {
  const [idx, setIdx] = useState<number | null>(null);

  // Pick a stable variant per session (until refresh)
  useEffect(() => {
    const key = "dhi_hero_idx";
    const stored = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
    if (stored !== null) {
      setIdx(parseInt(stored, 10) || 0);
    } else {
      const i = Math.floor(Math.random() * variants.length);
      setIdx(i);
      try { window.sessionStorage.setItem(key, String(i)); } catch {}
    }
  }, [variants.length]);

  const text = idx === null ? variants[0] : variants[idx % variants.length];

  return (
    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink">
      {text}
    </h1>
  );
}
