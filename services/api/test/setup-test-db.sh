#!/bin/bash
# E2E Test Database Setup - Automated Migration Application
# Ensures test database schema is always up-to-date before E2E tests run
#
# Usage:
#   From services/api: pnpm test:e2e:setup
#   Or call directly: ./test/setup-test-db.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 E2E Test Database Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment from .env.e2e
if [ ! -f ".env.e2e" ]; then
  echo -e "${RED}❌ Error: .env.e2e not found${NC}"
  echo "   Create services/api/.env.e2e with DATABASE_URL"
  exit 1
fi

export $(cat .env.e2e | grep -v '^#' | xargs)

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Error: DATABASE_URL not set in .env.e2e${NC}"
  exit 1
fi

# Mask password in display
DISPLAY_URL=$(echo $DATABASE_URL | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
echo -e "📍 Target: ${DISPLAY_URL}"

# Extract database name for safety check
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo -e "🗄️  Database: ${DB_NAME}"

# SAFETY: Confirm this is test database, not dev/prod
if [[ ! "$DB_NAME" =~ test ]]; then
  echo -e "${RED}❌ SAFETY CHECK FAILED: Database name does not contain 'test'${NC}"
  echo "   This script should only run against test databases"
  echo "   Current database: $DB_NAME"
  echo "   Expected pattern: *test*"
  exit 1
fi

# Dataset configuration (default to DEMO_TAPAS per spec)
E2E_DATASET="${E2E_DATASET:-DEMO_TAPAS}"
echo -e "📊 Dataset: ${E2E_DATASET}"

# Path to Prisma schema (monorepo structure)
SCHEMA_PATH="../../packages/db/prisma/schema.prisma"
PRISMA_BIN="../../node_modules/.pnpm/node_modules/.bin/prisma"

if [ ! -f "$SCHEMA_PATH" ]; then
  echo -e "${RED}❌ Error: Prisma schema not found at $SCHEMA_PATH${NC}"
  exit 1
fi

if [ ! -f "$PRISMA_BIN" ]; then
  echo -e "${RED}❌ Error: Prisma binary not found${NC}"
  echo "   Run 'pnpm install' first"
  exit 1
fi

echo ""
echo "🔄 Resetting test database (FK-proof clean slate)..."
echo ""

# ALWAYS reset test DB to avoid FK constraint issues
# This drops all data and reapplies migrations from scratch
# Safe for E2E test database (not prod!)
$PRISMA_BIN migrate reset --force --skip-seed --skip-generate --schema=$SCHEMA_PATH

echo ""
echo -e "${GREEN}✅ Database reset complete - schema is clean${NC}"

echo ""
echo "🌱 Seeding E2E test data..."
echo ""

# Run seed script with E2E environment
SEED_SCRIPT="prisma/seed.ts"
if [ ! -f "$SEED_SCRIPT" ]; then
  echo -e "${RED}❌ Error: Seed script not found at $SEED_SCRIPT${NC}"
  exit 1
fi

# Use tsx to run TypeScript seed file
if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ Error: npx not found${NC}"
  echo "   Install Node.js with npm/npx"
  exit 1
fi

# Run seed with same DATABASE_URL from .env.e2e
npx tsx "$SEED_SCRIPT" || {
  echo -e "${RED}❌ Seed failed${NC}"
  exit 1
}

echo ""
echo -e "${GREEN}✅ Seed complete - demo users ready${NC}"

echo ""
echo "🔍 Verifying seed data integrity..."
VERIFY_SCRIPT="scripts/verify-e2e-seed.mjs"
if [ ! -f "$VERIFY_SCRIPT" ]; then
  echo -e "${YELLOW}⚠️  Warning: Verification script not found at $VERIFY_SCRIPT${NC}"
  echo "   Skipping verification (seed assumed successful)"
else
  node "$VERIFY_SCRIPT" ALL || {
    echo -e "${RED}❌ Seed verification failed - dataset is incomplete${NC}"
    echo "   Tests will likely fail due to missing data"
    exit 1
  }
  echo -e "${GREEN}✅ Seed verification passed${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test database ready for E2E tests${NC}"
echo ""
