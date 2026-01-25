/**
 * Generate PNG benchmark charts from JSON results
 * Uses node-canvas for GitHub-compatible PNG output
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createCanvas } from 'canvas';

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

// Color palette (light theme)
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

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = colors.text;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 35);

  // Subtitle
  ctx.fillStyle = colors.grid;
  ctx.font = '12px sans-serif';
  ctx.fillText('Operations per second (higher is better)', width / 2, 55);

  const maxOps = Math.max(...results.flatMap(r => [r.dhi, r.zod]));
  const scale = (width - padding.left - padding.right) / maxOps;

  results.forEach((r, i) => {
    const y = padding.top + i * (barHeight + 10);
    const dhiWidth = Math.round(r.dhi * scale);
    const zodWidth = Math.round(r.zod * scale);

    // Label
    ctx.fillStyle = colors.text;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(r.name, padding.left - 10, y + barHeight / 2 + 5);

    // dhi bar
    ctx.fillStyle = colors.dhi;
    roundRect(ctx, padding.left, y, dhiWidth, barHeight / 2 - 2, 3);
    ctx.fillStyle = colors.dhi;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${(r.dhi / 1e6).toFixed(1)}M/s`, padding.left + dhiWidth + 5, y + barHeight / 4 + 4);

    // Zod bar
    ctx.fillStyle = colors.zod;
    roundRect(ctx, padding.left, y + barHeight / 2, zodWidth, barHeight / 2 - 2, 3);
    ctx.fillStyle = colors.zod;
    ctx.fillText(`${(r.zod / 1e6).toFixed(1)}M/s`, padding.left + zodWidth + 5, y + barHeight * 3 / 4 + 4);

    // Speedup badge
    const speedupColor = r.speedup >= 10 ? '#22c55e' : r.speedup >= 5 ? '#eab308' : '#f97316';
    ctx.fillStyle = speedupColor;
    roundRect(ctx, width - 130, y + 5, 70, 30, 15);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${r.speedup.toFixed(1)}x`, width - 95, y + 25);
  });

  // Legend
  ctx.fillStyle = colors.dhi;
  ctx.fillRect(width - 140, height - 30, 15, 15);
  ctx.fillStyle = colors.text;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('dhi', width - 120, height - 18);

  ctx.fillStyle = colors.zod;
  ctx.fillRect(width - 80, height - 30, 15, 15);
  ctx.fillStyle = colors.text;
  ctx.fillText('Zod', width - 60, height - 18);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(`charts/${filename}`, buffer);
  console.log(`Generated: charts/${filename}`);
}

function generateSpeedupChart(results: BenchmarkResult[], filename: string) {
  const width = 800;
  const barHeight = 35;
  const padding = { top: 60, right: 120, bottom: 40, left: 180 };
  const height = padding.top + padding.bottom + results.length * (barHeight + 8);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = colors.text;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('dhi vs Zod 4 — Performance Comparison', width / 2, 35);

  // Subtitle
  ctx.fillStyle = colors.grid;
  ctx.font = '12px sans-serif';
  ctx.fillText('Speedup factor (higher is better)', width / 2, 55);

  const maxSpeedup = Math.max(...results.map(r => r.speedup));
  const scale = (width - padding.left - padding.right) / maxSpeedup;

  // Sort by speedup
  const sorted = [...results].sort((a, b) => b.speedup - a.speedup);

  sorted.forEach((r, i) => {
    const y = padding.top + i * (barHeight + 8);
    const barWidth = Math.round(r.speedup * scale);

    // Label
    ctx.fillStyle = colors.text;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(r.name, padding.left - 10, y + barHeight / 2 + 5);

    // Bar with color based on speedup
    const barColor = getSpeedupColor(r.speedup, maxSpeedup);
    ctx.fillStyle = barColor;
    roundRect(ctx, padding.left, y, barWidth, barHeight - 4, 4);

    // Speedup label
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${r.speedup.toFixed(1)}x faster`, padding.left + barWidth + 8, y + barHeight / 2 + 5);
  });

  // Average line
  const avgX = Math.round(padding.left + data.summary.averageSpeedup * scale);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(avgX, padding.top - 10);
  ctx.lineTo(avgX, height - padding.bottom + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = colors.accent;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Avg: ${data.summary.averageSpeedup.toFixed(1)}x`, avgX, padding.top - 15);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(`charts/${filename}`, buffer);
  console.log(`Generated: charts/${filename}`);
}

function generateSummaryBadge() {
  const avgSpeedup = data.summary.averageSpeedup;
  const width = 180;
  const height = 50;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, 0, 0, width, height, 8);

  // Border
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  roundRectStroke(ctx, 2, 2, width - 4, height - 4, 6);

  // Text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('avg speedup vs Zod', width / 2, 22);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${avgSpeedup.toFixed(1)}x faster`, width / 2, 40);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  writeFileSync('charts/badge.png', buffer);
  console.log('Generated: charts/badge.png');
}

// Helper function to draw rounded rectangles
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function roundRectStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

// Type for canvas context
type CanvasRenderingContext2D = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

// Group results by category
const categories = new Map<string, BenchmarkResult[]>();
data.results.forEach(r => {
  if (!categories.has(r.category)) categories.set(r.category, []);
  categories.get(r.category)!.push(r);
});

// Generate charts
generateSpeedupChart(data.results, 'speedup-all.png');
generateSummaryBadge();

categories.forEach((results, category) => {
  const filename = `benchmark-${category.toLowerCase().replace(/\s+/g, '-')}.png`;
  generateBarChart(results, `${category} Benchmarks`, filename);
});

// Generate combined chart with top performers
const topPerformers = [...data.results].sort((a, b) => b.speedup - a.speedup).slice(0, 10);
generateBarChart(topPerformers, 'Top 10 Performance Gains', 'top-10.png');

console.log('\nSummary:');
console.log(`  Total benchmarks: ${data.summary.totalBenchmarks}`);
console.log(`  Average speedup: ${data.summary.averageSpeedup.toFixed(1)}x`);
console.log(`  Max speedup: ${data.summary.maxSpeedup.toFixed(1)}x`);
console.log(`  Min speedup: ${data.summary.minSpeedup.toFixed(1)}x`);
