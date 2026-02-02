#!/usr/bin/env bun
/**
 * Generate schema-nextjs-edge.ts with embedded WASM
 *
 * This script reads schema-edge.ts and creates a new variant that:
 * 1. Embeds the WASM as base64 directly in the source
 * 2. Decodes and instantiates at module load time
 * 3. Maintains the same sync API as other variants
 *
 * This approach works with Next.js Edge Runtime, Vercel Edge Functions,
 * and any environment that supports top-level await but not direct WASM imports.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

const __dir = dirname(new URL(import.meta.url).pathname);
const rootDir = join(__dir, '..');

// Read the WASM file and encode as base64
const wasmPath = join(rootDir, 'dhi.wasm');
const wasmBytes = readFileSync(wasmPath);
const wasmBase64 = wasmBytes.toString('base64');

console.log(`WASM size: ${wasmBytes.length} bytes (${wasmBase64.length} bytes base64)`);

// Read schema-edge.ts as the template
const schemaEdgePath = join(rootDir, 'schema-edge.ts');
const schemaEdgeContent = readFileSync(schemaEdgePath, 'utf-8');

// Replace the WASM import and instantiation with embedded version
const newWasmLoading = `
// ============================================================================
// WASM Backend Loading (Next.js Edge / Universal compatible)
// ============================================================================

// Embedded WASM as base64 for maximum compatibility
// This works in all environments that support top-level await
const WASM_BASE64 = "${wasmBase64}";

// Decode base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  // Use atob in browser/edge, Buffer in Node
  if (typeof atob === 'function') {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else {
    // Node.js fallback
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

const wasmBytes = base64ToUint8Array(WASM_BASE64);
const wasmResult = await WebAssembly.instantiate(wasmBytes, {}) as any;
// instantiate with bytes returns { instance, module }
const wasm = wasmResult.instance.exports;
const encoder = new TextEncoder();
`;

// Find the WASM loading section and replace it
const importPattern = /\/\/ @ts-ignore - Edge runtimes support direct WASM imports\nimport wasmModule from '\.\/dhi\.wasm';/;
const wasmLoadingPattern = /\/\/ ============================================================================\n\/\/ WASM Backend Loading \(Edge Runtime compatible\)\n\/\/ ============================================================================\n\n\/\/ Edge runtimes pre-compile WASM imports at build time[\s\S]*?const encoder = new TextEncoder\(\);/;

let output = schemaEdgeContent;

// Remove the import statement
output = output.replace(importPattern, '');

// Replace the WASM loading section
output = output.replace(wasmLoadingPattern, newWasmLoading.trim());

// Update the header comment
output = output.replace(
  'Edge Runtime compatible version (Vercel Edge, Deno, etc.) - uses direct WASM import pattern',
  'Next.js Edge / Universal compatible version - uses embedded WASM for maximum compatibility'
);

output = output.replace(
  "import { z } from 'dhi/edge';",
  "import { z } from 'dhi/nextjs';"
);

// Fix module augmentation reference
output = output.replace(
  "declare module './schema-edge'",
  "declare module './schema-nextjs-edge'"
);

// Write the output
const outputPath = join(rootDir, 'schema-nextjs-edge.ts');
writeFileSync(outputPath, output);

console.log(`Generated: ${outputPath}`);
console.log('Done!');
