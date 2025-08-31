import type { Metadata } from "next";
import { BenchmarksClient } from "./BenchmarksClient";

export const metadata: Metadata = {
  title: "Benchmarks · DHI",
  description: "Transparent, reproducible benchmarks comparing DHI vs Zod across common scenarios (simple, nested, array-heavy, and mixed invalids).",
  openGraph: {
    title: "DHI Benchmarks",
    description: "Transparent, reproducible benchmarks comparing DHI vs Zod across common scenarios.",
    type: "article",
    url: "/benchmarks",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI Benchmarks",
    description: "Transparent, reproducible benchmarks comparing DHI vs Zod.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "benchmark", "TypeScript validation", "Zod", "performance", "schema"],
};

export default function BenchmarksPage() {
  return <BenchmarksClient />;
}
