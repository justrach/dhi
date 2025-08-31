"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 border-b">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-[15px] tracking-tight">
          DHI
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link className="text-ink/80 hover:text-ink" href="/">Home</Link>
          {/** Docs temporarily hidden */}
          <Link className="text-ink/80 hover:text-ink" href="/benchmarks">Benchmarks</Link>
          <Link className="text-ink/80 hover:text-ink" href="/compare">Compare</Link>
          <Link className="text-ink/80 hover:text-ink" href="/playground">Playground</Link>
          <Link className="text-ink/80 hover:text-ink" href="/blog">Blog</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
