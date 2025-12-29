#!/bin/bash
# Batch convert E2E tests to use shared createE2ETestingModule helper

cd /workspaces/chefcloud/services/api/test/e2e

for file in *.e2e-spec.ts; do
  # Skip if already converted
  if grep -q "createE2ETestingModule" "$file"; then
    echo "✓ $file already uses shared helper"
    continue
  fi
  
  # Skip if no Test.createTestingModule
  if ! grep -q "Test.createTestingModule" "$file"; then
    echo "⊘ $file doesn't use Test.createTestingModule"
    continue
  fi
  
  echo "Converting $file..."
  
  # 1. Add import for createE2ETestingModule (after existing imports)
  if ! grep -q "import.*e2e-bootstrap" "$file"; then
    sed -i "/import.*@nestjs\/testing/a import { createE2ETestingModule } from '../helpers/e2e-bootstrap';" "$file"
  fi
  
  # 2. Replace Test.createTestingModule pattern
  # Pattern 1: const moduleFixture: TestingModule = await Test.createTestingModule({
  sed -i 's/const moduleFixture: TestingModule = await Test\.createTestingModule({/const moduleFixture = await createE2ETestingModule({/g' "$file"
  
  # Pattern 2: const modRef: TestingModule = await Test.createTestingModule({
  sed -i 's/const modRef: TestingModule = await Test\.createTestingModule({/const modRef = await createE2ETestingModule({/g' "$file"
  
  # Pattern 3: const moduleRef = await Test.createTestingModule({
  sed -i 's/const moduleRef = await Test\.createTestingModule({/const moduleRef = await createE2ETestingModule({/g' "$file"
  
  # 3. Remove .compile() calls (our helper already compiles)
  sed -i 's/})\.compile();/});/g' "$file"
  
  # 4. Remove Test import if no longer needed
  if ! grep -q "Test\." "$file"; then
    sed -i 's/import { Test, TestingModule }/import { TestingModule }/g' "$file"
    sed -i 's/import { Test }/\/\/ Test import removed/g' "$file"
  fi
  
  # 5. Remove TestingModule type if no longer referenced
  if ! grep -q ": TestingModule" "$file"; then
    sed -i 's/import { TestingModule }/\/\/ TestingModule import removed/g' "$file"
    sed -i 's/, TestingModule//g' "$file"
  fi
  
  echo "✓ Converted $file"
done

echo ""
echo "=== Conversion Summary ==="
echo "Tests using shared helper:"
grep -l "createE2ETestingModule" *.e2e-spec.ts | wc -l
echo "Tests still using Test.createTestingModule:"
grep -l "Test.createTestingModule" *.e2e-spec.ts | wc -l
