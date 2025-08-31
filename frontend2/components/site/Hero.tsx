"use client";
import { useEffect, useMemo, useState } from "react";

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
  intervalMs = 2400,
}: HeroProps) {
  const [i, setI] = useState(0);
  const current = useMemo(() => variants[i % variants.length], [i, variants]);

  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink transition-opacity duration-300">
      {current}
    </h1>
  );
}

