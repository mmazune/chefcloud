#!/usr/bin/env bash
set -e  # Exit on any error

echo "🚀 ChefCloud Zero-Touch Demo Reset"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to repo root
cd "$(dirname "$0")/.."

# Step 1: Check prerequisites
echo "📋 Step 1/6: Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Please install pnpm: npm install -g pnpm${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2/6: Installing dependencies..."
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Build packages
echo "🔨 Step 3/6: Building packages..."
cd packages/db
pnpm build
cd ../../services/api
pnpm build
cd ../..
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 4: Run migrations
echo "🗄️  Step 4/6: Running database migrations..."
cd packages/db
pnpm prisma migrate deploy
cd ../..
echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Step 5: Seed demo data
echo "🌱 Step 5/6: Seeding demo data..."
cd services/api
NODE_ENV=development SEED_DEMO_DATA=true pnpm tsx prisma/seed.ts
cd ../..
echo -e "${GREEN}✅ Demo data seeded${NC}"
echo ""

# Step 6: Run verifiers
echo "🧪 Step 6/6: Running verification tests..."
echo ""

# Start API server in background
echo "Starting API server..."
cd services/api
node dist/src/main.js &
API_PID=$!
cd ../..

# Wait for server to be ready
echo "Waiting for API server to start..."
sleep 10

# Check if server is running
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Health endpoint not responding, waiting longer...${NC}"
    sleep 5
fi

# Run demo health verifier
echo ""
echo "Running demo health check..."
cd services/api
if pnpm tsx ../../scripts/verify-demo-health.ts; then
    echo -e "${GREEN}✅ Demo health check PASSED${NC}"
    HEALTH_PASS=1
else
    echo -e "${RED}❌ Demo health check FAILED${NC}"
    HEALTH_PASS=0
fi
cd ../..

echo ""
echo "Running role coverage verification..."
cd services/api
if pnpm tsx ../../scripts/verify-role-coverage.ts --out ../../instructions/M7.6_VERIFY_OUTPUT.txt; then
    echo -e "${GREEN}✅ Role coverage verification PASSED${NC}"
    COVERAGE_PASS=1
else
    echo -e "${RED}❌ Role coverage verification FAILED${NC}"
    COVERAGE_PASS=0
fi
cd ../..

# Kill API server
kill $API_PID 2>/dev/null || true

echo ""
echo "===================================="
echo "📊 VERIFICATION SUMMARY"
echo "===================================="
if [ $HEALTH_PASS -eq 1 ] && [ $COVERAGE_PASS -eq 1 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "Demo is ready! You can now:"
    echo "  1. Start API: cd services/api && pnpm start"
    echo "  2. Start Web: cd apps/web && pnpm dev"
    echo "  3. Login with test credentials (see instructions/M7.6_FRESH_START_GUIDE.md)"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Check the output above for details."
    echo "See instructions/M7.6_FRESH_START_GUIDE.md for troubleshooting."
    exit 1
fi
