#!/usr/bin/env bash
set -euo pipefail

# Determine base SHA for PRs or default to origin/main
BASE_SHA="${GITHUB_BASE_REF_SHA:-${GITHUB_BASE_SHA:-}}"
if [[ -z "${BASE_SHA}" ]]; then
  # Fallback: merge-base with main
  BASE_SHA="$(git merge-base HEAD origin/main || git merge-base HEAD main || echo "")"
fi

if [[ -z "${BASE_SHA}" ]]; then
  echo "BASE_SHA not found; defaulting to empty" >&2
  exit 0
fi

# Get changed files
CHANGED_FILES=$(git diff --name-only "${BASE_SHA}" HEAD || true)

if [[ -z "${CHANGED_FILES}" ]]; then
  exit 0
fi

# Find all package.json files in workspace
# Check if any changed files are within those package directories
find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.next/*" | while read -r pkg_json; do
  pkg_dir=$(dirname "$pkg_json")
  rel_dir=$(echo "$pkg_dir" | sed 's#^\./##')
  
  # Skip root package.json
  if [[ "$pkg_dir" == "." ]]; then
    continue
  fi
  
  # Check if any changed files are in this package directory
  if echo "${CHANGED_FILES}" | grep -q "^${rel_dir}/"; then
    # Extract package name
    jq -r '.name // empty' "$pkg_json"
  fi
done | sort -u
