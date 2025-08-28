#!/bin/bash

# Build script for DHI Rust WASM module with maximum optimizations

echo "🦀 Building DHI Rust WASM module with hyper-optimizations..."

# Install wasm-pack if not present
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build with maximum optimizations
wasm-pack build \
    --target web \
    --out-dir pkg \
    --release \
    -- \
    --features simd \
    -C target-cpu=native \
    -C opt-level=3 \
    -C lto=fat \
    -C codegen-units=1 \
    -C panic=abort \
    -Z build-std=std,panic_abort \
    -Z build-std-features=panic_immediate_abort

echo "✅ Rust WASM module built successfully!"
echo "📦 Output: rust/pkg/"
