#!/bin/bash
# ChefCloud M14 Dev Portal API Examples
# Dev API Keys & Webhooks Management

set -e

# Configuration
API_BASE="http://localhost:3001"
DEV_ADMIN_COOKIE="connect.sid=YOUR_DEV_ADMIN_SESSION_HERE"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

function print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# ============================================================================
# API KEY MANAGEMENT
# ============================================================================

print_header "1. Create Production API Key"
curl -X POST "$API_BASE/dev/keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{
    "orgId": "org-123",
    "name": "Production API Key",
    "environment": "PRODUCTION"
  }' | jq '.'
print_success "Created production API key"

print_header "2. Create Sandbox API Key"
curl -X POST "$API_BASE/dev/keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{
    "orgId": "org-123",
    "name": "Sandbox Testing Key",
    "environment": "SANDBOX"
  }' | jq '.'
print_success "Created sandbox API key"

print_header "3. List All API Keys for Organization"
curl "$API_BASE/dev/keys?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Listed API keys"

print_header "4. Get API Key Details"
# Replace key-id-here with actual key ID from previous responses
curl "$API_BASE/dev/keys/key-id-here?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retrieved key details"

print_header "5. Get API Key Metrics"
curl "$API_BASE/dev/keys/key-id-here/metrics?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retrieved key metrics"

print_header "6. Revoke API Key"
curl -X POST "$API_BASE/dev/keys/key-id-here/revoke" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{ "orgId": "org-123" }' | jq '.'
print_success "Revoked API key"

# ============================================================================
# WEBHOOK SUBSCRIPTION MANAGEMENT
# ============================================================================

print_header "7. Create Webhook Subscription"
curl -X POST "$API_BASE/dev/webhooks/subscriptions" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{
    "orgId": "org-123",
    "url": "https://your-app.com/webhooks/chefcloud",
    "eventTypes": ["order.created", "order.closed", "payment.succeeded"]
  }' | jq '.'
print_success "Created webhook subscription"

print_header "8. List Webhook Subscriptions"
curl "$API_BASE/dev/webhooks/subscriptions?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Listed webhook subscriptions"

print_header "9. Get Webhook Subscription Details"
# Replace sub-id-here with actual subscription ID
curl "$API_BASE/dev/webhooks/subscriptions/sub-id-here?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retrieved subscription details"

print_header "10. Update Webhook Subscription"
curl -X POST "$API_BASE/dev/webhooks/subscriptions/sub-id-here/update" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{
    "orgId": "org-123",
    "url": "https://your-app.com/webhooks/updated",
    "eventTypes": ["order.created", "order.closed", "payment.succeeded", "inventory.low"]
  }' | jq '.'
print_success "Updated subscription"

print_header "11. Disable Webhook Subscription"
curl -X POST "$API_BASE/dev/webhooks/subscriptions/sub-id-here/disable" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{ "orgId": "org-123" }' | jq '.'
print_success "Disabled subscription"

print_header "12. Enable Webhook Subscription"
curl -X POST "$API_BASE/dev/webhooks/subscriptions/sub-id-here/enable" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{ "orgId": "org-123" }' | jq '.'
print_success "Enabled subscription"

print_header "13. Regenerate Webhook Secret"
curl -X POST "$API_BASE/dev/webhooks/subscriptions/sub-id-here/regenerate-secret" \
  -H "Content-Type: application/json" \
  -H "Cookie: $DEV_ADMIN_COOKIE" \
  -d '{ "orgId": "org-123" }' | jq '.'
print_success "Regenerated webhook secret"

# ============================================================================
# WEBHOOK DELIVERY TRACKING
# ============================================================================

print_header "14. List All Webhook Deliveries"
curl "$API_BASE/dev/webhooks/deliveries?orgId=org-123&limit=20" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Listed webhook deliveries"

print_header "15. List Failed Deliveries"
curl "$API_BASE/dev/webhooks/deliveries?orgId=org-123&status=FAILED&limit=10" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Listed failed deliveries"

print_header "16. Filter Deliveries by Event Type"
curl "$API_BASE/dev/webhooks/deliveries?orgId=org-123&eventType=order.created&limit=10" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Filtered deliveries by event type"

print_header "17. Get Delivery Details"
# Replace delivery-id-here with actual delivery ID
curl "$API_BASE/dev/webhooks/deliveries/delivery-id-here?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retrieved delivery details"

print_header "18. Manual Retry Failed Delivery"
curl -X POST "$API_BASE/dev/webhooks/deliveries/delivery-id-here/retry" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retried failed delivery"

print_header "19. Get Subscription Metrics"
curl "$API_BASE/dev/webhooks/subscriptions/sub-id-here/metrics?orgId=org-123" \
  -H "Cookie: $DEV_ADMIN_COOKIE" | jq '.'
print_success "Retrieved subscription metrics"

# ============================================================================
# WEBHOOK SIGNATURE VERIFICATION (Example)
# ============================================================================

print_header "20. Example: Verifying Webhook Signature (Node.js)"
echo "
const crypto = require('crypto');

function verifyWebhookSignature(signature, timestamp, body, secret) {
  const payload = \`\${timestamp}.\${JSON.stringify(body)}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid webhook signature');
  }
  
  // Check timestamp age (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const age = now - parseInt(timestamp, 10);
  if (age > 300) {
    throw new Error('Webhook timestamp too old');
  }
  
  return true;
}

// Express.js endpoint
app.post('/webhooks/chefcloud', express.json(), (req, res) => {
  try {
    const signature = req.headers['x-chefcloud-signature'];
    const timestamp = req.headers['x-chefcloud-timestamp'];
    
    verifyWebhookSignature(
      signature,
      timestamp,
      req.body,
      process.env.CHEFCLOUD_WEBHOOK_SECRET
    );
    
    // Process event
    const { eventType, data } = req.body;
    console.log(\`Received \${eventType}:\`, data);
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
});
"
print_success "Displayed webhook signature verification example"

echo -e "\n${GREEN}=== M14 Dev Portal Examples Complete ===${NC}\n"
echo "Note: Replace placeholder IDs (org-123, key-id-here, sub-id-here, delivery-id-here)"
echo "      with actual IDs from your responses."
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   • API keys are shown only once on creation - save them securely"
echo "   • Webhook secrets are shown only once - update your endpoints immediately"
echo "   • Always verify webhook signatures before processing events"
echo "   • Use HTTPS for all webhook URLs in production"
echo "   • Rotate secrets periodically"
