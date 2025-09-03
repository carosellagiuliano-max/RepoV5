# Operational Runbooks

This document contains operational procedures for monitoring, troubleshooting, and maintaining the Schnittwerk Your Style salon booking system.

## Table of Contents

- [Overview](#overview)
- [Monitoring & Alerting](#monitoring--alerting)
- [Common Issues & Solutions](#common-issues--solutions)
- [Webhook Failures](#webhook-failures)
- [SMTP Service Down](#smtp-service-down)
- [Rate Limit Hits](#rate-limit-hits)
- [Dead Letter Queue (DLQ) Growing](#dead-letter-queue-dlq-growing)
- [Database Performance Issues](#database-performance-issues)
- [Storage Issues](#storage-issues)
- [Security Incidents](#security-incidents)
- [Scheduled Maintenance](#scheduled-maintenance)
- [Escalation Procedures](#escalation-procedures)

## Overview

These runbooks provide step-by-step procedures for common operational scenarios. Each runbook includes:

- **Symptoms**: How to identify the issue
- **Immediate Actions**: First steps to take
- **Investigation**: How to diagnose the root cause
- **Resolution**: Steps to fix the issue
- **Prevention**: How to prevent recurrence
- **Escalation**: When and how to escalate

### Alert Severity Levels

| Level | Response Time | Description |
|-------|---------------|-------------|
| **P0 - Critical** | 15 minutes | Service unavailable, data loss risk |
| **P1 - High** | 1 hour | Degraded service, customer impact |
| **P2 - Medium** | 4 hours | Minor issues, internal impact |
| **P3 - Low** | 24 hours | Maintenance, improvements |

## Monitoring & Alerting

### Key Metrics & Thresholds

| Metric | Warning | Critical | Check Frequency |
|--------|---------|----------|-----------------|
| Response Time | >2s | >5s | 1 minute |
| Error Rate | >1% | >5% | 1 minute |
| Database Connections | >80% | >95% | 5 minutes |
| Storage Usage | >80% | >95% | 15 minutes |
| DLQ Items | >5 | >20 | 5 minutes |
| Budget Usage | >80% | >100% | Hourly |
| Memory Usage | >80% | >95% | 5 minutes |

### Health Check Endpoints

#### Lightweight Health Check: `/api/health`
- **Purpose**: Fast liveness probe for load balancers
- **Access**: Public (rate-limited: 60 req/min)
- **Response Time**: <200ms
- **Returns**: Basic system info, uptime, memory usage
- **Status Codes**: 200 (healthy), 429 (rate limited)

#### Comprehensive Readiness Check: `/api/ready`
- **Purpose**: Deep dependency validation
- **Access**: JWT protected (30 req/min)
- **Response Time**: <3s
- **Checks**: Database, SMTP, SMS, Storage, DLQ, Budget
- **Status Codes**: 200 (ready), 503 (not ready), 401 (unauthorized)

#### Metrics Endpoint: `/api/metrics`
- **Purpose**: Operational metrics for monitoring
- **Access**: JWT protected
- **Returns**: System metrics, alert stats, DLQ/budget status
- **Use**: Prometheus scraping, dashboards

### Alert Channels

#### Severity Routing
- **Critical/High**: Webhook + Slack + SMS (for high/critical only)
- **Medium**: Webhook + Slack + Email
- **Low**: Webhook + Email

#### Configuration
```bash
# Webhook alerts (primary)
VITE_ALERT_WEBHOOK_URL=https://hooks.example.com/alerts

# Slack integration
VITE_ALERT_SLACK_WEBHOOK=https://hooks.slack.com/...

# Email recipients (comma-separated)
VITE_ALERT_EMAIL_RECIPIENTS=ops@salon.com,admin@salon.com

# SMS for critical alerts (comma-separated)
VITE_ALERT_PHONE_NUMBERS=+1234567890,+0987654321

# Alert throttling (minutes)
VITE_ALERT_THROTTLE_MINUTES=15
```
| Failed Webhooks | >5/hour | >20/hour | 5 minutes |
| Budget Usage | >80% | >95% | 1 hour |
| SMTP Queue | >50 | >200 | 5 minutes |

### Health Check Monitoring

```bash
# Monitor health endpoint
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.status'

# Automated monitoring script
#!/bin/bash
HEALTH_URL="https://your-site.netlify.app/.netlify/functions/health"
RESPONSE=$(curl -s -w "%{http_code}" "$HEALTH_URL")
HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Health check failed: HTTP $HTTP_CODE"
  echo "$BODY" | jq .
  # Send alert
  curl -X POST "$SLACK_WEBHOOK" \
    -d "{\"text\": \"🚨 Health check failed: HTTP $HTTP_CODE\"}"
else
  STATUS=$(echo "$BODY" | jq -r '.status')
  if [ "$STATUS" != "healthy" ]; then
    echo "⚠️ Health check warning: $STATUS"
    echo "$BODY" | jq '.checks'
  fi
fi
```

## Monitoring System Issues

### Health Check Failures

#### Symptoms
- Health checks returning 503 status
- Alerts about service unavailability
- Load balancer removing instances

#### Investigation
1. Check individual dependency health:
```bash
# Test lightweight health check
curl -H "X-Correlation-Id: test-$(date +%s)" https://app.netlify.app/api/health

# Test comprehensive health check (requires JWT)
curl -H "Authorization: Bearer $JWT_TOKEN" \
     -H "X-Correlation-Id: test-$(date +%s)" \
     https://app.netlify.app/api/ready
```

2. Review logs for correlation ID:
```bash
netlify logs | grep "test-$(date +%s)"
```

3. Check individual dependencies:
- Database: Query execution time and connection pool
- SMTP: Test email sending capability
- Storage: Bucket accessibility and permissions
- DLQ: Check message counts and failure rates

#### Resolution
1. **Database Issues**: Check Supabase status, connection limits
2. **SMTP Issues**: Verify credentials, test connection
3. **Storage Issues**: Check Supabase Storage bucket permissions
4. **DLQ Issues**: Process stuck messages, check notification service

### Alert System Not Working

#### Symptoms
- No alerts received despite known issues
- Alerts delayed or missing
- Partial alert delivery

#### Investigation
1. Test alert system:
```bash
# Simulate test alert (requires JWT)
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"severity": "medium"}' \
     https://app.netlify.app/api/test-alert
```

2. Check alert configuration:
```bash
# Verify environment variables
echo $VITE_ALERT_WEBHOOK_URL
echo $VITE_ALERT_SLACK_WEBHOOK
echo $VITE_ALERT_EMAIL_RECIPIENTS
```

3. Review alert throttling:
- Check if alerts are being throttled (same fingerprint within 15 min)
- Review alert statistics via `/api/metrics`

#### Resolution
1. **Webhook Issues**: Test webhook URL manually
2. **Slack Issues**: Regenerate Slack webhook if needed
3. **Email Issues**: Check SMTP configuration
4. **Throttling Issues**: Adjust `VITE_ALERT_THROTTLE_MINUTES`

### Correlation ID Not Propagating

#### Symptoms
- Logs missing correlation IDs
- Unable to trace requests end-to-end
- Inconsistent correlation IDs across services

#### Investigation
1. Test correlation ID flow:
```bash
# Send request with known correlation ID
CORRELATION_ID="test-$(date +%s)"
curl -H "X-Correlation-Id: $CORRELATION_ID" \
     https://app.netlify.app/api/health

# Check if same ID appears in response
```

2. Review frontend implementation:
- Check if correlation headers are added to requests
- Verify correlation manager is initialized

3. Check backend logging:
- Ensure all functions use monitoring middleware
- Verify correlation ID extraction in logs

#### Resolution
1. **Frontend**: Ensure `fetchWithCorrelation` is used for API calls
2. **Backend**: Use `withMonitoring` wrapper for all functions
3. **Logging**: Verify logger uses correlation ID from context


### Issue: High Response Times

**Symptoms**:
- Health check reports response times >2s
- Customer complaints about slow loading
- Increased bounce rate

**Immediate Actions**:
1. Check health endpoint: `/api/health`
2. Review recent deployments
3. Check database performance

**Investigation**:
```bash
# Check current performance
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.checks'

# Review Netlify function logs
netlify functions:logs --name=health

# Check database performance
psql "$DATABASE_URL" -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

**Resolution**:
1. **Database optimization**:
   ```sql
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_date 
   ON bookings(appointment_date);
   
   -- Update table statistics
   ANALYZE bookings;
   ```

2. **Function optimization**:
   - Review and optimize slow queries
   - Add caching where appropriate
   - Consider connection pooling

**Prevention**:
- Regular performance monitoring
- Database maintenance schedule
- Load testing before deployments

---

## Webhook Failures

### Issue: Webhook Processing Failures

**Symptoms**:
- DLQ items increasing
- Customers not receiving notifications
- Payment webhooks failing

**Immediate Actions**:
1. Check webhook health in dashboard
2. Review recent webhook events
3. Verify external service status

**Investigation**:
```bash
# Check recent webhook failures
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.checks.queue'

# Review webhook logs
netlify functions:logs --name=twilio-webhook
netlify functions:logs --name=stripe-webhook

# Check specific webhook events in database
psql "$DATABASE_URL" -c "
SELECT 
  event_type,
  status,
  error_message,
  created_at
FROM webhook_events 
WHERE created_at >= NOW() - INTERVAL '1 hour'
AND status = 'failed'
ORDER BY created_at DESC;"
```

**Resolution Steps**:

1. **Identify Failed Webhooks**:
   ```sql
   -- Get details of failed webhooks
   SELECT 
     id,
     event_type,
     payload,
     error_message,
     retry_count,
     created_at
   FROM webhook_events 
   WHERE status = 'failed'
   AND retry_count < 3
   ORDER BY created_at DESC
   LIMIT 20;
   ```

2. **Manual Retry**:
   ```bash
   # Retry specific webhook via API
   curl -X POST "https://your-site.netlify.app/.netlify/functions/webhooks/retry" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"webhook_id": "webhook_123"}'
   ```

3. **Fix Common Issues**:
   - **Timeout errors**: Increase function timeout
   - **Rate limiting**: Implement exponential backoff
   - **Invalid payload**: Validate webhook signature
   - **External service down**: Queue for later retry

4. **Bulk Retry from DLQ**:
   ```bash
   # Retry all eligible items in DLQ
   curl -X POST "https://your-site.netlify.app/.netlify/functions/admin/dlq/retry-all" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

**Prevention**:
- Implement robust error handling
- Add webhook signature validation
- Monitor external service status
- Set up proper retry mechanisms

---

## SMTP Service Down

### Issue: Email Delivery Failures

**Symptoms**:
- Email notifications not being sent
- SMTP health check failing
- Customer complaints about missing emails

**Immediate Actions**:
1. Verify SMTP service status
2. Check credentials and configuration
3. Switch to backup provider if available

**Investigation**:
```bash
# Test SMTP connectivity
telnet $SMTP_HOST $SMTP_PORT

# Check SMTP health
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.checks.smtp'

# Review email queue
psql "$DATABASE_URL" -c "
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM notification_queue 
WHERE channel = 'email'
GROUP BY status;"
```

**Resolution Steps**:

1. **Verify SMTP Configuration**:
   ```bash
   # Test SMTP settings
   npm install -g nodemailer
   node -e "
   const nodemailer = require('nodemailer');
   const transporter = nodemailer.createTransporter({
     host: process.env.SMTP_HOST,
     port: process.env.SMTP_PORT,
     auth: {
       user: process.env.SMTP_USERNAME,
       pass: process.env.SMTP_PASSWORD
     }
   });
   transporter.verify().then(console.log).catch(console.error);
   "
   ```

2. **Check Provider Status**:
   - Visit provider status page
   - Check for service announcements
   - Verify account status and limits

3. **Fallback Options**:
   ```bash
   # Switch to backup SMTP provider
   netlify env:set SMTP_HOST backup-smtp.provider.com
   netlify env:set SMTP_USERNAME backup_user
   netlify env:set SMTP_PASSWORD backup_password
   
   # Redeploy to apply changes
   netlify deploy --prod
   ```

4. **Process Queued Emails**:
   ```sql
   -- Retry failed emails
   UPDATE notification_queue 
   SET status = 'pending', retry_count = 0, error_message = NULL
   WHERE channel = 'email' 
   AND status = 'failed'
   AND created_at >= NOW() - INTERVAL '24 hours';
   ```

**Prevention**:
- Configure backup SMTP provider
- Monitor SMTP service status
- Implement email queue with retry logic
- Set up SMTP provider alerts

---

## Rate Limit Hits

### Issue: API Rate Limits Exceeded

**Symptoms**:
- HTTP 429 responses
- Failed API calls to external services
- Degraded user experience

**Immediate Actions**:
1. Identify which service is rate limiting
2. Review current usage patterns
3. Implement temporary backoff

**Investigation**:
```bash
# Check recent rate limit errors
netlify functions:logs | grep -i "rate limit\|429\|too many requests"

# Review API usage patterns
psql "$DATABASE_URL" -c "
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  service_name,
  COUNT(*) as api_calls,
  SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) as rate_limited
FROM api_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour, service_name
ORDER BY hour DESC, rate_limited DESC;"
```

**Resolution Steps**:

1. **Immediate Relief**:
   ```javascript
   // Implement exponential backoff
   async function apiCallWithBackoff(apiCall, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         return await apiCall();
       } catch (error) {
         if (error.status === 429 && attempt < maxRetries - 1) {
           const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         throw error;
       }
     }
   }
   ```

2. **Service-Specific Solutions**:

   **Stripe Rate Limits**:
   ```javascript
   // Implement request queuing
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
     maxNetworkRetries: 3,
     timeout: 30000
   });
   ```

   **Twilio Rate Limits**:
   ```javascript
   // Batch SMS sending
   const batchSize = 5; // Twilio allows 5 requests/second
   const delay = 1000; // 1 second between batches
   
   async function sendBatchSMS(messages) {
     for (let i = 0; i < messages.length; i += batchSize) {
       const batch = messages.slice(i, i + batchSize);
       await Promise.all(batch.map(sendSMS));
       if (i + batchSize < messages.length) {
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

3. **Long-term Solutions**:
   - Upgrade to higher rate limit tiers
   - Implement request caching
   - Optimize API call patterns
   - Consider batch processing

**Prevention**:
- Monitor API usage trends
- Implement rate limiting middleware
- Set up usage alerts
- Plan for traffic spikes

---

## Dead Letter Queue (DLQ) Growing

### Issue: Increasing Failed Message Count

**Symptoms**:
- Health check shows growing DLQ
- Notifications not being delivered
- High failure rate in metrics

**Immediate Actions**:
1. Check DLQ size and growth rate
2. Identify common failure patterns
3. Stop the source of failures if possible

**Investigation**:
```bash
# Check DLQ status
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.checks.queue'

# Analyze failure patterns
psql "$DATABASE_URL" -c "
SELECT 
  failure_type,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM dead_letter_queue 
GROUP BY failure_type
ORDER BY count DESC;"

# Check recent failures
psql "$DATABASE_URL" -c "
SELECT 
  id,
  original_payload,
  failure_type,
  error_message,
  failure_count,
  created_at
FROM dead_letter_queue 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;"
```

**Resolution Steps**:

1. **Categorize Failures**:
   ```sql
   -- Group by error types
   SELECT 
     CASE 
       WHEN error_message LIKE '%timeout%' THEN 'timeout'
       WHEN error_message LIKE '%rate limit%' THEN 'rate_limit'
       WHEN error_message LIKE '%authentication%' THEN 'auth_error'
       WHEN error_message LIKE '%validation%' THEN 'validation_error'
       ELSE 'other'
     END as error_category,
     COUNT(*) as count
   FROM dead_letter_queue 
   GROUP BY error_category;
   ```

2. **Fix Root Causes**:

   **Timeout Issues**:
   ```javascript
   // Increase timeout for external calls
   const client = axios.create({
     timeout: 30000, // 30 seconds
     retry: 3
   });
   ```

   **Validation Errors**:
   ```javascript
   // Add input validation
   const schema = z.object({
     email: z.string().email(),
     phone: z.string().regex(/^\+?[1-9]\d{1,14}$/)
   });
   
   try {
     const validData = schema.parse(inputData);
   } catch (error) {
     logger.error('Validation failed', error);
     return; // Don't add to DLQ
   }
   ```

3. **Batch Processing DLQ**:
   ```bash
   # Process DLQ items in batches
   curl -X POST "https://your-site.netlify.app/.netlify/functions/admin/dlq/process" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"batch_size": 10, "failure_types": ["timeout", "rate_limit"]}'
   ```

4. **Manual Intervention**:
   ```sql
   -- Remove invalid entries that can't be processed
   DELETE FROM dead_letter_queue 
   WHERE failure_type = 'validation_error'
   AND error_message LIKE '%invalid email format%'
   AND created_at < NOW() - INTERVAL '7 days';
   
   -- Retry specific items
   UPDATE dead_letter_queue 
   SET status = 'pending', retry_scheduled_at = NOW()
   WHERE failure_type = 'timeout'
   AND failure_count < 3;
   ```

**Prevention**:
- Implement better input validation
- Add circuit breakers for external services
- Monitor DLQ size with alerts
- Regular DLQ cleanup processes

---

## Database Performance Issues

### Issue: Slow Database Queries

**Symptoms**:
- High database response times
- Connection pool exhaustion
- Application timeouts

**Immediate Actions**:
1. Check database performance metrics
2. Identify slow queries
3. Check connection pool status

**Investigation**:
```sql
-- Check current activity
SELECT 
  pid,
  state,
  query_start,
  LEFT(query, 100) as query_snippet
FROM pg_stat_activity 
WHERE state = 'active'
ORDER BY query_start;

-- Find slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  (total_time/calls) as avg_time_ms
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check for blocking queries
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Resolution Steps**:

1. **Kill Problematic Queries**:
   ```sql
   -- Terminate long-running queries
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   AND query_start < NOW() - INTERVAL '5 minutes'
   AND query NOT LIKE '%pg_stat_activity%';
   ```

2. **Add Missing Indexes**:
   ```sql
   -- Identify missing indexes
   SELECT 
     schemaname,
     tablename,
     attname,
     n_distinct,
     correlation
   FROM pg_stats 
   WHERE schemaname = 'public'
   AND n_distinct > 100
   ORDER BY n_distinct DESC;
   
   -- Create indexes for frequent queries
   CREATE INDEX CONCURRENTLY idx_bookings_customer_date 
   ON bookings(customer_id, appointment_date);
   
   CREATE INDEX CONCURRENTLY idx_notifications_status_created 
   ON notifications(status, created_at);
   ```

3. **Optimize Queries**:
   ```sql
   -- Example: Optimize booking search
   -- Before: Sequential scan
   SELECT * FROM bookings WHERE appointment_date >= '2024-01-01';
   
   -- After: Use index with proper filtering
   SELECT b.*, c.name as customer_name 
   FROM bookings b
   JOIN customers c ON b.customer_id = c.id
   WHERE b.appointment_date >= '2024-01-01'
   AND b.appointment_date < '2024-02-01'
   ORDER BY b.appointment_date;
   ```

4. **Database Maintenance**:
   ```sql
   -- Update table statistics
   ANALYZE;
   
   -- Vacuum tables to reclaim space
   VACUUM ANALYZE bookings;
   VACUUM ANALYZE customers;
   
   -- Reindex if needed
   REINDEX TABLE bookings;
   ```

**Prevention**:
- Regular VACUUM and ANALYZE
- Monitor query performance
- Add appropriate indexes
- Set up query monitoring alerts

---

## Storage Issues

### Issue: Storage Space Running Low

**Symptoms**:
- Storage usage >80%
- Upload failures
- Backup failures

**Immediate Actions**:
1. Check current storage usage
2. Identify large files or growth patterns
3. Free up space if critical

**Investigation**:
```bash
# Check Supabase storage usage
curl -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/bucket/salon-media/usage"

# Database storage analysis
psql "$DATABASE_URL" -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;"
```

**Resolution Steps**:

1. **Clean Up Old Files**:
   ```sql
   -- Identify old uploads
   SELECT 
     name,
     size,
     created_at,
     updated_at
   FROM storage.objects 
   WHERE bucket_id = 'salon-media'
   AND created_at < NOW() - INTERVAL '1 year'
   ORDER BY size DESC;
   
   -- Delete old temporary files
   DELETE FROM storage.objects 
   WHERE bucket_id = 'salon-media'
   AND name LIKE 'temp/%'
   AND created_at < NOW() - INTERVAL '7 days';
   ```

2. **Archive Old Data**:
   ```sql
   -- Archive old bookings
   CREATE TABLE bookings_archive AS 
   SELECT * FROM bookings 
   WHERE appointment_date < NOW() - INTERVAL '2 years';
   
   DELETE FROM bookings 
   WHERE appointment_date < NOW() - INTERVAL '2 years';
   ```

3. **Optimize Storage**:
   ```sql
   -- Compress images (application level)
   -- Implement image optimization in upload process
   
   -- Remove duplicate files
   WITH duplicates AS (
     SELECT name, size, COUNT(*) as count
     FROM storage.objects
     WHERE bucket_id = 'salon-media'
     GROUP BY name, size
     HAVING COUNT(*) > 1
   )
   DELETE FROM storage.objects
   WHERE id IN (
     SELECT MIN(id) FROM storage.objects o
     JOIN duplicates d ON o.name = d.name AND o.size = d.size
     GROUP BY o.name, o.size
   );
   ```

4. **Upgrade Storage Plan**:
   - Contact Supabase to increase storage limits
   - Consider implementing CDN for static assets
   - Implement file lifecycle policies

**Prevention**:
- Set up storage monitoring alerts
- Implement automatic cleanup policies
- Regular storage usage reviews
- File size limits on uploads

---

## Security Incidents

### Issue: Suspected Security Breach

**Symptoms**:
- Unusual login patterns
- Unauthorized data access
- Suspicious API calls
- Security alerts from monitoring tools

**Immediate Actions** (P0 - Critical):
1. **Do not panic** - follow the procedure
2. Preserve evidence
3. Assess the scope
4. Contain the threat

**Investigation**:
```sql
-- Check recent login attempts
SELECT 
  user_id,
  ip_address,
  user_agent,
  success,
  created_at
FROM auth_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Review audit logs
SELECT 
  user_id,
  action,
  resource_type,
  resource_id,
  ip_address,
  created_at
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
AND action IN ('delete', 'update', 'create')
ORDER BY created_at DESC;

-- Check for privilege escalations
SELECT 
  user_id,
  old_role,
  new_role,
  changed_by,
  created_at
FROM role_changes 
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Response Steps**:

1. **Immediate Containment**:
   ```sql
   -- Disable suspicious user accounts
   UPDATE profiles 
   SET is_active = false 
   WHERE id IN ('user_id_1', 'user_id_2');
   
   -- Revoke active sessions
   DELETE FROM user_sessions 
   WHERE user_id IN ('user_id_1', 'user_id_2');
   ```

2. **Change Credentials**:
   ```bash
   # Rotate API keys
   netlify env:set SUPABASE_SERVICE_ROLE_KEY new_service_key
   netlify env:set JWT_SECRET new_jwt_secret_min_32_chars
   netlify env:set STRIPE_SECRET_KEY new_stripe_secret
   
   # Deploy changes
   netlify deploy --prod
   ```

3. **Review and Patch**:
   - Check for unauthorized code changes
   - Review access controls and permissions
   - Update dependencies with security fixes
   - Implement additional monitoring

4. **Communication**:
   - Notify affected customers if data was accessed
   - Report to relevant authorities if required
   - Document the incident for future reference

**Prevention**:
- Regular security audits
- Implement 2FA for admin accounts
- Monitor suspicious activity patterns
- Keep dependencies updated
- Regular penetration testing

---

## Scheduled Maintenance

### Weekly Maintenance Checklist

**Every Sunday 02:00 UTC**:

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance..."

# 1. Database maintenance
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"
psql "$DATABASE_URL" -c "REINDEX DATABASE;"

# 2. Clean up old logs
psql "$DATABASE_URL" -c "
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';"

# 3. Clean up temporary files
psql "$DATABASE_URL" -c "
DELETE FROM storage.objects 
WHERE bucket_id = 'salon-media'
AND name LIKE 'temp/%'
AND created_at < NOW() - INTERVAL '7 days';"

# 4. Update statistics
psql "$DATABASE_URL" -c "
UPDATE system_stats 
SET last_maintenance = NOW()
WHERE stat_type = 'maintenance';"

# 5. Backup validation
./test-backup-restore.sh

# 6. Health check validation
HEALTH_STATUS=$(curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq -r '.status')
if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "❌ Health check failed after maintenance"
  exit 1
fi

echo "✅ Weekly maintenance completed successfully"
```

### Monthly Maintenance Checklist

**First Sunday of each month**:

- [ ] Review and update dependencies
- [ ] Security audit and vulnerability scan
- [ ] Performance analysis and optimization
- [ ] Backup testing and validation
- [ ] Capacity planning review
- [ ] Documentation updates

---

## Escalation Procedures

### When to Escalate

| Scenario | Auto-Escalate After | Manual Escalation |
|----------|-------------------|-------------------|
| Service completely down | 15 minutes | Immediately |
| Database unavailable | 30 minutes | If data loss risk |
| Critical security incident | Immediately | Always |
| Data corruption detected | Immediately | Always |
| Payment processing down | 1 hour | Business hours |

### Escalation Contacts

**Technical Escalation**:
1. **Technical Lead**: [Name] - [Phone] - [Email]
2. **DevOps Engineer**: [Name] - [Phone] - [Email]
3. **Database Administrator**: [Name] - [Phone] - [Email]

**Business Escalation**:
1. **Operations Manager**: [Name] - [Phone] - [Email]
2. **Business Owner**: [Name] - [Phone] - [Email]

**Vendor Support**:
- **Supabase Support**: support@supabase.com (Pro Support)
- **Netlify Support**: support@netlify.com (Business Support)
- **Stripe Support**: https://support.stripe.com

### Escalation Templates

**Email Template**:
```
Subject: [P0/P1/P2/P3] - [Brief Description] - [System Name]

Issue: [Detailed description]
Impact: [Customer/business impact]
Started: [Timestamp]
Current Status: [What's been tried]
Next Steps: [Planned actions]
ETA: [Expected resolution time]

Correlation ID: [ID for tracking]
Runbook: [Link to relevant runbook]
```

**Slack Alert**:
```
🚨 [P0] Production Issue
System: Salon Booking System
Issue: Database connection failures
Impact: Customers cannot make bookings
Started: 2024-01-01 14:30 UTC
Owner: @tech-lead
Status: Investigating
```

---

## Appendix

### Useful Commands

```bash
# Quick health check
curl -s "https://your-site.netlify.app/.netlify/functions/health" | jq '.status'

# Check recent logs
netlify functions:logs --name=health | tail -50

# Database quick status
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"

# Check storage usage
du -sh /var/log/* | sort -h

# Test SMTP
echo "Test email" | mail -s "Test" test@example.com
```

### Common Error Patterns

```bash
# Find rate limit errors
grep -i "rate limit\|429\|too many" /var/log/app.log

# Find database connection errors
grep -i "connection\|timeout\|database" /var/log/app.log

# Find memory issues
grep -i "out of memory\|oom\|killed" /var/log/syslog
```

---

*Last Updated: [DATE]*
*Next Review: [DATE]*