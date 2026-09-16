#!/usr/bin/env bash
# ===================================================
#   Dataview Documentation Generator (Bash)
# ===================================================
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed or not found in PATH."
  exit 1
fi

echo "[INFO] Generating HTML documentation into docs/..."
npx typedoc --out docs core --entryPointStrategy expand --exclude "**/*.worker.ts" --tsconfig tsconfig.app.json
echo "[SUCCESS] Documentation generated in docs/"
