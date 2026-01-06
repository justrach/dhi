#!/usr/bin/env bun

import fs from 'fs';

console.log('🚀 ULTRA-PERFORMANCE BENCHMARK - Testing SIMD Optimizations');
console.log('================================================================================');

// Load the compiled WASM module  
const wasmBytes = fs.readFileSync('./js-bindings/dhi.wasm');
const wasmModule = await WebAssembly.instantiate(wasmBytes);
const { exports } = wasmModule.instance;

// Helper to allocate WASM memory
function allocWasm(size) {
    const ptr = exports.alloc(size);
    if (!ptr) throw new Error('WASM allocation failed');
    return ptr;
}

function freeWasm(ptr, size) {
    exports.dealloc(ptr, size);
}

function writeU32Array(ptr, array) {
    const memory = new Uint32Array(exports.memory.buffer, ptr, array.length);
    memory.set(array);
}

function writeI64Array(ptr, array) {
    const memory = new BigInt64Array(exports.memory.buffer, ptr, array.length);
    memory.set(array.map(x => BigInt(x)));
}

function readU8Array(ptr, size) {
    return new Uint8Array(exports.memory.buffer, ptr, size);
}

// Test 1: Ultra-fast integer range validation (SIMD)
console.log('\n📊 Test 1: MEGA-SIMD Integer Range Validation');
console.log('--------------------------------------------------------------------------------');

const numCount = 1000000;
const testNumbers = Array.from({length: numCount}, () => Math.floor(Math.random() * 200) - 50);

const numbersPtr = allocWasm(numCount * 8);  // 8 bytes per i64
const resultsPtr = allocWasm(numCount);      // 1 byte per result

writeI64Array(numbersPtr, testNumbers);

const start1 = performance.now();
exports.validate_int_range_simd(numbersPtr, numCount, -25, 125, resultsPtr);
const end1 = performance.now();

const results1 = readU8Array(resultsPtr, numCount);
const validCount1 = results1.reduce((sum, val) => sum + val, 0);

console.log(`  Time: ${(end1 - start1).toFixed(2)}ms`);
console.log(`  Throughput: ${(numCount / (end1 - start1) * 1000).toLocaleString()} validations/sec`);
console.log(`  Valid: ${validCount1}/${numCount}`);

freeWasm(numbersPtr, numCount * 8);
freeWasm(resultsPtr, numCount);

// Test 2: Ultra-fast TURBO mode validation
console.log('\n⚡ Test 2: TURBO MODE - Maximum Speed Validation');
console.log('--------------------------------------------------------------------------------');

const turboCount = 100000;
const stringLengths = Array.from({length: turboCount}, () => Math.floor(Math.random() * 100) + 1);
const numbers = Array.from({length: turboCount}, () => Math.floor(Math.random() * 200));

const strLenPtr = allocWasm(turboCount * 4);  // 4 bytes per u32
const numbersPtr2 = allocWasm(turboCount * 8); // 8 bytes per i64
const resultsPtr2 = allocWasm(turboCount);     // 1 byte per result

writeU32Array(strLenPtr, stringLengths);
writeI64Array(numbersPtr2, numbers);

const start2 = performance.now();
const validCount2 = exports.validate_turbo_mode(
    turboCount, strLenPtr, numbersPtr2, 5, 50, 10, 150, resultsPtr2
);
const end2 = performance.now();

console.log(`  Time: ${(end2 - start2).toFixed(2)}ms`);
console.log(`  Throughput: ${(turboCount / (end2 - start2) * 1000).toLocaleString()} validations/sec`);
console.log(`  Valid: ${validCount2}/${turboCount}`);
console.log(`  🔥 SIMD Speed: ${((turboCount / (end2 - start2) * 1000) / 1000000).toFixed(1)}M ops/sec`);

freeWasm(strLenPtr, turboCount * 4);
freeWasm(numbersPtr2, turboCount * 8);
freeWasm(resultsPtr2, turboCount);

// Test 3: Email validation ultra-fast
console.log('\n📧 Test 3: Ultra-Fast Email SIMD Validation');
console.log('--------------------------------------------------------------------------------');

const emails = [
    'user@example.com',
    'test.email+tag@domain.org', 
    'invalid-email',
    'another@test.net',
    'bad@',
    'good@domain.co.uk'
];

const emailCount = 50000;
const testEmails = Array.from({length: emailCount}, () => 
    emails[Math.floor(Math.random() * emails.length)]
);

let validEmails = 0;
const start3 = performance.now();

for (const email of testEmails) {
    const emailPtr = allocWasm(email.length);
    const memory = new Uint8Array(exports.memory.buffer, emailPtr, email.length);
    for (let i = 0; i < email.length; i++) {
        memory[i] = email.charCodeAt(i);
    }
    
    const isValid = exports.validate_email_ultra(emailPtr, email.length);
    if (isValid) validEmails++;
    
    freeWasm(emailPtr, email.length);
}

const end3 = performance.now();

console.log(`  Time: ${(end3 - start3).toFixed(2)}ms`);
console.log(`  Throughput: ${(emailCount / (end3 - start3) * 1000).toLocaleString()} emails/sec`);
console.log(`  Valid: ${validEmails}/${emailCount}`);
console.log(`  🚀 Email SIMD: ${((emailCount / (end3 - start3) * 1000) / 1000000).toFixed(1)}M ops/sec`);

// Summary
console.log('\n🎉 ULTRA-OPTIMIZATION SUMMARY');
console.log('================================================================================');
console.log(`✅ Integer SIMD: ${(numCount / (end1 - start1) * 1000 / 1000000).toFixed(1)}M ops/sec`);
console.log(`✅ TURBO Mode:   ${(turboCount / (end2 - start2) * 1000 / 1000000).toFixed(1)}M ops/sec`);
console.log(`✅ Email SIMD:   ${(emailCount / (end3 - start3) * 1000 / 1000000).toFixed(1)}M ops/sec`);

const avgPerformance = (
    (numCount / (end1 - start1) * 1000) + 
    (turboCount / (end2 - start2) * 1000) + 
    (emailCount / (end3 - start3) * 1000)
) / 3 / 1000000;

console.log(`🏆 Average Ultra-Performance: ${avgPerformance.toFixed(1)}M ops/sec`);

if (avgPerformance > 50) {
    console.log('🚀🚀🚀 ULTRA-TARGET ACHIEVED: 50M+ ops/sec! 🚀🚀🚀');
} else if (avgPerformance > 25) {
    console.log('🔥🔥 HIGH-PERFORMANCE: 25M+ ops/sec! 🔥🔥');
} else {
    console.log('⚡ Good performance, room for more optimization');
}

process.exit(0);