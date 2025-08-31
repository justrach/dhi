export default function ChangelogPage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Changelog</h1>
      <p className="mt-2 text-ink-2">Releases and notes will appear here.</p>
    </div>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog · DHI",
  description: "Track DHI releases, features, and fixes across versions.",
  openGraph: {
    title: "DHI Changelog",
    description: "Releases, features, and fixes across versions.",
    type: "article",
    url: "/changelog",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI Changelog",
    description: "Releases, features, and fixes.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "changelog", "releases", "TypeScript"],
};
