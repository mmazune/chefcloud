#!/usr/bin/env bash
set -euo pipefail

# Shim for when Render root directory is services/api
# Delegates to repo-root script (two levels up)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "${ROOT_DIR}/scripts/render-start.sh"
