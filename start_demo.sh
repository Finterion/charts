#!/usr/bin/env bash
set -euo pipefail

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Start the playground dev server
echo "Starting playground demo..."
pnpm --filter @finterion/charts-playground dev
