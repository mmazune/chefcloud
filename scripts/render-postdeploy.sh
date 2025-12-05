#!/bin/bash
# Render Post-Deploy Hook - Run Migrations & Seed Tapas Demo
# This script runs automatically after Render deploys the API service
# Or can be run manually in Render Shell

set -e

echo "🚀 ChefCloud Post-Deploy: Migrations & Seeding (Render)"
echo "========================================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

echo "✓ Database URL configured"

# Detect Render environment
if [ -n "$RENDER" ]; then
  echo "✓ Running on Render"
  REPO_ROOT="/opt/render/project/src"
else
  echo "✓ Running locally or in other environment"
  REPO_ROOT="$(pwd)"
fi

# Navigate to packages/db
cd "$REPO_ROOT/packages/db" || cd packages/db

echo "📦 Installing dependencies..."
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi
pnpm install

echo "🔄 Running Prisma migrations..."
pnpm prisma migrate deploy

echo "🔧 Generating Prisma Client..."
pnpm prisma generate

# Check if seed should run (only on first deploy or if FORCE_SEED=1)
if [ "$RENDER_INSTANCE_ID" = "1" ] || [ "$FORCE_SEED" = "1" ] || [ -z "$RENDER" ]; then
  echo "🌱 Seeding Tapas demo data..."
  cd "$REPO_ROOT/services/api" || cd ../../services/api
  pnpm prisma db seed
  echo "✅ Seed completed!"
else
  echo "⏭️  Skipping seed (not first instance or FORCE_SEED not set)"
  echo "   Set FORCE_SEED=1 in Render environment to force re-seed"
fi

echo "========================================================"
echo "✅ Post-deploy completed successfully!"
