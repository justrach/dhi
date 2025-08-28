import { object, string, number, boolean, array, union, optional, discriminatedUnion } from '../src/index';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

type BenchStats = {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
};

function measure(fn: () => void, iterations = 10): BenchStats {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
  const p99 = times[Math.floor(times.length * 0.99)] ?? times[times.length - 1];
  const min = times[0];
  const max = times[times.length - 1];
  const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  return { mean, median, p95, p99, min, max, stdDev };
}

// ----------------------
// Scenario 1: Analytics Events (discriminated union by type)
// ----------------------
type ClickEvent = { type: 'click'; ts: number; element: string; x: number; y: number };
type PageViewEvent = { type: 'page_view'; ts: number; url: string; referrer: string; title: string };
type PurchaseEvent = { type: 'purchase'; ts: number; orderId: string; value: number; currency: string };
type AnalyticsEvent = ClickEvent | PageViewEvent | PurchaseEvent;

const dhiEventSchema = discriminatedUnion('type', {
  click: object<ClickEvent>({ type: string(), ts: number(), element: string(), x: number(), y: number() }),
  page_view: object<PageViewEvent>({ type: string(), ts: number(), url: string(), referrer: string(), title: string() }),
  purchase: object<PurchaseEvent>({ type: string(), ts: number(), orderId: string(), value: number(), currency: string() })
});

const zodEventSchema = z.union([
  z.object({ type: z.literal('click'), ts: z.number(), element: z.string(), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('page_view'), ts: z.number(), url: z.string(), referrer: z.string(), title: z.string() }),
  z.object({ type: z.literal('purchase'), ts: z.number(), orderId: z.string(), value: z.number(), currency: z.string() })
]);

function genEvents(n: number): AnalyticsEvent[] {
  const out: AnalyticsEvent[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = i % 3;
    if (r === 0) out[i] = { type: 'click', ts: Date.now(), element: 'button#buy', x: i % 500, y: (i * 2) % 800 };
    else if (r === 1) out[i] = { type: 'page_view', ts: Date.now(), url: '/home', referrer: '/landing', title: 'Home' };
    else out[i] = { type: 'purchase', ts: Date.now(), orderId: `ord_${i}`, value: (i % 100) + 0.99, currency: 'USD' };
  }
  return out;
}

// ----------------------
// Scenario 2: Optional/Nullable-heavy User Profiles
// ----------------------
type UserProfile = {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  bio?: string;
  marketingOptIn: boolean;
  socials?: string[];
};

const dhiUserSchema = object<UserProfile>({
  id: number(),
  username: string(),
  email: optional(string()),
  phone: optional(string()),
  bio: optional(string()),
  marketingOptIn: boolean(),
  socials: optional(array(string()))
});

const zodUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  marketingOptIn: z.boolean(),
  socials: z.array(z.string()).optional()
});

function genUsers(n: number): Partial<UserProfile>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    username: `user_${i}`,
    marketingOptIn: i % 2 === 0,
    email: i % 3 === 0 ? `user_${i}@example.com` : undefined,
    phone: i % 5 === 0 ? `+1-555-${(1000 + (i % 9000)).toString()}` : undefined,
    bio: i % 7 === 0 ? `Hello I am user ${i}` : undefined,
    socials: i % 4 === 0 ? ['twitter:user', 'github:user'] : undefined
  }));
}

// ----------------------
// Scenario 3: Deeply Nested (depth 5)
// ----------------------
type Deep = { a: { b: { c: { d: { e: { name: string; score: number } } } } } };

const dhiDeepSchema = object<Deep>({
  a: object({ b: object({ c: object({ d: object({ e: object({ name: string(), score: number() }) }) }) }) })
});

const zodDeepSchema = z.object({
  a: z.object({ b: z.object({ c: z.object({ d: z.object({ e: z.object({ name: z.string(), score: z.number() }) }) }) }) })
});

function genDeep(n: number): Deep[] {
  return Array.from({ length: n }, (_, i) => ({
    a: { b: { c: { d: { e: { name: `n${i}`, score: i % 100 } } } } }
  }));
}

// ----------------------
// Scenario 4: Orders (compact version of benchmark4)
// ----------------------
type OrderItem = { productId: string; name: string; qty: number; price: number };
type Order = {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  createdAt: number;
};

const dhiOrderSchema = object<Order>({
  orderId: string(),
  userId: string(),
  items: array(object<OrderItem>({ productId: string(), name: string(), qty: number(), price: number() })),
  total: number(),
  createdAt: number()
});

const zodOrderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(z.object({ productId: z.string(), name: z.string(), qty: z.number(), price: z.number() })),
  total: z.number(),
  createdAt: z.number()
});

function genOrders(n: number): Order[] {
  return Array.from({ length: n }, (_, i) => {
    const items = Array.from({ length: (i % 5) + 1 }, (__, j) => ({
      productId: `p_${i}_${j}`,
      name: `Item ${j}`,
      qty: (j % 3) + 1,
      price: ((j % 10) + 1) * 3.25
    }));
    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    return { orderId: `o_${i}`, userId: `u_${i % 1000}`, items, total, createdAt: Date.now() };
  });
}

// ----------------------
// Data IO helpers (optional real data files)
// ----------------------
const dataDir = process.argv.includes('--data-dir')
  ? process.argv[process.argv.indexOf('--data-dir') + 1]
  : join(__dirname, 'data');
const writeData = process.argv.includes('--write-data');

function maybeEnsureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function maybeWriteJSON<T>(filename: string, data: T) {
  maybeEnsureDir(dataDir);
  writeFileSync(join(dataDir, filename), JSON.stringify(data));
}

function maybeLoadJSON<T>(filename: string): T | null {
  const path = join(dataDir, filename);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ----------------------
// Runner
// ----------------------
async function run() {
  console.log('🚀 DHI Real-World Benchmark Suite (DHI vs Zod)\n');

  const scenarios = [
    {
      name: 'Analytics Events (Union)',
      file: 'events.json',
      size: 500_000,
      gen: genEvents,
      dhi: dhiEventSchema,
      zod: zodEventSchema
    },
    {
      name: 'User Profiles (Optional-heavy)',
      file: 'users.json',
      size: 500_000,
      gen: genUsers,
      dhi: dhiUserSchema,
      zod: zodUserSchema
    },
    {
      name: 'Deeply Nested (Depth 5)',
      file: 'deep.json',
      size: 100_000,
      gen: genDeep,
      dhi: dhiDeepSchema,
      zod: zodDeepSchema
    },
    {
      name: 'Orders (Compact)',
      file: 'orders.json',
      size: 200_000,
      gen: genOrders,
      dhi: dhiOrderSchema,
      zod: zodOrderSchema
    }
  ] as const;

  type Scenario = typeof scenarios[number];
  const results: any[] = [];

  for (const s of scenarios) {
    console.log(`\n📊 Scenario: ${s.name}`);

    let data: any[] | null = maybeLoadJSON<any[]>(s.file);
    if (!data) {
      console.log('  • No data file found, generating synthetic dataset...');
      data = s.gen(s.size) as any[];
      if (writeData) {
        console.log(`  • Writing dataset to ${join(dataDir, s.file)}`);
        maybeWriteJSON(s.file, data);
      }
    } else {
      console.log(`  • Loaded ${data.length.toLocaleString()} records from ${join(dataDir, s.file)}`);
    }

    const warm = Math.min(1000, data.length);
    console.log('  • Warmup...');
    s.dhi.validateBatch(data.slice(0, warm));
    data.slice(0, warm).forEach((d) => s.zod.safeParse(d));

    // Validity snapshot on a sample to sanity-check schemas vs data shape
    const sample = data.slice(0, Math.min(10_000, data.length));
    const dhiValSample = s.dhi.validateBatch(sample);
    const zodValSample = sample.map((d) => s.zod.safeParse(d).success);
    const dhiValidPct = (dhiValSample.filter(Boolean).length / dhiValSample.length) * 100;
    const zodValidPct = (zodValSample.filter(Boolean).length / zodValSample.length) * 100;
    console.log(`  • Validity (sample): DHI ${dhiValidPct.toFixed(1)}% | Zod ${zodValidPct.toFixed(1)}%`);

    console.log('  • Running DHI...');
    const dhiStats = measure(() => { s.dhi.validateBatch(data!); }, 8);
    console.log('  • Running Zod...');
    const zodStats = measure(() => { data!.forEach((d) => s.zod.safeParse(d)); }, 8);

    const dhiThroughput = data.length / (dhiStats.mean / 1000);
    const zodThroughput = data.length / (zodStats.mean / 1000);
    const speedup = dhiThroughput / zodThroughput;

    results.push({ scenario: s.name, size: data.length, dhi: { ...dhiStats, throughput: dhiThroughput }, zod: { ...zodStats, throughput: zodThroughput }, speedup });

    console.log(`  • DHI   Mean ${dhiStats.mean.toFixed(2)}ms, P95 ${dhiStats.p95.toFixed(2)}ms, Thr ${Math.round(dhiThroughput).toLocaleString()} ops/s`);
    console.log(`  • Zod   Mean ${zodStats.mean.toFixed(2)}ms, P95 ${zodStats.p95.toFixed(2)}ms, Thr ${Math.round(zodThroughput).toLocaleString()} ops/s`);
    console.log(`  • Speedup DHI/Zod: ${speedup.toFixed(2)}x`);
  }

  console.log('\n📋 SUMMARY');
  console.log('='.repeat(80));
  let totalSpeed = 0;
  for (const r of results) {
    totalSpeed += r.speedup;
    console.log(`${r.scenario}\n  Size: ${r.size.toLocaleString()}\n  DHI: ${r.dhi.mean.toFixed(2)}ms ± ${r.dhi.stdDev.toFixed(2)}ms (${Math.round(r.dhi.throughput).toLocaleString()} ops/s)\n  Zod: ${r.zod.mean.toFixed(2)}ms ± ${r.zod.stdDev.toFixed(2)}ms (${Math.round(r.zod.throughput).toLocaleString()} ops/s)\n  Speedup: ${r.speedup.toFixed(2)}x\n`);
  }
  const avg = totalSpeed / results.length;
  console.log(`🏁 Average speedup: ${avg.toFixed(2)}x`);
}

run().catch(console.error);
