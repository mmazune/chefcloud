curl -X POST $API_URL/auth/login \
curl -X POST $API_URL/auth/login \
curl -X POST $API_URL/auth/login \
curl $API_URL/me \
curl -X POST $API_URL/menu/items \
curl $API_URL/menu/items \
curl -X POST $API_URL/menu/modifier-groups \
curl $API_URL/floor/tables \
curl -X PATCH $API_URL/floor/tables/TABLE_ID/status \
curl -X POST $API_URL/pos/orders \
curl -X POST $API_URL/pos/orders/ORDER_ID/send \
curl -X POST $API_URL/pos/orders/ORDER_ID/modify \
curl -X POST $API_URL/pos/orders/ORDER_ID/void \
curl -X POST $API_URL/pos/orders/ORDER_ID/discount \
curl -X POST $API_URL/pos/orders/ORDER_ID/close \
curl $API_URL/kds/tickets?station=GRILL \
curl -X PATCH $API_URL/kds/tickets/TICKET_ID/status \
curl -X POST $API_URL/shifts/start \
curl -X POST $API_URL/shifts/close \
curl $API_URL/shifts/active \
curl $API_URL/reports/x-report \
curl $API_URL/reports/z-report \
curl "$API_URL/analytics/sales?period=today" \
curl "$API_URL/analytics/sales?period=week" \
curl "$API_URL/analytics/sales?period=month" \
curl "$API_URL/analytics/sales?start=2025-01-01&end=2025-01-31" \
curl "$API_URL/analytics/top-items?limit=10&period=week" \
curl -X POST $API_URL/inventory/items \
curl $API_URL/inventory/items \
curl $API_URL/inventory/levels \
curl -X POST $API_URL/inventory/recipes/MENU_ITEM_ID \
curl $API_URL/inventory/recipes/MENU_ITEM_ID \
curl -X POST $API_URL/inventory/wastage \
curl -X POST $API_URL/purchasing/po \
curl -X POST $API_URL/purchasing/po/PO_ID/place \
curl -X POST $API_URL/purchasing/po/PO_ID/receive \
curl -X POST $API_URL/device/register \
curl $API_URL/health
curl -s "${BASE_URL}/dash/leaderboards/voids?from=2025-01-01&to=2025-01-31&limit=10" \
curl -s "${BASE_URL}/dash/leaderboards/discounts?from=2025-01-01&to=2025-01-31&limit=10" \
curl -s "${BASE_URL}/dash/no-drinks-rate?from=2025-01-01&to=2025-01-31" \
curl -s "${BASE_URL}/dash/late-void-heatmap?from=2025-01-01&to=2025-01-31" \
curl -s "${BASE_URL}/dash/anomalies/recent?limit=50" \
curl -s "${BASE_URL}/thresholds" \
curl -s -X PATCH "${BASE_URL}/thresholds" \
curl -s "${BASE_URL}/thresholds" \
curl -s -X GET "$API_URL/ops/apikeys" \
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
curl -X POST http://localhost:3000/dev/orgs \
curl http://localhost:3000/dev/subscriptions \
curl -X POST http://localhost:3000/dev/plans \
curl -X POST http://localhost:3000/dev/superdevs \
curl -X POST http://localhost:3000/dev/superdevs \
curl http://localhost:3000/billing/subscription \
curl -X POST http://localhost:3000/billing/plan/change \
curl -X POST http://localhost:3000/billing/cancel \
curl -X POST http://localhost:3000/dev/orgs \
curl -X POST http://localhost:3000/dev/orgs \
curl http://localhost:3000/billing/subscription -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3000/billing/plan/change \
