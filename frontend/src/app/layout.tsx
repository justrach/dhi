import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DHI - High Performance Schema Validation",
  description: "DHI (धि) is a high-performance TypeScript validation library powered by WebAssembly. Compare its performance against Zod in real-time.",
  keywords: ["TypeScript", "validation", "WebAssembly", "schema", "performance", "Zod", "DHI"],
  openGraph: {
    title: "DHI - High Performance Schema Validation",
    description: "DHI (धि) is a high-performance TypeScript validation library powered by WebAssembly",
    url: "https://dhi.trilok.ai",
    siteName: "DHI Demo",
    images: [
      {
        url: "https://dhi-demo.vercel.app/og-image.png", // You'll need to add this image
        width: 1200,
        height: 630,
        alt: "DHI Schema Validation"
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DHI - High Performance Schema Validation",
    description: "DHI (धि) is a high-performance TypeScript validation library powered by WebAssembly",
    images: ["https://dhi-demo.vercel.app/og-image.png"], // You'll need to add this image
  },
  robots: {
    index: true,
    follow: true,
  },
  authors: [{ name: "Rachid" }],
  metadataBase: new URL("https://dhi.trilok.ai"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
