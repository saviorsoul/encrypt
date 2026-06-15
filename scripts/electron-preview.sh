#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

vite build --mode electron
exec electron . --no-sandbox "$@"
