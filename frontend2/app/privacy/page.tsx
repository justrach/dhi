export default function PrivacyPage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Privacy</h1>
      <p className="mt-2 text-ink-2">We collect anonymous usage analytics only; see configuration in the repository.</p>
    </div>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · DHI",
  description: "DHI privacy policy: minimal analytics, no personal data collection by default.",
  openGraph: {
    title: "DHI Privacy",
    description: "Minimal analytics, no personal data by default.",
    type: "article",
    url: "/privacy",
    siteName: "DHI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI Privacy",
    description: "Minimal analytics, no personal data by default.",
    images: ["/og.png"],
  },
  keywords: ["DHI", "privacy", "policy", "analytics"],
};
