#!/usr/bin/env bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACROS_DIR="$(cd "$TOOLS_DIR/.." && pwd)"
PARTS_DIR="$MACROS_DIR/src/actions"
OUTPUT_FILE="$MACROS_DIR/libs/tow-actions-lib-v1.js"

PARTS=(
  "00-core.js"
  "10-attack-flow.js"
  "20-defence-flow.js"
  "30-api.js"
)

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

for part in "${PARTS[@]}"; do
  part_path="$PARTS_DIR/$part"
  if [[ ! -f "$part_path" ]]; then
    echo "Missing actions part: $part_path" >&2
    exit 1
  fi
  cat "$part_path" >> "$TMP_FILE"
  echo >> "$TMP_FILE"
done

mv "$TMP_FILE" "$OUTPUT_FILE"
echo "Built actions library: $OUTPUT_FILE"

node "$TOOLS_DIR/build-actions-runtime-libs.mjs"
