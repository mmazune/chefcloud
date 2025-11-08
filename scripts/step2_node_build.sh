#!/usr/bin/env bash
set -euo pipefail

echo "=== Node workspace - Installing dependencies ===" | tee -a reports/logs/00_env.txt
corepack enable 2>>reports/logs/00_env.txt || true

if command -v pnpm >/dev/null 2>&1; then
  echo "Using PNPM..." | tee -a reports/logs/00_env.txt
  pnpm install --prefer-offline 2>&1 | tee reports/logs/10_pnpm_install.txt || true
  
  echo "Building..." | tee -a reports/logs/00_env.txt
  (pnpm -r build 2>&1 || pnpm build 2>&1 || true) | tee reports/logs/11_build.txt
  
  echo "Linting..." | tee -a reports/logs/00_env.txt
  (pnpm -r lint 2>&1 || pnpm lint 2>&1 || true) | tee reports/logs/12_lint.txt
  
  echo "Type checking..." | tee -a reports/logs/00_env.txt
  (pnpm -r typecheck 2>&1 || pnpm typecheck 2>&1 || true) | tee reports/logs/13_typecheck.txt
  
  echo "Running tests..." | tee -a reports/logs/00_env.txt
  (pnpm -r test 2>&1 || pnpm test 2>&1 || true) | tee reports/logs/14_test.txt
  
  echo "Generating coverage..." | tee -a reports/logs/00_env.txt
  (pnpm -r coverage 2>&1 || pnpm coverage 2>&1 || true) | tee reports/logs/15_coverage.txt
fi

echo "Node build phase complete"
