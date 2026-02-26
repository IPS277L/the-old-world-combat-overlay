#!/usr/bin/env bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$TOOLS_DIR/build-actions-lib.sh"
bash "$TOOLS_DIR/build-overlay-lib.sh"

echo "Built all macros artifacts."
