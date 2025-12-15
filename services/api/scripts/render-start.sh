#!/usr/bin/env bash
set -euo pipefail

# Shim for when Render Root Directory is services/api
# Delegates to repo-root script (three levels up: ../../../)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec bash "${ROOT_DIR}/scripts/render-start.sh"
