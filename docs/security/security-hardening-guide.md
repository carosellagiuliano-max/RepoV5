# Security & Compliance Hardening Documentation

## Overview

This document describes the comprehensive security hardening implementation for the Schnittwerk Your Style booking system. The security features include idempotency protection, rate limiting, audit logging, and GDPR compliance measures.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Idempotency Protection](#idempotency-protection)
3. [Rate Limiting](#rate-limiting)
4. [Audit Logging](#audit-logging)
5. [Data Retention & GDPR](#data-retention--gdpr)
6. [Security Middleware](#security-middleware)
7. [Operational Procedures](#operational-procedures)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Rollback Procedures](#rollback-procedures)

## Security Architecture

### Core Components

1. **Security Middleware (`src/lib/security/middleware.ts`)**
   - Unified security layer for all critical endpoints
   - Handles authentication, authorization, rate limiting, and audit logging
   - Provides correlation ID tracking for request tracing

2. **Database Security Schema (`docs/db/11_security_hardening_schema.sql`)**
   - Audit logs table with comprehensive event tracking
   - Idempotency keys table for duplicate request prevention
   - Rate limiting table for abuse prevention
   - Data retention settings and job tracking

3. **Scheduled Data Retention (`netlify/functions/data-retention-cleanup.ts`)**
   - GDPR-compliant automated data cleanup
   - Configurable retention policies per data type
   - Manual review flags for sensitive data

### Security Layers

```
┌─────────────────────────────────────┐
│           Client Request            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         CORS & Preflight            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Rate Limiting Check            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Authentication & RBAC          │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Idempotency Check              │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Business Logic Handler         │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Audit Logging                  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Response with Headers       │
└─────────────────────────────────────┘
```

## Idempotency Protection

### Purpose
Prevents duplicate processing of critical operations (booking creation, cancellation, payments) that could result in data inconsistency or duplicate charges.

### Implementation

#### Client-Side
```typescript
// Include idempotency key in request headers
const response = await fetch('/api/booking-create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Idempotency-Key': 'booking_2024_uuid_12345'
  },
  body: JSON.stringify(bookingData)
})
```

#### Server-Side
- Idempotency keys are stored with request hash for 24 hours
- Duplicate requests return cached response with `X-Idempotent-Replay: true` header
- Only successful responses (2xx) are cached

#### Key Generation Guidelines
- Use UUIDs or timestamp-based unique identifiers
- Include operation type in key for clarity: `booking_create_${uuid}`
- Client should retry with same key if request fails

### Configuration
```env
SECURITY_IDEMPOTENCY_EXPIRATION_HOURS=24
```

## Rate Limiting

### Purpose
Prevents abuse and ensures fair resource usage across different user roles.

### Implementation

#### Rate Limits by Role
- **Customers**: 10 requests/minute (stricter to prevent abuse)
- **Staff**: 50 requests/minute (moderate limits for operational needs)
- **Admins**: 100 requests/minute (higher limits for administrative tasks)
- **Anonymous**: 5 requests/minute (very strict for unauthenticated users)

#### Response Headers
```
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2024-01-15T10:31:00Z
Retry-After: 45
```

#### Rate Limit Keys
- Authenticated users: `user:{userId}:{endpoint}`
- Anonymous users: `ip:{ipAddress}:{endpoint}`

### Configuration
```env
SECURITY_RATE_LIMIT_CUSTOMER_MAX=10
SECURITY_RATE_LIMIT_STAFF_MAX=50
SECURITY_RATE_LIMIT_ADMIN_MAX=100
SECURITY_RATE_LIMIT_WINDOW_SECONDS=60
```

## Audit Logging

### Purpose
Provides complete audit trail for compliance, security monitoring, and debugging.

### Logged Events
- All admin actions (user management, settings changes)
- Critical customer operations (booking creation/cancellation)
- Authentication events (login, logout, failed attempts)
- Data access and modifications

### Audit Log Schema
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    user_id UUID,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Correlation ID Tracking
Every request receives a unique correlation ID for distributed tracing:
- Format: `req_{timestamp}_{random}`
- Included in response headers: `X-Correlation-ID`
- Used across all log entries for request tracking

### Configuration
```env
SECURITY_AUDIT_LOG_ENABLED=true
SECURITY_CORRELATION_ID_ENABLED=true
VITE_AUDIT_LOG_RETENTION_DAYS=3650
```

## Data Retention & GDPR

### Purpose
Ensures GDPR compliance through automated data lifecycle management.

### Retention Policies

| Data Type | Retention Period | Auto-Delete | Notes |
|-----------|-----------------|-------------|-------|
| Audit Logs | 10 years | Yes | Legal requirement |
| Customer Data | 7 years | No | Manual review required |
| Appointments | 7 years | No | Business records |
| Idempotency Keys | 30 days | Yes | Technical cleanup |
| Rate Limit Records | 7 days | Yes | Technical cleanup |

### Scheduled Cleanup Job
- Runs daily at 2:00 AM UTC
- Processes each data type according to retention settings
- Logs all cleanup activities for audit
- Sends alerts for manual review items

#### Manual Review Process
1. System flags customer data for review when retention period expires
2. Admin receives notification with customer details
3. Admin decides to:
   - Extend retention (with business justification)
   - Archive data (remove from active system)
   - Delete data (GDPR right to be forgotten)

### Configuration
```env
DATA_RETENTION_CLEANUP_ENABLED=true
DATA_RETENTION_CLEANUP_HOUR=2
DATA_RETENTION_MANUAL_REVIEW_REQUIRED=true
VITE_GDPR_RETENTION_DAYS=2555
```

## Security Middleware

### Usage Examples

#### Critical Operations (Booking, Payment)
```typescript
import { withCriticalOperationSecurity } from '../src/lib/security/middleware'

export const handler = withCriticalOperationSecurity(
  async (event, context) => {
    // Business logic here
    return { statusCode: 200, body: 'success' }
  },
  'booking_create', // Audit action
  'appointments'    // Resource type
)
```

#### Admin Operations
```typescript
import { withAdminSecurity } from '../src/lib/security/middleware'

export const handler = withAdminSecurity(
  async (event, context) => {
    // Admin-only business logic
    return { statusCode: 200, body: 'success' }
  },
  'user_create',
  'users'
)
```

#### Custom Security Configuration
```typescript
import { withSecurity } from '../src/lib/security/middleware'

export const handler = withSecurity(
  async (event, context) => {
    // Custom business logic
    return { statusCode: 200, body: 'success' }
  },
  {
    auth: { 
      required: true,
      allowedRoles: ['admin', 'staff']
    },
    rateLimit: {
      maxRequests: 30,
      windowSeconds: 60,
      skipForRoles: ['admin']
    },
    idempotency: {
      enabled: true,
      expirationHours: 24
    },
    audit: {
      enabled: true,
      action: 'custom_action',
      resourceType: 'custom_resource',
      logRequestBody: true
    }
  }
)
```

## Operational Procedures

### Daily Operations

#### 1. Monitor Security Logs
```sql
-- Check for suspicious activity
SELECT 
  action,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT user_role) as roles,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY action 
ORDER BY count DESC;
```

#### 2. Review Rate Limit Violations
```sql
-- Check for rate limit violations
SELECT 
  endpoint,
  user_role,
  COUNT(*) as violations,
  MAX(count) as max_requests
FROM rate_limits 
WHERE count > CASE 
  WHEN user_role = 'admin' THEN 100
  WHEN user_role = 'staff' THEN 50
  WHEN user_role = 'customer' THEN 10
  ELSE 5
END
AND window_start >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint, user_role
ORDER BY violations DESC;
```

#### 3. Check Data Retention Job Status
```sql
-- Review recent cleanup jobs
SELECT 
  resource_type,
  status,
  records_processed,
  records_deleted,
  started_at,
  completed_at,
  error_message
FROM data_retention_jobs 
WHERE started_at >= NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;
```

### Weekly Operations

#### 1. Security Health Check
- Review audit log patterns for anomalies
- Check idempotency key usage patterns
- Verify data retention job execution
- Review failed authentication attempts

#### 2. Performance Monitoring
- Monitor security middleware response times
- Check database performance for security tables
- Review rate limiting effectiveness

### Monthly Operations

#### 1. Security Review
- Analyze long-term security trends
- Review and update rate limiting thresholds
- Assess data retention policy effectiveness
- Update security documentation

#### 2. Compliance Audit
- Generate compliance reports for audit logs
- Review GDPR data retention compliance
- Document security incident responses

## Monitoring & Alerting

### Key Metrics to Monitor

#### 1. Security Events
- Authentication failure rate
- Rate limit violation frequency
- Suspicious activity patterns
- Data retention job failures

#### 2. Performance Metrics
- Security middleware latency
- Database query performance
- Memory usage for rate limiting
- Audit log storage growth

### Alerting Thresholds

#### Critical Alerts
- Data retention job failures
- Authentication system outages
- Audit logging failures
- Mass account lockouts

#### Warning Alerts
- High rate limit violation rates
- Unusual audit log patterns
- Slow security middleware response
- Approaching storage limits

### Alert Configuration
```env
SECURITY_SUSPICIOUS_ACTIVITY_THRESHOLD=50
SECURITY_ABUSE_DETECTION_ENABLED=true
```

## Rollback Procedures

### Security Middleware Rollback

#### 1. Immediate Rollback (< 30 minutes)
```bash
# Disable security middleware by reverting to original functions
cp netlify/functions/booking-create.ts netlify/functions/booking-create-secure.ts.backup
cp netlify/functions/booking-create-original.ts netlify/functions/booking-create.ts
netlify deploy --prod
```

#### 2. Database Schema Rollback
```sql
-- Disable RLS policies if causing issues
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;

-- Remove foreign key constraints if needed
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
```

#### 3. Environment Variable Rollback
```bash
# Disable security features via environment variables
netlify env:set SECURITY_AUDIT_LOG_ENABLED false
netlify env:set DATA_RETENTION_CLEANUP_ENABLED false
netlify env:set SECURITY_ABUSE_DETECTION_ENABLED false
```

### Partial Feature Rollback

#### Disable Specific Security Features
```typescript
// In middleware configuration
export const handler = withSecurity(handler, {
  auth: { required: true },
  rateLimit: undefined, // Disable rate limiting
  idempotency: { enabled: false }, // Disable idempotency
  audit: { enabled: false } // Disable audit logging
})
```

### Data Recovery

#### 1. Audit Log Recovery
```sql
-- Backup audit logs before rollback
CREATE TABLE audit_logs_backup AS SELECT * FROM audit_logs;

-- Restore from backup if needed
INSERT INTO audit_logs SELECT * FROM audit_logs_backup 
ON CONFLICT (id) DO NOTHING;
```

#### 2. Idempotency Key Recovery
```sql
-- Clean up orphaned idempotency keys
DELETE FROM idempotency_keys 
WHERE expires_at < NOW() - INTERVAL '7 days';
```

### Testing Rollback Procedures

#### 1. Staging Environment Testing
- Test rollback procedures monthly in staging
- Verify data integrity after rollback
- Document any issues and update procedures

#### 2. Production Rollback Checklist
1. [ ] Notify stakeholders of rollback
2. [ ] Backup current database state
3. [ ] Execute rollback steps in order
4. [ ] Verify system functionality
5. [ ] Monitor for issues post-rollback
6. [ ] Document lessons learned

### Emergency Contacts

#### Security Incident Response
- **Primary**: System Administrator
- **Secondary**: Development Team Lead
- **Escalation**: CTO/Technical Director

#### Data Protection Officer
- **Contact**: [DPO Contact Information]
- **Role**: GDPR compliance oversight
- **Availability**: Business hours

## Conclusion

This security hardening implementation provides comprehensive protection for the Schnittwerk Your Style booking system while maintaining operational efficiency and GDPR compliance. Regular monitoring and maintenance of these security features ensures ongoing protection against evolving threats and compliance requirements.