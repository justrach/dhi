import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-ink-2/80">MIT License • © DHI</p>
        <nav className="flex flex-wrap gap-4 text-ink-2/80">
          <a href="https://www.npmjs.com/package/dhi" target="_blank" rel="noreferrer">npm</a>
          <Link href="/changelog">Changelog</Link>
          <a href="https://x.com" target="_blank" rel="noreferrer">Twitter/X</a>
          <Link href="/rss.xml">RSS</Link>
          <Link href="/privacy">Privacy</Link>
          <span className="opacity-60">v0.1.0</span>
        </nav>
      </div>
    </footer>
  );
}

