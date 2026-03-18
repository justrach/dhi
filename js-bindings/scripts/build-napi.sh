#!/usr/bin/env bash
# Build the N-API native addon for dhi
# Compiles src/napi_api.zig into a .node file loadable by Node.js
#
# Usage:
#   cd js-bindings && bash scripts/build-napi.sh
#
# Requirements:
#   - Zig (any recent version)
#   - Node.js >= 18

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JS_BINDINGS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$JS_BINDINGS_DIR/.." && pwd)"

echo "==> Finding Node.js headers..."
NODE_INCLUDE=$(node -e "process.stdout.write(process.execPath.replace('/bin/node', '/include/node'))")
if [ ! -f "$NODE_INCLUDE/node_api.h" ]; then
  # Try alternate path (some nvm/brew installs)
  ALT=$(node -e "const p=require('path'); process.stdout.write(p.join(process.execPath,'../../../include/node'))")
  if [ -f "$ALT/node_api.h" ]; then
    NODE_INCLUDE="$ALT"
  else
    echo "ERROR: Could not find node_api.h"
    echo "  Tried: $NODE_INCLUDE"
    echo "  Tried: $ALT"
    echo "  Set NODE_INCLUDE env var to the directory containing node_api.h"
    exit 1
  fi
fi
echo "    Node headers: $NODE_INCLUDE"

echo "==> Building native addon with Zig..."
cd "$ROOT_DIR"
zig build -Doptimize=ReleaseFast "-Dnode_include=$NODE_INCLUDE"

echo "==> Copying addon to js-bindings/..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  SRC="$ROOT_DIR/zig-out/lib/libdhi_native.dylib"
else
  SRC="$ROOT_DIR/zig-out/lib/libdhi_native.so"
fi

DEST="$JS_BINDINGS_DIR/dhi_native.node"

if [ ! -f "$SRC" ]; then
  echo "ERROR: Build output not found at $SRC"
  exit 1
fi

cp "$SRC" "$DEST"
echo "    Output: $DEST"
echo ""
echo "==> Build complete!"
echo "    Run benchmarks: cd js-bindings && bun run bench:napi"
