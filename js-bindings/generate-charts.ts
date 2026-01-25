/**
 * Generate SVG benchmark charts from JSON results
 * Uses simple SVG without style attributes for GitHub compatibility
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

interface BenchmarkResult {
  name: string;
  category: string;
  dhi: number;
  zod: number;
  speedup: number;
}

interface BenchmarkData {
  timestamp: string;
  runtime: string;
  results: BenchmarkResult[];
  summary: {
    totalBenchmarks: number;
    averageSpeedup: number;
    maxSpeedup: number;
    minSpeedup: number;
  };
}

// Read benchmark results
const data: BenchmarkData = JSON.parse(readFileSync('benchmark-results.json', 'utf-8'));

// Ensure charts directory exists
if (!existsSync('charts')) {
  mkdirSync('charts');
}

// Color palette (light theme for GitHub compatibility)
const colors = {
  dhi: '#059669',      // Emerald 600
  zod: '#4f46e5',      // Indigo 600
  bg: '#ffffff',       // White
  text: '#1f2937',     // Gray 800
  grid: '#9ca3af',     // Gray 400
  accent: '#0891b2',   // Cyan 600
};

// Get bar color based on speedup
function getSpeedupColor(speedup: number, maxSpeedup: number): string {
  const ratio = speedup / maxSpeedup;
  if (ratio > 0.7) return '#10b981';  // Emerald 500
  if (ratio > 0.5) return '#22c55e';  // Green 500
  if (ratio > 0.3) return '#84cc16';  // Lime 500
  if (ratio > 0.15) return '#eab308'; // Yellow 500
  return '#f97316';                   // Orange 500
}

function generateBarChart(results: BenchmarkResult[], title: string, filename: string) {
  const width = 800;
  const barHeight = 40;
  const padding = { top: 60, right: 150, bottom: 40, left: 180 };
  const height = padding.top + padding.bottom + results.length * (barHeight + 10);

  const maxOps = Math.max(...results.flatMap(r => [r.dhi, r.zod]));
  const scale = (width - padding.left - padding.right) / maxOps;

  // Simple SVG without style attributes for GitHub compatibility
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${colors.bg}"/>
  <text x="${width/2}" y="35" fill="${colors.text}" font-size="20" font-weight="bold" text-anchor="middle" font-family="sans-serif">${title}</text>
  <text x="${width/2}" y="55" fill="${colors.grid}" font-size="12" text-anchor="middle" font-family="sans-serif">Operations per second (higher is better)</text>
`;

  results.forEach((r, i) => {
    const y = padding.top + i * (barHeight + 10);
    const dhiWidth = Math.round(r.dhi * scale);
    const zodWidth = Math.round(r.zod * scale);

    // Label
    svg += `  <text x="${padding.left - 10}" y="${y + barHeight/2 + 5}" fill="${colors.text}" font-size="13" text-anchor="end" font-family="sans-serif">${r.name}</text>\n`;

    // dhi bar (solid color instead of gradient)
    svg += `  <rect x="${padding.left}" y="${y}" width="${dhiWidth}" height="${barHeight/2 - 2}" fill="${colors.dhi}" rx="3"/>\n`;
    svg += `  <text x="${padding.left + dhiWidth + 5}" y="${y + barHeight/4 + 4}" fill="${colors.dhi}" font-size="11" font-family="sans-serif">${(r.dhi / 1e6).toFixed(1)}M/s</text>\n`;

    // Zod bar (solid color instead of gradient)
    svg += `  <rect x="${padding.left}" y="${y + barHeight/2}" width="${zodWidth}" height="${barHeight/2 - 2}" fill="${colors.zod}" rx="3"/>\n`;
    svg += `  <text x="${padding.left + zodWidth + 5}" y="${y + barHeight*3/4 + 4}" fill="${colors.zod}" font-size="11" font-family="sans-serif">${(r.zod / 1e6).toFixed(1)}M/s</text>\n`;

    // Speedup badge
    const speedupColor = r.speedup >= 10 ? '#22c55e' : r.speedup >= 5 ? '#eab308' : '#f97316';
    svg += `  <rect x="${width - 130}" y="${y + 5}" width="70" height="30" fill="${speedupColor}" rx="15"/>\n`;
    svg += `  <text x="${width - 95}" y="${y + 25}" fill="white" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">${r.speedup.toFixed(1)}x</text>\n`;
  });

  // Legend
  svg += `  <rect x="${width - 140}" y="${height - 30}" width="15" height="15" fill="${colors.dhi}"/>\n`;
  svg += `  <text x="${width - 120}" y="${height - 18}" fill="${colors.text}" font-size="12" font-family="sans-serif">dhi</text>\n`;
  svg += `  <rect x="${width - 80}" y="${height - 30}" width="15" height="15" fill="${colors.zod}"/>\n`;
  svg += `  <text x="${width - 60}" y="${height - 18}" fill="${colors.text}" font-size="12" font-family="sans-serif">Zod</text>\n`;

  svg += '</svg>';

  writeFileSync(`charts/${filename}`, svg);
  console.log(`Generated: charts/${filename}`);
}

function generateSpeedupChart(results: BenchmarkResult[], filename: string) {
  const width = 800;
  const barHeight = 35;
  const padding = { top: 60, right: 100, bottom: 40, left: 180 };
  const height = padding.top + padding.bottom + results.length * (barHeight + 8);

  const maxSpeedup = Math.max(...results.map(r => r.speedup));
  const scale = (width - padding.left - padding.right) / maxSpeedup;

  // Simple SVG without style attributes for GitHub compatibility
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${colors.bg}"/>
  <text x="${width/2}" y="35" fill="${colors.text}" font-size="20" font-weight="bold" text-anchor="middle" font-family="sans-serif">dhi vs Zod 4 — Performance Comparison</text>
  <text x="${width/2}" y="55" fill="${colors.grid}" font-size="12" text-anchor="middle" font-family="sans-serif">Speedup factor (higher is better)</text>
`;

  // Sort by speedup
  const sorted = [...results].sort((a, b) => b.speedup - a.speedup);

  sorted.forEach((r, i) => {
    const y = padding.top + i * (barHeight + 8);
    const barWidth = Math.round(r.speedup * scale);

    // Label
    svg += `  <text x="${padding.left - 10}" y="${y + barHeight/2 + 5}" fill="${colors.text}" font-size="13" text-anchor="end" font-family="sans-serif">${r.name}</text>\n`;

    // Bar with hex color based on speedup
    const barColor = getSpeedupColor(r.speedup, maxSpeedup);
    svg += `  <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight - 4}" fill="${barColor}" rx="4"/>\n`;

    // Speedup label
    svg += `  <text x="${padding.left + barWidth + 8}" y="${y + barHeight/2 + 5}" fill="${colors.text}" font-size="13" font-weight="bold" font-family="sans-serif">${r.speedup.toFixed(1)}x faster</text>\n`;
  });

  // Average line
  const avgX = Math.round(padding.left + data.summary.averageSpeedup * scale);
  svg += `  <line x1="${avgX}" y1="${padding.top - 10}" x2="${avgX}" y2="${height - padding.bottom + 10}" stroke="${colors.accent}" stroke-width="2" stroke-dasharray="5,5"/>\n`;
  svg += `  <text x="${avgX}" y="${padding.top - 15}" fill="${colors.accent}" font-size="11" text-anchor="middle" font-family="sans-serif">Avg: ${data.summary.averageSpeedup.toFixed(1)}x</text>\n`;

  svg += '</svg>';

  writeFileSync(`charts/${filename}`, svg);
  console.log(`Generated: charts/${filename}`);
}

function generateSummaryBadge() {
  const avgSpeedup = data.summary.averageSpeedup;
  const width = 180;
  const height = 50;

  // Simple badge without gradients for GitHub compatibility
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="8" fill="#1e293b"/>
  <rect x="2" y="2" width="${width-4}" height="${height-4}" rx="6" fill="none" stroke="#10b981" stroke-width="2"/>
  <text x="${width/2}" y="22" fill="#94a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">avg speedup vs Zod</text>
  <text x="${width/2}" y="40" fill="#10b981" font-size="18" font-weight="bold" font-family="sans-serif" text-anchor="middle">${avgSpeedup.toFixed(1)}x faster</text>
</svg>`;

  writeFileSync('charts/badge.svg', svg);
  console.log('Generated: charts/badge.svg');
}

// Group results by category
const categories = new Map<string, BenchmarkResult[]>();
data.results.forEach(r => {
  if (!categories.has(r.category)) categories.set(r.category, []);
  categories.get(r.category)!.push(r);
});

// Generate charts
generateSpeedupChart(data.results, 'speedup-all.svg');
generateSummaryBadge();

categories.forEach((results, category) => {
  const filename = `benchmark-${category.toLowerCase().replace(/\s+/g, '-')}.svg`;
  generateBarChart(results, `${category} Benchmarks`, filename);
});

// Generate combined chart with top performers
const topPerformers = [...data.results].sort((a, b) => b.speedup - a.speedup).slice(0, 10);
generateBarChart(topPerformers, 'Top 10 Performance Gains', 'top-10.svg');

console.log('\nSummary:');
console.log(`  Total benchmarks: ${data.summary.totalBenchmarks}`);
console.log(`  Average speedup: ${data.summary.averageSpeedup.toFixed(1)}x`);
console.log(`  Max speedup: ${data.summary.maxSpeedup.toFixed(1)}x`);
console.log(`  Min speedup: ${data.summary.minSpeedup.toFixed(1)}x`);
