export default function ComparePage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Compare with Zod</h1>
      <p className="mt-2 text-ink-2">
        Zod is excellent. DHI optimizes for throughput & invalid-path performance.
      </p>
      <div className="mt-6 rounded-xl border p-5">
        <h2 className="font-medium">API overlap & migration</h2>
        <p className="text-sm text-ink-2 mt-2">Common patterns mapped; gaps noted honestly.</p>
      </div>
    </div>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare DHI vs Zod · DHI",
  description: "API overlap, migration tips, and tradeoffs: see how DHI's typed API compares to Zod and how to switch smoothly.",
  openGraph: {
    title: "Compare DHI vs Zod",
    description: "API overlap and migration guidance from Zod to DHI.",
    type: "article",
    url: "/compare",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Compare DHI vs Zod",
    description: "API overlap and migration guidance.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "Zod", "migration", "schema", "TypeScript validation"],
};
