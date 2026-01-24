/**
 * Benchmark: SIMD-powered validators vs JavaScript-native
 * Tests the performance of WASM SIMD validators
 */
import { z } from './schema';

function bench(name: string, fn: () => void, iterations: number = 1_000_000): number {
  // Warmup
  for (let i = 0; i < 10000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  return opsPerSec;
}

console.log('='.repeat(70));
console.log('  dhi v0.6.0 SIMD Performance Benchmark');
console.log('='.repeat(70));
console.log('');

// String validations
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();
const ipv4Schema = z.string().ipv4();
const base64Schema = z.string().base64();
const dateSchema = z.string().date();
const includesSchema = z.string().includes('needle');
const startsWithSchema = z.string().startsWith('http');
const endsWithSchema = z.string().endsWith('.com');

// Test data
const validEmail = 'user+test@example.com';
const validUrl = 'https://www.example.com/path?query=value';
const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validIpv4 = '192.168.1.100';
const validBase64 = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0';
const validDate = '2024-06-15';
const haystack = 'The quick brown fox jumps over the lazy dog and finds the needle in the haystack';
const urlForPrefix = 'https://example.com/api/v1/data';
const domainForSuffix = 'www.example.com';

// Number validations
const numberSchema = z.number().min(0).max(100).int();
const complexNumberSchema = z.number().positive().finite().multipleOf(5);

// Object validations
const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().max(150),
});

const validUser = { name: 'Alice Johnson', email: 'alice@example.com', age: 28 };
const invalidUser = { name: '', email: 'not-an-email', age: -5 };

console.log('--- String Validators (SIMD-powered) ---');
console.log(`  Email (valid):       ${(bench('email-valid', () => emailSchema.safeParse(validEmail)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Email (invalid):     ${(bench('email-invalid', () => emailSchema.safeParse('invalid')) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  URL (valid):         ${(bench('url-valid', () => urlSchema.safeParse(validUrl)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  UUID (valid):        ${(bench('uuid-valid', () => uuidSchema.safeParse(validUuid)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  IPv4 (valid):        ${(bench('ipv4-valid', () => ipv4Schema.safeParse(validIpv4)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Base64 (valid):      ${(bench('base64-valid', () => base64Schema.safeParse(validBase64)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Date (valid):        ${(bench('date-valid', () => dateSchema.safeParse(validDate)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Includes (Mula):     ${(bench('includes', () => includesSchema.safeParse(haystack)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  StartsWith (SIMD):   ${(bench('startsWith', () => startsWithSchema.safeParse(urlForPrefix)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  EndsWith (SIMD):     ${(bench('endsWith', () => endsWithSchema.safeParse(domainForSuffix)) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

console.log('--- Number Validators ---');
console.log(`  Int range (valid):   ${(bench('number-valid', () => numberSchema.safeParse(42)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Int range (invalid): ${(bench('number-invalid', () => numberSchema.safeParse(150)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Complex checks:      ${(bench('number-complex', () => complexNumberSchema.safeParse(25)) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

console.log('--- Object Validators ---');
console.log(`  User (valid):        ${(bench('user-valid', () => userSchema.safeParse(validUser), 500_000) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  User (invalid):      ${(bench('user-invalid', () => userSchema.safeParse(invalidUser), 500_000) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

// Simple type checks
const stringSchema = z.string();
const boolSchema = z.boolean();
console.log('--- Primitive Type Checks (baseline speed) ---');
console.log(`  String type check:   ${(bench('string-type', () => stringSchema.safeParse('hello')) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Number type check:   ${(bench('number-type', () => z.number().safeParse(42)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Boolean type check:  ${(bench('bool-type', () => boolSchema.safeParse(true)) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

// Coercion
console.log('--- Coercion ---');
console.log(`  Coerce string:       ${(bench('coerce-string', () => z.coerce.string().safeParse(42)) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Coerce number:       ${(bench('coerce-number', () => z.coerce.number().safeParse('42')) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

// Transforms
const trimSchema = z.string().trim();
const transformSchema = z.string().transform(s => s.length);
console.log('--- Transforms ---');
console.log(`  Trim:                ${(bench('trim', () => trimSchema.safeParse('  hello  ')) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Transform (len):     ${(bench('transform', () => transformSchema.safeParse('hello')) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

// Enum
const enumSchema = z.enum(['red', 'green', 'blue', 'yellow', 'purple']);
console.log('--- Enum ---');
console.log(`  Enum (valid):        ${(bench('enum-valid', () => enumSchema.safeParse('blue')) / 1e6).toFixed(2)}M ops/sec`);
console.log(`  Enum (invalid):      ${(bench('enum-invalid', () => enumSchema.safeParse('orange')) / 1e6).toFixed(2)}M ops/sec`);
console.log('');

console.log('='.repeat(70));
console.log('  All benchmarks complete');
console.log('='.repeat(70));
