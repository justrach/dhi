import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DHI — TypeScript validation, 7× faster on average",
  description:
    "DHI is a fast, type-safe schema validation library for TypeScript. Transparent benchmarks, simple API, reproducible results.",
  openGraph: {
    title: "DHI — TypeScript validation, 7× faster on average",
    description:
      "DHI is a fast, type-safe schema validation library for TypeScript. Transparent benchmarks, simple API, reproducible results.",
    type: "website",
    siteName: "DHI",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Nav />
        <main className="mx-auto max-w-6xl px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
