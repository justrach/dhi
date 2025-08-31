export default function BlogPage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Blog</h1>
      <p className="mt-2 text-ink-2">Launch post and benchmarks deep dives coming soon.</p>
    </div>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog · DHI",
  description: "Updates on DHI: releases, benchmarks, deep dives, and best practices for fast validation.",
  openGraph: {
    title: "DHI Blog",
    description: "Releases, benchmarks, and deep dives.",
    type: "website",
    url: "/blog",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI Blog",
    description: "Releases, benchmarks, and deep dives.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "blog", "benchmarks", "TypeScript", "validation"],
};
