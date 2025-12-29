#!/bin/bash
#
# add-cleanup.sh - Systematically add cleanup() to all E2E test files
#
# This script adds:
# 1. import { cleanup } from '../helpers/cleanup'; (or '../../helpers/cleanup' for devportal)
# 2. afterAll(async () => { await cleanup(app); });
#
# Only processes files that don't already import cleanup
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Adding cleanup() to E2E test files ===${NC}\n"

# Find all .e2e-spec.ts and .slice.e2e-spec.ts files that don't already import cleanup
FILES=$(find . -name "*.e2e-spec.ts" -o -name "*.slice.e2e-spec.ts" | xargs grep -L "import.*cleanup" | grep -v node_modules)

FILE_COUNT=$(echo "$FILES" | grep -v '^$' | wc -l)

echo -e "${YELLOW}Found $FILE_COUNT files without cleanup import${NC}\n"

for FILE in $FILES; do
  if [ ! -f "$FILE" ]; then
    continue
  fi
  
  echo -e "${BLUE}Processing: $FILE${NC}"
  
  # Determine import path based on directory
  if [[ "$FILE" == *"/devportal/"* ]] || [[ "$FILE" == *"/franchise/"* ]] || [[ "$FILE" == *"/auth/"* ]] || [[ "$FILE" == *"/prisma/"* ]]; then
    IMPORT_PATH="../../helpers/cleanup"
  elif [[ "$FILE" == "./msr-card.e2e-spec.ts" ]] || [[ "$FILE" == "./auth.e2e-spec.ts" ]]; then
    IMPORT_PATH="./helpers/cleanup"
  else
    IMPORT_PATH="../helpers/cleanup"
  fi
  
  # Check if file has an 'import' statement (to find insertion point)
  if grep -q "^import " "$FILE"; then
    # Find the last import line
    LAST_IMPORT_LINE=$(grep -n "^import " "$FILE" | tail -1 | cut -d: -f1)
    
    # Insert cleanup import after last import
    sed -i "${LAST_IMPORT_LINE}a\\import { cleanup } from '${IMPORT_PATH}';" "$FILE"
    echo -e "  ${GREEN}✓ Added cleanup import${NC}"
  else
    # No imports, add at top after any comment blocks
    sed -i "1i\\import { cleanup } from '${IMPORT_PATH}';" "$FILE"
    echo -e "  ${GREEN}✓ Added cleanup import at top${NC}"
  fi
  
  # Check if file already has afterAll
  if grep -q "afterAll" "$FILE"; then
    # Check if cleanup is already called in afterAll
    if grep -A2 "afterAll" "$FILE" | grep -q "cleanup"; then
      echo -e "  ${YELLOW}⚠ afterAll already calls cleanup, skipping${NC}"
    else
      echo -e "  ${YELLOW}⚠ afterAll exists but doesn't call cleanup - manual review needed${NC}"
    fi
  else
    # Find the describe block to add afterAll inside it
    # Look for "describe('..." pattern and add afterAll after beforeAll if it exists
    if grep -q "beforeAll" "$FILE"; then
      # Find the closing }); of beforeAll
      BEFORE_ALL_END=$(grep -n "beforeAll" "$FILE" -A 50 | grep -m1 "^[0-9]*-.*});" | cut -d- -f1)
      
      if [ ! -z "$BEFORE_ALL_END" ]; then
        # Add afterAll after beforeAll
        sed -i "${BEFORE_ALL_END}a\\\\n  afterAll(async () => {\\n    await cleanup(app);\\n  });" "$FILE"
        echo -e "  ${GREEN}✓ Added afterAll with cleanup${NC}"
      else
        echo -e "  ${YELLOW}⚠ Could not find beforeAll end, manual review needed${NC}"
      fi
    else
      echo -e "  ${YELLOW}⚠ No beforeAll found, manual review needed${NC}"
    fi
  fi
  
  echo ""
done

echo -e "${GREEN}=== Cleanup addition complete ===${NC}"
echo -e "${YELLOW}Note: Some files may need manual review. Run lint to verify syntax.${NC}"
