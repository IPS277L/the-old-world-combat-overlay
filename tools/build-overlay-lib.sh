#!/usr/bin/env bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACROS_DIR="$(cd "$TOOLS_DIR/.." && pwd)"
PARTS_DIR="$MACROS_DIR/src/overlay"
OUTPUT_FILE="$MACROS_DIR/libs/tow-overlay-lib-v1.js"

PARTS=(
  "00-header-and-combat.js"
  "10-layout-and-state.js"
  "20-controls.js"
  "30-status-and-api.js"
)

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

for part in "${PARTS[@]}"; do
  part_path="$PARTS_DIR/$part"
  if [[ ! -f "$part_path" ]]; then
    echo "Missing overlay part: $part_path" >&2
    exit 1
  fi
  cat "$part_path" >> "$TMP_FILE"
  echo >> "$TMP_FILE"
done

mv "$TMP_FILE" "$OUTPUT_FILE"
echo "Built overlay library: $OUTPUT_FILE"

node "$TOOLS_DIR/build-overlay-runtime-libs.mjs"
