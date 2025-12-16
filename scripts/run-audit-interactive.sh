#!/usr/bin/env bash
set -euo pipefail

# Interactive wrapper for cookie/CORS audit
# Prompts for credentials, runs audit, formats output for pasting

echo "ChefCloud Cookie/CORS Audit - Interactive Mode"
echo ""

# Prompt for credentials
echo -n "Enter EMAIL: "
read -r EMAIL

echo -n "Enter PASSWORD: "
read -rs PASSWORD
echo ""
echo ""

# Export for script
export EMAIL
export PASSWORD

# Run audit and capture output
AUDIT_OUTPUT=$(bash scripts/audit-cookies.sh 2>&1)

# Parse and format output
echo "==================================================="
echo "=== COOKIE AUDIT OUTPUT START ==="
echo "==================================================="
echo ""

# Extract OPTIONS preflight section
echo "--- OPTIONS Preflight ---"
echo "$AUDIT_OUTPUT" | sed -n '/1\. Testing OPTIONS preflight/,/^$/p' | grep "^HTTP" || echo "(No HTTP status)"
echo "$AUDIT_OUTPUT" | sed -n '/1\. Testing OPTIONS preflight/,/^$/p' | grep -iE "^access-control-" || echo "(No CORS headers)"
echo "$AUDIT_OUTPUT" | sed -n '/1\. Testing OPTIONS preflight/,/^$/p' | grep -i "^vary:" || echo "(No Vary header)"
echo ""

# Extract registration attempt (for context)
echo "--- Registration Attempt ---"
echo "$AUDIT_OUTPUT" | sed -n '/2\. Attempting POST \/auth\/register/,/^$/p' | grep -E "Registration|User already exists|endpoint not found|returned HTTP" | head -1
echo ""

# Extract login section
echo "--- POST /auth/login ---"
LOGIN_STATUS=$(echo "$AUDIT_OUTPUT" | sed -n '/3\. Testing POST \/auth\/login/,/^$/p' | grep "^HTTP" | head -1 || echo "HTTP/?.? ???")
echo "$LOGIN_STATUS"

# Check if login failed (non-2xx)
STATUS_CODE=$(echo "$LOGIN_STATUS" | awk '{print $2}')
if [[ ! "$STATUS_CODE" =~ ^2[0-9][0-9]$ ]]; then
  echo ""
  echo "ERROR: Login failed with status $STATUS_CODE"
  echo ""
  echo "Response body (first 300 chars):"
  echo "$AUDIT_OUTPUT" | sed -n '/Response Body/,/^$/p' | grep -v "Response Body" | head -c 300
  echo ""
fi

echo ""
echo "CORS Headers:"
echo "$AUDIT_OUTPUT" | sed -n '/CORS Headers:/,/^$/p' | grep -iE "access-control-" || echo "(No CORS headers)"
echo ""

echo "Set-Cookie Headers (redacted):"
echo "$AUDIT_OUTPUT" | sed -n '/Set-Cookie Headers/,/^$/p' | grep -i "set-cookie:" || echo "(No Set-Cookie headers)"
echo ""

echo "Response Body Sample:"
echo "$AUDIT_OUTPUT" | sed -n '/Response Body/,/Audit Complete/p' | grep -v "Response Body" | grep -v "Audit Complete" | head -3
echo ""

echo "==================================================="
echo "=== COOKIE AUDIT OUTPUT END ==="
echo "==================================================="
echo ""
echo "Expected for cross-domain auth:"
echo "  ✓ access-control-allow-origin: https://chefcloud-web.vercel.app"
echo "  ✓ access-control-allow-credentials: true"
echo "  ✓ set-cookie: <name>=<REDACTED>; HttpOnly; Secure; SameSite=None"
