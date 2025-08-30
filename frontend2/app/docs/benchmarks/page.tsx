export default function ReproduceBenchesPage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold">Reproduce Benchmarks</h1>
      <ol className="mt-3 list-decimal pl-5 text-sm text-ink-2 space-y-2">
        <li>Clone the benchmark repo and install Node 20+.</li>
        <li>Install deps with your preferred package manager.</li>
        <li>Warm up with one run; then run the full suite.</li>
        <li>Compare ops/sec and ms; see CSV for raw data.</li>
      </ol>
    </div>
  );
}

