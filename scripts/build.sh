#!/bin/bash
set -e

# Build Rust WASM with ES module target
cd rust
wasm-pack build --target web

# Move WASM files to dist
cd ..
mkdir -p dist
cp rust/pkg/* dist/

# Build TypeScript wrapper
npm run build:ts

# Build Rust library
echo "Building Rust core..."
cd rust
cargo build --release
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