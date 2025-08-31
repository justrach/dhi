import type { Metadata } from "next";
import { PlaygroundClient } from "./PlaygroundClient";

export const metadata: Metadata = {
  title: "Playground · DHI",
  description: "Run in-browser micro-benchmarks comparing DHI's typed API vs Zod. Tune size, runs, and invalid ratio.",
  openGraph: {
    title: "DHI Playground",
    description: "In-browser micro-benchmarks: DHI vs Zod with adjustable dataset.",
    type: "website",
    url: "/playground",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI Playground",
    description: "Try DHI vs Zod locally in your browser.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "playground", "benchmark", "Zod", "TypeScript", "schema validation"],
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}
