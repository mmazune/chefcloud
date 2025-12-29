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
echo "📊 Checking migration status..."
MIGRATE_STATUS_OUTPUT=$($PRISMA_BIN migrate status --schema=$SCHEMA_PATH 2>&1 || true)

if echo "$MIGRATE_STATUS_OUTPUT" | grep -q "migrate found failed migrations"; then
  echo -e "${YELLOW}⚠️  Warning: Database has failed migrations (dirty state)${NC}"
  echo -e "${YELLOW}   Resetting to clean state...${NC}"
  echo ""
  
  # Reset removes all data and reapplies all migrations from scratch
  $PRISMA_BIN migrate reset --force --skip-seed --schema=$SCHEMA_PATH
  
  echo -e "${GREEN}✅ Database reset complete${NC}"
elif echo "$MIGRATE_STATUS_OUTPUT" | grep -q "have not yet been applied"; then
  PENDING_COUNT=$(echo "$MIGRATE_STATUS_OUTPUT" | grep -A 100 "have not yet been applied" | grep "^20" | wc -l)
  echo -e "${YELLOW}📦 Found $PENDING_COUNT pending migration(s)${NC}"
  echo ""
  echo "🚀 Applying migrations..."
  
  $PRISMA_BIN migrate deploy --schema=$SCHEMA_PATH
  
  echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
  echo -e "${GREEN}✅ Database schema is up-to-date${NC}"
fi

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
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test database ready for E2E tests${NC}"
echo ""
