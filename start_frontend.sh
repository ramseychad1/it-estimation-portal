#!/usr/bin/env bash
# Start the Vite dev server. Run from the project root in its own terminal.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/frontend"

# Install deps if node_modules is missing or older than package.json.
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    npm install
fi

exec npm run dev
