#!/bin/bash
# Run benchmarks with the correct .venv environment

set -e

echo "🔧 Setting up environment..."

# Check if .venv exists
if [ ! -d "../.venv" ]; then
    echo "❌ .venv not found. Creating virtual environment..."
    cd ..
    python3 -m venv .venv
    source .venv/bin/activate
    cd python-bindings
    pip install -e .
    pip install satya
else
    echo "✅ Found .venv"
    source ../.venv/bin/activate
fi

echo ""
echo "📦 Python environment:"
which python
python --version

echo ""
echo "📚 Installed packages:"
pip list | grep -E "(dhi|satya)"

echo ""
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
echo "🚀 Running benchmark_native.py"
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
python benchmark_native.py

echo ""
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
echo "🔬 Running diagnose_performance.py"
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
python diagnose_performance.py

echo ""
echo "✅ Benchmarks complete!"
echo ""
echo "💡 Tips:"
echo "  - Results saved to terminal output"
echo "  - Compare with PERFORMANCE_ANALYSIS.md"
echo "  - Run multiple times for consistency"
