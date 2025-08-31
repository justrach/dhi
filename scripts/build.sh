#!/bin/bash
set -e

# Build Rust WASM with ES module target
cd rust
# Enable key WASM features (SIMD, bulk-memory, atomics/threads, tail-calls)
# Keep flags scoped to wasm build only
OLD_RUSTFLAGS="$RUSTFLAGS"
export RUSTFLAGS="-C opt-level=3 -C codegen-units=1 -C panic=abort -C embed-bitcode=yes -C target-feature=+simd128,+bulk-memory,+atomics,+mutable-globals,+tail-call"
WASM_PACK_FLAGS=(--target web --release)
wasm-pack build "${WASM_PACK_FLAGS[@]}"
export RUSTFLAGS="$OLD_RUSTFLAGS"

# Move WASM files to dist
cd ..
mkdir -p dist
cp rust/pkg/* dist/

# Normalize dist/package.json for bundlers (avoid wildcard sideEffects)
if [ -f dist/package.json ]; then
  node -e "const fs=require('fs');const p='dist/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(Array.isArray(j.sideEffects))j.sideEffects=false;fs.writeFileSync(p,JSON.stringify(j,null,2));"
fi

# Build TypeScript wrapper
npm run build:ts

# Build Rust library
echo "Building Rust core..."
cd rust
# Build native host library with native CPU tuning (no LTO to avoid proc-macro errors)
OLD_RUSTFLAGS="$RUSTFLAGS"
export RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C codegen-units=1 -C panic=abort -C embed-bitcode=yes"
cargo build --release
export RUSTFLAGS="$OLD_RUSTFLAGS"
cd ..

# Copy the built library to the right location
mkdir -p dist
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp rust/target/release/libdhi_core.dylib dist/dhi_core.node
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cp rust/target/release/libdhi_core.so dist/dhi_core.node
elif [[ "$OSTYPE" == "msys" ]]; then
    cp rust/target/release/dhi_core.dll dist/dhi_core.node
fi

# Run tests
echo "Running tests..."
