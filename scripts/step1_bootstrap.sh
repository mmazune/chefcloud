#!/usr/bin/env bash
set -euo pipefail

# Basic env info
echo "=== System Info ===" | tee reports/logs/00_env.txt
uname -a | tee -a reports/logs/00_env.txt
node -v    2>>reports/logs/00_env.txt || echo "node not found" | tee -a reports/logs/00_env.txt
npm -v     2>>reports/logs/00_env.txt || echo "npm not found" | tee -a reports/logs/00_env.txt
pnpm -v    2>>reports/logs/00_env.txt || echo "pnpm not found" | tee -a reports/logs/00_env.txt
yarn -v    2>>reports/logs/00_env.txt || echo "yarn not found" | tee -a reports/logs/00_env.txt
python -V  2>>reports/logs/00_env.txt || echo "python not found" | tee -a reports/logs/00_env.txt
poetry -V  2>>reports/logs/00_env.txt || echo "poetry not found" | tee -a reports/logs/00_env.txt
uv --version 2>>reports/logs/00_env.txt || echo "uv not found" | tee -a reports/logs/00_env.txt
go version 2>>reports/logs/00_env.txt || echo "go not found" | tee -a reports/logs/00_env.txt

# Repo snapshot
git log --oneline -n 50 > reports/logs/01_git_log.txt 2>&1 || true
git status > reports/logs/02_git_status.txt 2>&1 || true
if command -v tree >/dev/null 2>&1; then
  tree -L 3 > reports/logs/03_tree_L3.txt 2>&1 || true
else
  echo "tree command not found" > reports/logs/03_tree_L3.txt
fi

echo "Bootstrap phase 1 complete"
