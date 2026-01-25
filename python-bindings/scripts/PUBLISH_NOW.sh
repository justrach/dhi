#!/bin/bash
set -e

echo "🚀 Publishing dhi v1.0.0 to PyPI"
echo ""
echo "Files to upload:"
ls -lh dist/
echo ""
echo "Using Python 3.12 environment..."
source .venv-publish/bin/activate

echo ""
echo "Ready to publish!"
echo ""
echo "Choose:"
echo "  1. Test PyPI first (recommended): twine upload --repository testpypi dist/*"
echo "  2. Production PyPI: twine upload dist/*"
echo ""
echo "Run one of the above commands to publish!"
