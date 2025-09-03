# Budget Controls & Dead Letter Queue Implementation

This document details the implementation of Phase 3 (Budget Controls) and Phase 4 (Provider Feedback & DLQ) of the notification system.

## Phase 3: Budget Controls & Cost Management

### Enhanced Settings Structure

The `notification_settings` table now includes budget control fields:

```sql
-- Budget controls
monthly_email_limit INTEGER,
monthly_sms_limit INTEGER,
budget_warning_threshold DECIMAL(3,2) DEFAULT 0.80, -- 80%
budget_hard_cap BOOLEAN DEFAULT true,
budget_cap_behavior TEXT DEFAULT 'skip' CHECK (budget_cap_behavior IN ('skip', 'delay')),
budget_warning_behavior TEXT DEFAULT 'continue' CHECK (budget_warning_behavior IN ('continue', 'throttle')),
cost_per_email_cents INTEGER DEFAULT 0, -- Track costs in cents
cost_per_sms_cents INTEGER DEFAULT 5,   -- ~5 cents per SMS
```

### Budget Watchdog Job

**Function**: `/netlify/functions/budget-watchdog.ts`
**Schedule**: Daily at 08:00 CET/CEST via cron script
**Purpose**: Monitor budget usage and trigger alerts

#### Features:
- **Multi-scope monitoring**: Global, location, and user-level budget tracking
- **80% Warning threshold**: Configurable warning when usage reaches threshold
- **100% Hard cap**: Configurable behavior (skip vs delay) when limit reached
- **Admin notifications**: Automatic alert generation for budget events
- **Metrics logging**: Complete audit trail of budget events

#### Configuration Example:

```typescript
// Global settings
{
  monthly_email_limit: 10000,
  monthly_sms_limit: 1000,
  budget_warning_threshold: 0.80,
  budget_hard_cap: true,
  budget_cap_behavior: 'skip', // or 'delay'
  budget_warning_behavior: 'continue' // or 'throttle'
}
```

#### Usage Monitoring:

The system tracks:
- **Email count**: Number of emails sent per month
- **SMS count**: Number of SMS sent per month  
- **Cost tracking**: Per-notification cost in cents
- **Usage percentage**: Real-time calculation against limits
- **Alert history**: Timestamps of warnings and cap events

### Admin UI Integration

**Health API**: `/netlify/functions/notifications-health`
**Admin API**: `/netlify/functions/notifications-admin`

#### Budget Dashboard Features:
- Real-time usage counters and percentage bars
- Status badges (green/yellow/red) based on usage levels
- Alert history and trend analysis
- Cost breakdown by provider and channel
- Monthly usage reports

#### API Endpoints:

```typescript
// Get budget tracking
GET /notifications-admin?action=budget-tracking&scope=global&year=2024&month=1

// Get budget alerts
GET /notifications-admin?action=budget-alerts&scope=global

// Update settings
PUT /notifications-admin?action=notification-settings
```

### Metrics & Logging

The system logs the following events to `notification_audit`:

- `budget_warning_triggered`: When 80% threshold reached
- `budget_cap_triggered`: When 100% limit reached  
- `budget_watchdog_run`: Daily watchdog execution summary

## Phase 4: Provider Feedback & Dead Letter Queue

### Twilio Webhook Integration

**Function**: `/netlify/functions/twilio-webhook.ts`
**Features**: Complete signature verification and event processing

#### Signature Verification:
```typescript
const expectedSignature = crypto
  .createHmac('sha1', authToken)
  .update(url + body, 'utf8')
  .digest('base64')
```

#### Status Mapping:
- `delivered`, `sent`, `received` → Success
- `failed`, `undelivered` → Failure → Suppression (if permanent)
- `queued`, `sending` → In progress

#### Automatic Suppression:
Permanent error codes that trigger suppression:
- `21211`: Invalid 'To' phone number
- `21610`: Unsubscribed recipient
- `30003`: Unreachable destination
- `30007`: Carrier violation

### SMTP Bounce Handling

**Function**: `/netlify/functions/smtp-bounce-handler.ts`
**Providers**: AWS SES, Mailgun, SendGrid, Generic SMTP

#### Provider Detection:
```typescript
// Auto-detect provider from headers
if (userAgent.includes('Amazon SES')) return 'ses'
if (headers['x-mailgun-signature']) return 'mailgun'  
if (headers['x-twilio-email-event-webhook-signature']) return 'sendgrid'
```

#### Bounce Classification:
- **Hard bounces**: Permanent failures (5xx codes, invalid addresses)
- **Soft bounces**: Temporary failures (4xx codes, full mailboxes)
- **Spam complaints**: Automatic suppression

#### Limitations:
⚠️ **SMTP Feedback Limitations**: 
- SMTP delivery confirmations are limited by design
- Hard bounces are reliably detected
- Soft bounces may not always be reported
- Delivery confirmations require Return-Path setup
- Provider-specific webhooks recommended for accurate tracking

### Dead Letter Queue (DLQ)

**Service**: `DeadLetterQueueService`
**Database**: `notification_dead_letter_queue`

#### Automatic DLQ Movement:
Notifications move to DLQ when:
- Maximum retry attempts reached (default: 3)
- Age exceeds maximum (default: 48 hours)
- Permanent failure detected (hard bounce, invalid recipient)

#### DLQ Management:

```typescript
// Get DLQ statistics
const stats = await dlqService.getDLQStats()
// Returns: totalItems, recentFailures, retryEligible, byFailureType

// Retry failed notification
const result = await dlqService.retryDLQItem(dlqId, {
  updateRecipient: { email: 'new@email.com' },
  notes: 'Updated email address',
  retryBy: userId
})

// Resolve without retry
await dlqService.resolveDLQItem(dlqId, {
  action: 'suppressed',
  notes: 'Added to permanent suppression list'
})
```

#### Admin UI Features:
- **DLQ Badge**: Shows count of unresolved items
- **Failure Analysis**: Breakdown by type and channel
- **Batch Operations**: Retry/resolve multiple items
- **Auto-cleanup**: Remove resolved items after 30 days

### Webhook Event Processing

**Database**: `notification_webhook_events`
**Idempotency**: Provider event IDs prevent duplicate processing

#### Event Processing Flow:
1. **Receive webhook** → Verify signature
2. **Store event** → `notification_webhook_events` table
3. **Process event** → Update notification status
4. **Handle failures** → Move to DLQ if permanent
5. **Update suppression** → Add to suppression list if needed

#### Retry Configuration:

```sql
-- Global retry settings
INSERT INTO notification_retry_config (
  scope, max_attempts, initial_delay_minutes, 
  backoff_multiplier, max_delay_minutes
) VALUES (
  'global', 3, 15, 2.0, 1440
);
```

## Testing & Validation

### Budget Testing Scenarios:

1. **80% Warning Test**:
   ```bash
   # Send notifications until 80% of limit reached
   # Verify warning event logged
   # Check admin alert sent
   ```

2. **100% Cap Test**:
   ```bash
   # Reach 100% of monthly limit
   # Verify hard cap behavior (skip/delay)
   # Check notification blocking
   ```

### DLQ Testing Scenarios:

1. **Webhook Replay Test**:
   ```bash
   # Send duplicate webhook events
   # Verify idempotent processing
   # Check no duplicate DLQ entries
   ```

2. **Provider Failure Test**:
   ```bash
   # Simulate Twilio/SMTP failures
   # Verify DLQ population
   # Test retry mechanisms
   ```

## Monitoring & Alerts

### Health Check Integration

The `/notifications-health` endpoint provides comprehensive monitoring:

```json
{
  "status": "healthy",
  "checks": {
    "budget": {
      "status": "warning",
      "emailUsage": 85.5,
      "smsUsage": 45.2
    },
    "queue": {
      "status": "healthy", 
      "pendingCount": 15,
      "failedCount": 2
    }
  },
  "dlq": {
    "totalItems": 5,
    "recentFailures": 2,
    "retryEligible": 3
  }
}
```

### Runbooks

#### Budget Exhausted
1. Check current usage via health API
2. Review cost tracking for unusual activity
3. Increase limits or investigate spam
4. Monitor for resolution

#### High DLQ Count
1. Check DLQ statistics for failure patterns
2. Review webhook processing errors
3. Update recipient information if needed
4. Retry eligible items after fixes

#### Provider Webhook Failures
1. Verify webhook endpoint accessibility
2. Check signature verification settings
3. Review provider status pages
4. Reprocess failed events via admin API

## Security Considerations

### Webhook Security:
- **Signature verification** for all providers
- **Rate limiting** on webhook endpoints  
- **IP whitelisting** where supported
- **Audit logging** of all webhook events

### Admin API Security:
- **JWT authentication** required
- **Role-based access** (admin/staff only)
- **Action logging** for all admin operations
- **Request validation** via Zod schemas

### Budget Protection:
- **Hard caps** prevent runaway costs
- **Real-time monitoring** detects anomalies
- **Alert thresholds** provide early warnings
- **Audit trails** track all budget events

## Feature Flags

The system supports feature flags for gradual rollout:

```env
NOTIFICATIONS_ENABLED=true
NOTIFICATIONS_EMAIL_ENABLED=true  
NOTIFICATIONS_SMS_ENABLED=true
NOTIFICATIONS_BUDGET_ENABLED=true
NOTIFICATIONS_DLQ_ENABLED=true
```

## Performance Optimizations

### Batch Processing:
- **Configurable batch sizes** (default: 50)
- **Rate limiting** per provider
- **Queue lag monitoring** for scaling

### Database Optimization:
- **Indexed queries** for fast lookups
- **Partitioned tables** for large datasets
- **Archive policies** for old data

### Caching:
- **Settings caching** to reduce DB load
- **Suppression list caching** for fast checks
- **Budget status caching** with TTL

This implementation provides enterprise-grade budget controls and comprehensive provider feedback handling, suitable for production use in regulated environments.