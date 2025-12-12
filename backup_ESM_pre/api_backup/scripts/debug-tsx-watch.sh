#!/bin/bash
set -e

echo "---- ENVIRONMENT INFO ----"
node -v
pnpm -v
tsx --version

echo "---- CLEANING ----"
# Change directory to the script's location to ensure paths are correct
cd "$(dirname "$0")/.."
rm -rf node_modules .pnpm-store pnpm-lock.yaml

echo "---- REINSTALL ----"
pnpm install --frozen-lockfile

echo "---- RUNNING TSX WATCH ----"
# Note: The user's example path was 'apps/api/main.ts', but the entry point is 'src/server.ts'
# I will use the correct path.
DEBUG=1 npx tsx watch src/server.ts
