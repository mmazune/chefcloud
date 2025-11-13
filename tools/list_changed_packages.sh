#!/usr/bin/env bash
set -euo pipefail

# Determine base SHA for PRs or default to origin/main
BASE_SHA="${GITHUB_BASE_REF_SHA:-${GITHUB_BASE_SHA:-}}"
if [[ -z "${BASE_SHA}" ]]; then
  # Fallback: merge-base with main
  BASE_SHA="$(git merge-base HEAD origin/main || git merge-base HEAD main || echo "")"
fi

if [[ -z "${BASE_SHA}" ]]; then
  echo "BASE_SHA not found; defaulting to all packages" >&2
  pnpm -w -r exec node -e "console.log(JSON.stringify(require('./package.json').workspaces || []))" >/dev/null 2>&1 || true
fi

# Get changed files
CHANGED_FILES=$(git diff --name-only "${BASE_SHA}" HEAD || true)

# Map changed files to workspace packages using pnpm filter
# Print unique package names, one per line
if [[ -n "${CHANGED_FILES}" ]]; then
  pnpm -w list --depth -1 --json | jq -r '.[].path' | while read -r pkg; do
    if echo "${CHANGED_FILES}" | grep -q "^$(echo "$pkg" | sed 's#\./##')/"; then
      echo "$pkg"
    fi
  done | sort -u
else
  echo ""
fi
