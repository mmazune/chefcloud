#!/bin/bash
# T1.13 Monitor Script - Check progress of matrix and CI runs

echo "=== T1.13 E2E Test Monitoring ==="
echo "Started: $(date)"
echo ""

# Check matrix progress
echo "📊 MATRIX RUNNER STATUS:"
if [ -f .e2e-matrix.json ]; then
  echo "  ✅ Matrix results exist"
  jq -r '.summary' .e2e-matrix.json 2>/dev/null | head -5
else
  echo "  ⏳ Matrix still running (no results yet)"
fi

if [ -f /tmp/matrix-run.log ]; then
  LAST_MATRIX=$(tail -5 /tmp/matrix-run.log)
  echo "  Last output:"
  echo "$LAST_MATRIX" | sed 's/^/    /'
fi

echo ""

# Check CI runner progress  
echo "🚀 CI RUNNER STATUS:"
if [ -f .e2e-run-status.json ]; then
  echo "  ✅ Status file exists"
  cat .e2e-run-status.json | jq '{status, durationMs, exitCode}'
else
  echo "  ⏳ CI still running (no status yet)"
fi

if [ -f /tmp/ci-run.log ]; then
  LAST_CI=$(tail -5 /tmp/ci-run.log)
  echo "  Last output:"
  echo "$LAST_CI" | sed 's/^/    /'
fi

echo ""
echo "=== Monitoring complete at $(date) ==="
