#!/bin/bash
# Railway Post-Deploy Hook - Run Migrations & Seed Tapas Demo
# This script runs automatically after Railway deploys the API service

set -e

echo "🚀 ChefCloud Post-Deploy: Migrations & Seeding"
echo "================================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

echo "✓ Database URL configured"

# Navigate to packages/db
cd packages/db

echo "📦 Installing dependencies..."
npm install -g pnpm
pnpm install

echo "🔄 Running Prisma migrations..."
pnpm prisma migrate deploy

echo "🔧 Generating Prisma Client..."
pnpm prisma generate

# Check if seed should run (only on first deploy)
if [ "$RAILWAY_DEPLOYMENT_ID" = "$RAILWAY_FIRST_DEPLOYMENT_ID" ] || [ "$FORCE_SEED" = "1" ]; then
  echo "🌱 Seeding Tapas demo data..."
  cd ../../services/api
  pnpm prisma db seed
  echo "✅ Seed completed!"
else
  echo "⏭️  Skipping seed (not first deployment)"
  echo "   Set FORCE_SEED=1 to force re-seed"
fi

echo "================================================"
echo "✅ Post-deploy completed successfully!"
