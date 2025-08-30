import Link from "next/link";
import { InstallBlock } from "@/components/site/InstallBlock";
import { CodeBlock } from "@/components/site/CodeBlock";
import { Button } from "@/components/ui/button";

export default function Home() {
  const quickstart = `import { d, object, string, number } from 'dhi'

const User = object({
  id: number().int().positive(),
  email: string().email(),
  name: string().min(2),
})

// Parse or throw
const user = User.parse(input)

// Safe parse
const res = User.safeParse(input)
if (!res.success) {
  console.log(res.error.issues[0])
}`;

  return (
    <div className="py-12">
      {/* Hero */}
      <section className="grid md:grid-cols-2 gap-8 items-center min-h-[560px] md:min-h-[620px]">
        <div className="flex flex-col gap-5 pt-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink">
            Validation at escape velocity.
          </h1>
          <p className="text-lg text-ink-2">
            Type-safe validation that won’t slow your hot paths. Transparent
            benchmarks and a tiny, intuitive API.
          </p>
          <InstallBlock />
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/docs">Get Started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/playground">Run Benchmarks</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-2xl hero-plastic h-[360px] md:h-[420px] shadow-[0_10px_40px_-10px_rgba(255,107,0,0.35)]" />
      </section>

      {/* Quickstart */}
      <section className="mt-16 grid gap-6">
        <h2 className="text-xl font-semibold">Quickstart</h2>
        <CodeBlock code={quickstart} language="ts" />
      </section>

      {/* Benchmark teaser */}
      <section className="mt-16">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Benchmarks</h2>
          <Link href="/benchmarks" className="text-sm text-primary hover:underline">
            See full methodology
          </Link>
        </div>
        <div className="mt-4 rounded-xl border p-4">
          <p className="text-sm text-ink-2">Average speedup</p>
          <div className="mt-2 h-4 w-full bg-[var(--bg-weak)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--orange)]"
              style={{ width: "82%" }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-2/80">6.98× (range 1.07×–21.75×)</p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mt-16 grid md:grid-cols-3 gap-4">
        <FeatureCard
          title="Fast paths"
          body="Optimized invalid-path checks for real-world inputs and heavy loads."
        />
        <FeatureCard
          title="Type inference + DX"
          body="Tiny API surface with powerful composition and full type safety."
        />
        <FeatureCard
          title="Small footprint"
          body="Lean runtime and bundle size; built for servers, safe for browsers."
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border p-5 bg-white">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-ink-2 mt-1">{body}</p>
    </div>
  );
}
