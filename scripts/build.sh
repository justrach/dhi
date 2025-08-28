#!/bin/bash
set -e

# Build Rust WASM with ES module target
cd rust
# Enable WASM SIMD only for the wasm32 target; avoid leaking flags into host builds
OLD_RUSTFLAGS="$RUSTFLAGS"
export RUSTFLAGS="-C opt-level=3 -C lto=fat -C codegen-units=1 -C panic=abort -C target-feature=+simd128,+bulk-memory"
wasm-pack build --target web --release
export RUSTFLAGS="$OLD_RUSTFLAGS"

# Move WASM files to dist
cd ..
mkdir -p dist
cp rust/pkg/* dist/

# Build TypeScript wrapper
npm run build:ts

# Build Rust library
echo "Building Rust core..."
cd rust
# Build native host library with native CPU tuning and aggressive LTO
OLD_RUSTFLAGS="$RUSTFLAGS"
export RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C lto=fat -C codegen-units=1 -C panic=abort"
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
