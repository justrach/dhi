#!/usr/bin/env bun
import fs from 'fs';

// Load WASM and list all available functions
const wasmBytes = fs.readFileSync('./js-bindings/dhi.wasm');
const wasmModule = await WebAssembly.instantiate(wasmBytes);
const { exports } = wasmModule.instance;

console.log('🚀 i32 OPTIMIZATION TEST - No BigInt Required!');
console.log('================================================================================');

// Check for new i32 functions
const i32Functions = [
  'validate_int_i32',
  'validate_int_range_simd_i32',
  'validate_turbo_mode_i32'
];

console.log('\n📋 New i32 Functions:');
for (const fn of i32Functions) {
  const status = exports[fn] ? '✅' : '❌';
  console.log(`  ${status} ${fn}`);
}

// Test validate_int_i32
console.log('\n📊 Testing validate_int_i32:');
try {
  const result1 = exports.validate_int_i32(50, 0, 100);  // in range
  const result2 = exports.validate_int_i32(150, 0, 100); // out of range
  const result3 = exports.validate_int_i32(-5, 0, 100);  // out of range
  console.log(`  50 in [0,100]: ${result1 ? '✅ valid' : '❌ invalid'}`);
  console.log(`  150 in [0,100]: ${result2 ? '❌ should be invalid' : '✅ correctly invalid'}`);
  console.log(`  -5 in [0,100]: ${result3 ? '❌ should be invalid' : '✅ correctly invalid'}`);
} catch (e) {
  console.log(`  ❌ Error: ${e.message}`);
}

// Test SIMD i32 batch validation
console.log('\n📊 Testing validate_int_range_simd_i32:');
try {
  const count = 1000;
  const valuesPtr = exports.alloc(count * 4);  // 4 bytes per i32
  const resultsPtr = exports.alloc(count);     // 1 byte per result

  // Write test data (i32 values)
  const memory = new Int32Array(exports.memory.buffer, valuesPtr, count);
  for (let i = 0; i < count; i++) {
    memory[i] = i - 500;  // Range: -500 to 499
  }

  const start = performance.now();
  const iterations = 10000;
  for (let iter = 0; iter < iterations; iter++) {
    exports.validate_int_range_simd_i32(valuesPtr, count, -100, 100, resultsPtr);
  }
  const elapsed = performance.now() - start;

  // Read results
  const results = new Uint8Array(exports.memory.buffer, resultsPtr, count);
  let validCount = 0;
  for (let i = 0; i < count; i++) {
    if (results[i]) validCount++;
  }

  const totalOps = count * iterations;
  const opsPerSec = (totalOps / elapsed) * 1000;

  console.log(`  Validated ${count} numbers x ${iterations} iterations`);
  console.log(`  Valid in [-100,100]: ${validCount}/${count}`);
  console.log(`  Time: ${elapsed.toFixed(2)}ms`);
  console.log(`  Speed: ${(opsPerSec / 1e6).toFixed(2)}M ops/sec`);

  exports.dealloc(valuesPtr, count * 4);
  exports.dealloc(resultsPtr, count);
} catch (e) {
  console.log(`  ❌ Error: ${e.message}`);
}

// Test turbo mode i32
console.log('\n📊 Testing validate_turbo_mode_i32:');
try {
  const count = 1000;
  const strLensPtr = exports.alloc(count * 4);  // u32 string lengths
  const numbersPtr = exports.alloc(count * 4);  // i32 numbers
  const resultsPtr = exports.alloc(count);      // u8 results

  // Write test data
  const strLens = new Uint32Array(exports.memory.buffer, strLensPtr, count);
  const numbers = new Int32Array(exports.memory.buffer, numbersPtr, count);

  for (let i = 0; i < count; i++) {
    strLens[i] = 5 + (i % 20);  // Lengths 5-24
    numbers[i] = i % 200 - 50;  // Numbers -50 to 149
  }

  const start = performance.now();
  const iterations = 10000;
  let totalValid = 0;
  for (let iter = 0; iter < iterations; iter++) {
    totalValid = exports.validate_turbo_mode_i32(
      count,
      strLensPtr,
      numbersPtr,
      5,    // min_len
      20,   // max_len
      0,    // min_num
      100,  // max_num
      resultsPtr
    );
  }
  const elapsed = performance.now() - start;

  const totalOps = count * iterations;
  const opsPerSec = (totalOps / elapsed) * 1000;

  console.log(`  Validated ${count} items x ${iterations} iterations`);
  console.log(`  Valid count: ${totalValid}/${count}`);
  console.log(`  Time: ${elapsed.toFixed(2)}ms`);
  console.log(`  Speed: ${(opsPerSec / 1e6).toFixed(2)}M ops/sec`);

  exports.dealloc(strLensPtr, count * 4);
  exports.dealloc(numbersPtr, count * 4);
  exports.dealloc(resultsPtr, count);
} catch (e) {
  console.log(`  ❌ Error: ${e.message}`);
}

// Compare i32 vs i64 (if i64 works with BigInt)
console.log('\n📊 Comparing i32 vs Original (single value):');
try {
  const iterations = 1000000;

  // Test i32 version
  const start1 = performance.now();
  let dummy1 = 0;
  for (let i = 0; i < iterations; i++) {
    dummy1 += exports.validate_int_i32(i % 200, 0, 100) ? 1 : 0;
  }
  const elapsed1 = performance.now() - start1;

  console.log(`  i32 version: ${elapsed1.toFixed(2)}ms for ${iterations} calls`);
  console.log(`  Speed: ${(iterations / elapsed1 / 1000).toFixed(2)}M ops/sec`);
  console.log(`  Valid: ${dummy1}/${iterations}`);
} catch (e) {
  console.log(`  ❌ Error: ${e.message}`);
}

console.log('\n================================================================================');
console.log('🏆 i32 OPTIMIZATION COMPLETE - No BigInt conversion overhead!');
