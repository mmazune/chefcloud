# B1: SMTP + Slack Delivery Implementation - Summary

## Overview
Implemented email delivery via SMTP (nodemailer) and Slack webhook support for owner digests and alerts, plus cron-based digest scheduling.

## Completed Features

### 1. Environment Configuration
**File**: `.env.example`

Added SMTP and Slack configuration variables:
```bash
# SMTP Configuration (for owner digests and email alerts)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_SECURE="false"

# Slack Alerts (optional)
SLACK_WEBHOOK_URL=""
```

### 2. Owner Digest Email Delivery
**Files Modified**:
- `services/api/src/owner/owner.service.ts`
- `services/api/src/owner/owner.service.spec.ts`

**Features**:
- Nodemailer SMTP transport configured in constructor
- `sendDigestEmail()` method sends PDF + 3 CSVs (top-items, discounts, voids)
- Logs: `[SMTP] sent -> to: ..., subject: ...`
- Unit tests verify transport called with correct attachments

### 3. Alerts Service - Slack + Email
**Files Modified**:
- `services/api/src/alerts/alerts.service.ts`
- `services/api/src/alerts/alerts.service.spec.ts` (new)

**Features**:
- `sendAlert(orgId, title, message)` method
- If `SLACK_WEBHOOK_URL` configured: sends Slack webhook with blocks format
- Otherwise: sends email via SMTP to AlertChannel with type=EMAIL
- Slack payload includes header + section blocks
- Unit tests verify Slack webhook payload shape and email delivery

**Slack Payload Format**:
```json
{
  "text": "*Alert Title*\nMessage",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Alert Title" }
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "Message" }
    }
  ]
}
```

### 4. Worker Digest Cron Scheduler
**Files Modified**:
- `services/worker/src/index.ts`

**Features**:
- `scheduleOwnerDigestCron()` runs every minute (setInterval 60000ms)
- Checks all OwnerDigest records with non-empty cron field
- For `* * * * *` cron: runs if not run in last minute
- For other crons: runs if not run in last 24 hours (simplified scheduler)
- Updates `lastRunAt` to prevent duplicates
- Logs: `Enqueued owner digest via cron`

**Digest Worker Email**:
- Reads PDF buffer from /tmp
- Sends via nodemailer with PDF attachment
- Includes sales summary and anomalies in HTML body

### 5. Dependencies Installed
- `services/api`: `nodemailer`, `@types/nodemailer`
- `services/worker`: `nodemailer`, `@types/nodemailer`, `cron-parser`

### 6. Tests
**New Test Files**:
- `services/api/src/alerts/alerts.service.spec.ts`: 3 tests
  * Slack webhook delivery
  * Email fallback delivery
  * Slack payload shape validation

**Updated Test Files**:
- `services/api/src/owner/owner.service.spec.ts`: Added 2 tests
  * sendDigestEmail with attachments
  * buildTopItemsCSV format

**Test Results**: ✅ 61/61 API tests passing, 3/3 worker tests passing

### 7. Build Status
✅ All 11 packages built successfully  
✅ No TypeScript errors  
✅ All tests passing  

## API Examples

### Create Digest with Cron
```bash
curl -X POST "http://localhost:3001/owner/digest" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Owner Report",
    "cron": "0 8 * * *",
    "recipients": ["owner@example.com"],
    "sendOnShiftClose": false
  }'
```

### Run Digest Now (Triggers Email)
```bash
curl -X POST "http://localhost:3001/owner/digest/run-now/{digestId}" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Create Email Alert Channel
```bash
curl -X POST "http://localhost:3001/alerts/channels" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EMAIL",
    "target": "manager@example.com",
    "enabled": true
  }'
```

### Test Alert (Will Send Slack or Email)
```bash
curl -X POST "http://localhost:3001/alerts/schedules/{scheduleId}/run-now" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## MailHog Setup for Development

1. **Install MailHog**:
   ```bash
   # macOS
   brew install mailhog
   
   # Linux
   wget https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64
   chmod +x MailHog_linux_amd64
   sudo mv MailHog_linux_amd64 /usr/local/bin/mailhog
   ```

2. **Run MailHog**:
   ```bash
   mailhog
   ```
   
   - SMTP Server: `localhost:1025`
   - Web UI: `http://localhost:8025`

3. **Configure ChefCloud**:
   ```bash
   # .env
   SMTP_HOST=localhost
   SMTP_PORT=1025
   SMTP_USER=
   SMTP_PASS=
   SMTP_SECURE=false
   DIGEST_FROM_EMAIL=noreply@chefcloud.local
   ```

4. **Verify**:
   - Trigger digest via POST /owner/digest/run-now/:id
   - Check MailHog web UI at http://localhost:8025
   - Look for `[SMTP] sent -> to: ...` in API logs

## Slack Setup

1. **Create Incoming Webhook**:
   - Go to https://api.slack.com/apps
   - Create new app or select existing
   - Enable "Incoming Webhooks"
   - Click "Add New Webhook to Workspace"
   - Copy webhook URL

2. **Configure ChefCloud**:
   ```bash
   # .env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

3. **Test**:
   - Trigger alert via POST /alerts/schedules/:id/run-now
   - Check Slack channel for formatted message with header + section blocks

## Logging Examples

**SMTP Email Sent**:
```
[OwnerService] [SMTP] Configured: localhost:1025 (secure=false)
[OwnerService] [SMTP] sent -> to: owner@example.com, subject: Daily Owner Report - 2025-10-28
```

**Slack Alert Sent**:
```
[AlertsService] [Slack] Alert sent: Anomaly Detected
```

**Cron Digest Enqueued**:
```
Scheduled owner digest cron checker (every minute)
[Worker] Enqueued owner digest via cron: digestId=digest-123, digestName=Daily Report, cron=* * * * *
```

## Files Created/Modified

**Created (2)**:
1. `services/api/src/alerts/alerts.service.spec.ts` (3 tests)
2. `B1-SMTP-SLACK-DELIVERY.md` (this file)

**Modified (6)**:
1. `.env.example` (added SMTP + Slack vars)
2. `services/api/src/owner/owner.service.ts` (nodemailer transport + sendDigestEmail)
3. `services/api/src/owner/owner.service.spec.ts` (added email tests)
4. `services/api/src/alerts/alerts.service.ts` (Slack + email delivery)
5. `services/worker/src/index.ts` (cron scheduler + SMTP email in digest worker)
6. `services/api/package.json`, `services/worker/package.json` (added nodemailer)

## Idempotency
✅ Safe to re-run  
✅ Cron scheduler uses lastRunAt to prevent duplicate sends  
✅ SMTP transport initialization is constructor-scoped  
✅ No destructive operations  

---
**Status**: ✅ Complete  
**Build**: ✅ 11/11 packages  
**Tests**: ✅ 61 API tests + 3 worker tests  
**Date**: 2025-10-28
