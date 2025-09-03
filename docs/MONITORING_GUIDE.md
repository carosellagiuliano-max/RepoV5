# Monitoring Infrastructure Guide

This guide provides comprehensive information about the monitoring and operations infrastructure for the Schnittwerk Your Style hair salon booking system.

## Table of Contents

- [Overview](#overview)
- [Health Check System](#health-check-system)
- [Logging & Correlation IDs](#logging--correlation-ids)
- [Alert System](#alert-system)
- [Metrics Collection](#metrics-collection)
- [Thresholds & Configuration](#thresholds--configuration)
- [Troubleshooting](#troubleshooting)

## Overview

The monitoring infrastructure provides comprehensive observability with:

- **Structured JSON logging** with PII redaction and sampling
- **Correlation ID tracking** for end-to-end request tracing
- **Split health monitoring** (lightweight + comprehensive)
- **Multi-channel alerting** (webhook, Slack, email, SMS)
- **Operational metrics** for business and system health
- **Rate limiting** and security for all endpoints

## Health Check System

### Lightweight Health Check: `/api/health`

**Purpose**: Fast liveness probe for load balancers and uptime monitoring.

**Characteristics**:
- Public access (no authentication required)
- Rate limited to 60 requests per minute per IP
- Response time target: <200ms
- No heavy I/O operations
- Always returns 200 unless service is completely down

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "buildInfo": {
    "version": "1.0.0",
    "environment": "production",
    "region": "us-east-1",
    "nodeVersion": "v18.17.0",
    "deployId": "abc123"
  },
  "metrics": {
    "uptime": 3600,
    "memoryUsage": {
      "used": 45,
      "total": 128,
      "percentage": 35
    }
  },
  "correlationId": "abc-123-def"
}
```

**Usage**:
```bash
# Basic health check
curl https://your-app.netlify.app/api/health

# With correlation ID
curl -H "X-Correlation-Id: my-trace-id" \
     https://your-app.netlify.app/api/health
```

### Comprehensive Readiness Check: `/api/ready`

**Purpose**: Deep dependency validation for comprehensive system health.

**Characteristics**:
- JWT authentication required
- Rate limited to 30 requests per minute per IP
- Response time target: <3s
- Tests all downstream dependencies
- Returns 200 (ready), 503 (not ready), or 401 (unauthorized)

**Dependency Checks**:
- **Database**: Connectivity, query performance, response time
- **SMTP**: Server connectivity, authentication
- **SMS/Twilio**: Configuration validation (no API calls to avoid costs)
- **Storage**: Bucket accessibility, file operations
- **DLQ**: Message counts, failure rates
- **Budget**: Usage tracking, alert thresholds

**Response Format**:
```json
{
  "status": "ready", // ready | warning | not_ready
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "buildInfo": { /* same as /health */ },
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database is accessible",
      "responseTime": 45,
      "details": {
        "tablesAccessible": true,
        "thresholds": {
          "warning": 2000,
          "critical": 5000
        }
      }
    },
    // ... other checks
  },
  "metrics": {
    "uptime": 3600,
    "memoryUsage": { /* same as /health */ },
    "overallResponseTime": 156
  },
  "correlationId": "abc-123-def",
  "thresholds": {
    "DLQ_WARNING": 5,
    "DLQ_CRITICAL": 20,
    "BUDGET_WARNING_PCT": 80,
    "BUDGET_CRITICAL_PCT": 100,
    "RESPONSE_TIME_WARNING": 2000,
    "RESPONSE_TIME_CRITICAL": 5000
  }
}
```

**Usage**:
```bash
# Comprehensive readiness check
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://your-app.netlify.app/api/ready
```

## Logging & Correlation IDs

### Structured Logging Features

- **JSON Format**: All logs are structured JSON for easy parsing
- **PII Redaction**: Automatic removal of emails, phones, tokens, passwords
- **Log Sampling**: Reduced logging for noisy components in production
- **Correlation Tracking**: Unique IDs flow through all requests and logs

### Log Format

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Database health check completed",
  "correlationId": "abc-123-def",
  "context": {
    "component": "health-check",
    "action": "database-check",
    "duration": 45,
    "responseTimeMs": 45,
    "userId": "[REDACTED]",
    "metadata": {
      "tablesAccessible": true
    }
  },
  "environment": "production",
  "version": "1.0.0"
}
```

### PII Redaction Patterns

Automatically redacted:
- Email addresses → `[EMAIL_REDACTED]`
- Phone numbers → `[PHONE_REDACTED]`
- Credit cards → `[CARD_REDACTED]`
- JWT tokens → `[JWT_REDACTED]`
- API keys/secrets → `[REDACTED]`
- Password fields → `[REDACTED]`

### Log Sampling Configuration

```bash
# Production log sampling
VITE_LOG_SAMPLE_RATE=1.0              # 100% sampling (no drops)
VITE_LOG_NOISY_SAMPLE_RATE=0.1        # 10% for noisy components

# Noisy components (automatically sampled at lower rate):
# - health-check, readiness-check, cors-preflight
# - rate-limiter, jwt-validation, static-asset
```

### Correlation ID Usage

#### Frontend
```typescript
import { fetchWithCorrelation, useCorrelationId } from '@/lib/monitoring/correlation'

// Automatic correlation ID injection
const response = await fetchWithCorrelation('/api/bookings')

// Manual correlation ID management
const { currentId, startNewRequest } = useCorrelationId()
const newId = startNewRequest() // Start fresh request trace
```

#### Backend
```typescript
// All functions should use monitoring middleware
export const handler = withMonitoring(async (event, context, monitoring) => {
  const { logger, correlationId } = monitoring
  
  logger.info('Processing request', {
    action: 'process-booking',
    metadata: { bookingId: 123 }
  })
  
  // Correlation ID automatically included in all logs
}, {
  enableLogging: true,
  enableErrorTracking: true
})
```

## Alert System

### Multi-Channel Alerting

The alert system supports multiple delivery channels with severity-based routing:

- **Webhook**: Primary alert channel (all severities)
- **Slack**: Visual alerts with formatting (all severities)
- **Email**: Detailed alerts for operations team (medium+)
- **SMS**: Critical alerts only (high/critical)

### Alert Configuration

```bash
# Webhook alerts (primary channel)
VITE_ALERT_WEBHOOK_URL=https://hooks.example.com/alerts

# Slack integration
VITE_ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/...

# Email recipients (comma-separated)
VITE_ALERT_EMAIL_RECIPIENTS=ops@salon.com,admin@salon.com

# SMS for critical alerts (comma-separated phone numbers)
VITE_ALERT_PHONE_NUMBERS=+1234567890,+0987654321

# Alert throttling (prevent spam)
VITE_ALERT_THROTTLE_MINUTES=15
```

### Alert Severities

| Severity | Response Time | Channels | Examples |
|----------|---------------|----------|----------|
| **Critical** | 15 minutes | All (webhook, Slack, email, SMS) | Service down, data loss |
| **High** | 1 hour | All (webhook, Slack, email, SMS) | Performance degradation |
| **Medium** | 4 hours | Webhook, Slack, Email | Warning thresholds exceeded |
| **Low** | 24 hours | Webhook, Email | Minor issues, maintenance |

### Alert Features

- **Deduplication**: Same alert fingerprint throttled for 15 minutes
- **Count Tracking**: Shows how many times alert has fired
- **Rich Context**: Includes correlation ID, component, metadata
- **Automatic Retry**: Failed alert deliveries are retried

### Testing Alerts

```bash
# Test alert system (requires JWT)
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"severity": "medium"}' \
  https://your-app.netlify.app/api/test-alert
```

## Metrics Collection

### Metrics Endpoint: `/api/metrics`

Provides operational metrics for monitoring and dashboards.

**Access**: JWT protected
**Response Format**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "system": {
      "uptime": 3600,
      "memoryUsage": {
        "used": 45,
        "total": 128,
        "percentage": 35
      },
      "nodeVersion": "v18.17.0",
      "environment": "production"
    },
    "alerts": {
      "totalAlerts": 12,
      "recentFingerprints": 3,
      "throttledAlerts": 8
    },
    "queue": {
      "totalItems": 2,
      "recentFailures": 0,
      "retryEligible": 1,
      "failureTypes": {
        "smtp_timeout": 1,
        "rate_limit": 1
      }
    },
    "budget": {
      "totalAlerts": 1,
      "criticalAlerts": 0,
      "warningAlerts": 1,
      "emailUsagePercent": 75,
      "smsUsagePercent": 20
    },
    "thresholds": {
      "dlqWarning": 5,
      "dlqCritical": 20,
      "budgetWarning": 80,
      "budgetCritical": 100,
      "responseTimeWarning": 2000,
      "responseTimeCritical": 5000
    }
  }
}
```

### Prometheus Integration

For Prometheus scraping, convert JSON metrics to exposition format:

```bash
# Custom metrics endpoint for Prometheus
# (implement custom /api/metrics/prometheus if needed)

# Example Prometheus metrics:
system_uptime_seconds 3600
system_memory_used_mb 45
system_memory_total_mb 128
alerts_total 12
alerts_throttled 8
dlq_items_total 2
dlq_failures_recent 0
budget_email_usage_percent 75
budget_sms_usage_percent 20
```

## Thresholds & Configuration

### Environment-Based Thresholds

All thresholds are configurable via environment variables:

```bash
# DLQ Thresholds
VITE_MONITORING_DLQ_WARNING=5          # Warning at 5 items
VITE_MONITORING_DLQ_CRITICAL=20        # Critical at 20 items

# Response Time Thresholds (milliseconds)
VITE_MONITORING_RESPONSE_TIME_WARNING=2000    # 2 seconds
VITE_MONITORING_RESPONSE_TIME_CRITICAL=5000   # 5 seconds

# Budget Thresholds (percentage)
# Warning at 80%, Critical at 100% (handled in code)

# Error Rate Thresholds (percentage)
VITE_MONITORING_ERROR_RATE_WARNING=1          # 1%
VITE_MONITORING_ERROR_RATE_CRITICAL=5         # 5%
```

### Rate Limiting Configuration

```bash
# Health endpoint rate limits
# /api/health: 60 requests per minute (public)
# /api/ready: 30 requests per minute (protected)
# /api/metrics: No specific limit (protected)

# Configure in middleware if needed:
# new RateLimiter(maxRequests, windowMs)
```

## Troubleshooting

### Common Issues

#### 1. Health Checks Failing
```bash
# Check individual endpoints
curl -v https://your-app.netlify.app/api/health
curl -v -H "Authorization: Bearer $JWT" https://your-app.netlify.app/api/ready

# Check logs for specific correlation ID
netlify logs | grep "correlation-id-here"
```

#### 2. Missing Correlation IDs
```bash
# Frontend: Ensure fetchWithCorrelation is used
# Backend: Ensure withMonitoring wrapper is used
# Check correlation headers in requests
```

#### 3. Alerts Not Firing
```bash
# Test alert system
curl -X POST -H "Authorization: Bearer $JWT" \
  -d '{"severity":"medium"}' \
  https://your-app.netlify.app/api/test-alert

# Check webhook URLs are accessible
curl -X POST $VITE_ALERT_WEBHOOK_URL -d '{"test":true}'
```

#### 4. High Log Volume
```bash
# Adjust sampling rates
VITE_LOG_SAMPLE_RATE=0.5              # 50% sampling
VITE_LOG_NOISY_SAMPLE_RATE=0.01       # 1% for noisy components
```

### Log Analysis

Search logs by correlation ID:
```bash
# Find all logs for a specific request
netlify logs | grep "abc-123-def"

# Find errors with correlation context
netlify logs | jq 'select(.level == "error") | .correlationId, .message'

# Check alert patterns
netlify logs | jq 'select(.component == "alert-manager")'
```

### Performance Monitoring

Monitor key metrics:
```bash
# Response times
netlify logs | jq 'select(.context.duration) | .context.duration'

# Error rates by component
netlify logs | jq 'select(.level == "error") | .context.component' | sort | uniq -c

# Memory usage trends
curl -H "Authorization: Bearer $JWT" \
  https://your-app.netlify.app/api/metrics | \
  jq '.data.system.memoryUsage'
```

## Best Practices

1. **Always Use Monitoring Middleware**: Wrap all Netlify functions with `withMonitoring`
2. **Correlation ID Consistency**: Use `fetchWithCorrelation` for all API calls
3. **Structured Logging**: Include relevant context in all log messages
4. **Alert Fatigue Prevention**: Set appropriate thresholds and throttling
5. **Regular Testing**: Test health endpoints and alert systems regularly
6. **Log Retention**: Monitor log volume and adjust sampling as needed
7. **Security**: Protect sensitive endpoints with JWT authentication