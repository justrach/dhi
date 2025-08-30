export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 grid gap-8 md:grid-cols-[1fr_260px]">
      <article className="max-w-none space-y-4">
        {children}
      </article>
      <aside className="hidden md:block">
        <TOC />
      </aside>
    </div>
  );
}

function TOC() {
  return (
    <div className="sticky top-24 rounded-xl border p-4">
      <div className="text-xs uppercase tracking-wide text-ink-2/70">On this page</div>
      <TOCClient />
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

function TOCClient() {
  const [items, setItems] = useState<{ id: string; text: string; level: number }[]>([]);
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("article h2, article h3"));
    const parsed = nodes.map((el) => ({
      id: (el as HTMLElement).id,
      text: el.textContent || "",
      level: el.tagName === "H2" ? 2 : 3,
    }));
    setItems(parsed);
  }, []);
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {items.map((it) => (
        <li key={it.id} className={it.level === 3 ? "pl-3" : ""}>
          <a href={`#${it.id}`} className="text-ink-2 hover:text-ink">
            {it.text}
          </a>
        </li>
      ))}
    </ul>
  );
}
