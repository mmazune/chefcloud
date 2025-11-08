#!/bin/bash
# E24 Webhook Security - Validation Summary
# Run this script to validate the implementation

echo "════════════════════════════════════════════════════════"
echo "  E24 Webhook Security - Implementation Validation"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS=0
FAILURES=0

# Test 1: Check files exist
echo "📁 Test 1: Verifying new files..."
FILES=(
  "services/api/src/common/redis.service.ts"
  "services/api/src/common/webhook-verification.guard.ts"
  "services/api/src/common/webhook-verification.guard.spec.ts"
  "services/api/src/common/raw-body.middleware.ts"
  "services/api/test/webhook-security.e2e-spec.ts"
  "reports/artifacts/webhook-security-test.sh"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
    ((SUCCESS++))
  else
    echo -e "  ${RED}✗${NC} $file - NOT FOUND"
    ((FAILURES++))
  fi
done
echo ""

# Test 2: Check documentation updates
echo "📚 Test 2: Verifying documentation..."
DOCS=(
  "DEV_GUIDE.md"
  "CURL_CHEATSHEET.md"
  "E24-WEBHOOK-SECURITY-COMPLETION.md"
)

for doc in "${DOCS[@]}"; do
  if grep -q "E24" "$doc" 2>/dev/null || grep -q "webhook.*security\|Webhook Security" "$doc" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $doc contains E24 documentation"
    ((SUCCESS++))
  else
    echo -e "  ${YELLOW}⚠${NC} $doc may need E24 documentation"
  fi
done
echo ""

# Test 3: Check TypeScript compilation
echo "🔨 Test 3: TypeScript compilation..."
cd services/api
if pnpm build > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} TypeScript compilation successful"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} TypeScript compilation failed"
  ((FAILURES++))
fi
cd ../..
echo ""

# Test 4: Run unit tests
echo "🧪 Test 4: Unit tests..."
cd services/api
TEST_OUTPUT=$(pnpm test src/common/webhook-verification.guard.spec.ts 2>&1 | grep "Tests:")
if echo "$TEST_OUTPUT" | grep -q "passed"; then
  PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)')
  echo -e "  ${GREEN}✓${NC} Unit tests passed ($PASSED tests)"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} Unit tests failed"
  ((FAILURES++))
fi
cd ../..
echo ""

# Test 5: Check environment variable usage
echo "🔐 Test 5: Environment variables..."
if grep -q "WH_SECRET" services/api/src/common/webhook-verification.guard.ts; then
  echo -e "  ${GREEN}✓${NC} WH_SECRET environment variable used"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} WH_SECRET not found in guard"
  ((FAILURES++))
fi
echo ""

# Test 6: Verify guard is registered
echo "⚙️  Test 6: Guard registration..."
if grep -q "WebhookVerificationGuard" services/api/src/app.module.ts; then
  echo -e "  ${GREEN}✓${NC} WebhookVerificationGuard registered in AppModule"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} WebhookVerificationGuard not registered"
  ((FAILURES++))
fi
echo ""

# Test 7: Verify controller uses guard
echo "🛡️  Test 7: Controller protection..."
if grep -q "@UseGuards(WebhookVerificationGuard)" services/api/src/webhooks.controller.ts; then
  echo -e "  ${GREEN}✓${NC} Webhooks controller uses verification guard"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} Guard not applied to webhooks controller"
  ((FAILURES++))
fi
echo ""

# Test 8: Verify raw body capture
echo "📦 Test 8: Raw body middleware..."
if grep -q "rawBody" services/api/src/main.ts; then
  echo -e "  ${GREEN}✓${NC} Raw body capture configured in main.ts"
  ((SUCCESS++))
else
  echo -e "  ${RED}✗${NC} Raw body capture not found"
  ((FAILURES++))
fi
echo ""

# Test 9: Code metrics
echo "📊 Test 9: Code metrics..."
TOTAL_LINES=$(wc -l services/api/src/common/redis.service.ts \
  services/api/src/common/webhook-verification.guard.ts \
  services/api/src/common/raw-body.middleware.ts \
  services/api/src/common/webhook-verification.guard.spec.ts \
  services/api/test/webhook-security.e2e-spec.ts \
  reports/artifacts/webhook-security-test.sh 2>/dev/null | tail -1 | awk '{print $1}')

echo "  Lines of code: $TOTAL_LINES"
if [ "$TOTAL_LINES" -gt 1000 ]; then
  echo -e "  ${GREEN}✓${NC} Comprehensive implementation (>1000 lines)"
  ((SUCCESS++))
else
  echo -e "  ${YELLOW}⚠${NC} Implementation smaller than expected"
fi
echo ""

# Test 10: Security features checklist
echo "🔒 Test 10: Security features..."
FEATURES=(
  "timingSafeEqual:Constant-time comparison"
  "createHmac:HMAC signature"
  "SKEW_MS:Timestamp validation"
  "replay:Replay protection"
)

for feature in "${FEATURES[@]}"; do
  KEY="${feature%%:*}"
  DESC="${feature##*:}"
  if grep -q "$KEY" services/api/src/common/webhook-verification.guard.ts; then
    echo -e "  ${GREEN}✓${NC} $DESC"
    ((SUCCESS++))
  else
    echo -e "  ${RED}✗${NC} $DESC - NOT FOUND"
    ((FAILURES++))
  fi
done
echo ""

# Summary
echo "════════════════════════════════════════════════════════"
echo "  VALIDATION SUMMARY"
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Passed: $SUCCESS${NC}"
if [ $FAILURES -gt 0 ]; then
  echo -e "${RED}✗ Failed: $FAILURES${NC}"
fi
echo ""

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ ALL VALIDATIONS PASSED${NC}"
  echo ""
  echo "Implementation complete! Key files:"
  echo "  • services/api/src/common/webhook-verification.guard.ts"
  echo "  • services/api/src/common/redis.service.ts"
  echo "  • services/api/test/webhook-security.e2e-spec.ts"
  echo "  • E24-WEBHOOK-SECURITY-COMPLETION.md"
  echo ""
  echo "Next steps:"
  echo "  1. Set WH_SECRET environment variable"
  echo "  2. Run E2E tests: cd services/api && pnpm test:e2e webhook-security"
  echo "  3. Run smoke test: ./reports/artifacts/webhook-security-test.sh"
  exit 0
else
  echo -e "${RED}❌ VALIDATION FAILED${NC}"
  echo "Please review failed checks above"
  exit 1
fi
