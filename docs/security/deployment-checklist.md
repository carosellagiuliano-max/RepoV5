# Security Hardening Deployment Checklist

## Pre-Deployment

### 1. Database Schema Deployment
Execute the security hardening schema in the correct order:

```bash
# Connect to your database
psql $DATABASE_URL

# Execute the security schema
\i docs/db/11_security_hardening_schema.sql

# Verify tables were created
\dt audit_logs
\dt idempotency_keys
\dt rate_limits
\dt data_retention_settings
\dt data_retention_jobs
```

### 2. Environment Variables Setup
Add the following environment variables to your deployment platform:

#### Required Variables
```bash
# Security Configuration
SECURITY_RATE_LIMIT_CUSTOMER_MAX=10
SECURITY_RATE_LIMIT_STAFF_MAX=50
SECURITY_RATE_LIMIT_ADMIN_MAX=100
SECURITY_RATE_LIMIT_WINDOW_SECONDS=60
SECURITY_IDEMPOTENCY_EXPIRATION_HOURS=24
SECURITY_AUDIT_LOG_ENABLED=true
SECURITY_CORRELATION_ID_ENABLED=true

# Data Retention Configuration
DATA_RETENTION_CLEANUP_ENABLED=true
DATA_RETENTION_CLEANUP_HOUR=2
DATA_RETENTION_MANUAL_REVIEW_REQUIRED=true

# Advanced Security Features
SECURITY_ABUSE_DETECTION_ENABLED=true
SECURITY_SUSPICIOUS_ACTIVITY_THRESHOLD=50
```

#### Optional Variables
```bash
# IP Whitelisting (comma-separated)
SECURITY_IP_WHITELIST=192.168.1.0/24,10.0.0.0/8

# Custom thresholds
SECURITY_RATE_LIMIT_ANONYMOUS_MAX=5
```

### 3. Scheduled Function Setup

#### Netlify
```bash
# Set up scheduled function for data retention (requires Netlify Pro)
# Add to netlify.toml:
[functions."data-retention-cleanup"]
  schedule = "0 2 * * *"  # Daily at 2 AM UTC
```

#### Alternative Cron Setup
```bash
# If not using Netlify scheduled functions, set up external cron:
# 0 2 * * * curl -X POST https://your-site.netlify.app/.netlify/functions/data-retention-cleanup
```

## Deployment Steps

### 1. Deploy Database Schema
```bash
# Backup current database first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Deploy security schema
psql $DATABASE_URL -f docs/db/11_security_hardening_schema.sql

# Verify deployment
psql $DATABASE_URL -c "SELECT COUNT(*) FROM data_retention_settings;"
```

### 2. Deploy Application Code
```bash
# Build and test locally first
npm run build
npm run test

# Deploy to staging
netlify deploy --dir=dist

# Test security endpoints in staging
curl -X POST https://staging-site.netlify.app/.netlify/functions/booking-create-secure \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"customer_id":"uuid","staff_id":"uuid","service_id":"uuid","starts_at":"2024-01-01T10:00:00Z","ends_at":"2024-01-01T11:00:00Z","price":5000}'

# Deploy to production
netlify deploy --prod --dir=dist
```

### 3. Verify Security Features

#### Test Rate Limiting
```bash
# Test customer rate limiting (should be blocked after 10 requests)
for i in {1..15}; do
  curl -s -w "%{http_code}\n" -X POST https://your-site.netlify.app/.netlify/functions/booking-create-secure \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"test":"data"}'
done
```

#### Test Idempotency
```bash
# Send the same request twice with same idempotency key
curl -X POST https://your-site.netlify.app/.netlify/functions/booking-create-secure \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Idempotency-Key: test-duplicate-123" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"test","staff_id":"test","service_id":"test","starts_at":"2024-01-01T10:00:00Z","ends_at":"2024-01-01T11:00:00Z","price":5000}'

# Second request should return cached response with X-Idempotent-Replay header
```

#### Test Audit Logging
```bash
# Check that audit logs are being created
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;"
```

## Post-Deployment

### 1. Monitor Initial Performance
```bash
# Check security middleware performance
curl -w "@curl-format.txt" -s -o /dev/null https://your-site.netlify.app/.netlify/functions/booking-create-secure

# Monitor database performance
psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements WHERE query LIKE '%audit_logs%' ORDER BY total_time DESC;"
```

### 2. Set Up Monitoring Alerts
Configure alerts for:
- High rate limiting violations
- Security middleware errors
- Data retention job failures
- Unusual audit log patterns

### 3. Initial Data Retention Job Test
```bash
# Manually trigger data retention job to test
curl -X POST https://your-site.netlify.app/.netlify/functions/data-retention-cleanup

# Check job execution
psql $DATABASE_URL -c "SELECT * FROM data_retention_jobs ORDER BY started_at DESC LIMIT 5;"
```

## Rollback Plan

### Quick Rollback (if issues occur)
```bash
# 1. Disable security features via environment variables
netlify env:set SECURITY_AUDIT_LOG_ENABLED false
netlify env:set DATA_RETENTION_CLEANUP_ENABLED false
netlify env:set SECURITY_ABUSE_DETECTION_ENABLED false

# 2. Revert to original booking functions
git checkout HEAD~1 -- netlify/functions/booking-create.ts
git checkout HEAD~1 -- netlify/functions/booking-cancel.ts
netlify deploy --prod

# 3. If database issues, disable RLS temporarily
psql $DATABASE_URL -c "ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;"
```

### Full Rollback (if major issues)
```bash
# 1. Restore database from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 2. Revert all code changes
git revert feaa1da

# 3. Deploy reverted version
netlify deploy --prod
```

## Maintainer To-Dos

### SQL Schema Maintenance
```sql
-- Monthly: Check table sizes and performance
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
  pg_stat_user_tables.n_tup_ins as inserts,
  pg_stat_user_tables.n_tup_del as deletes
FROM pg_tables 
JOIN pg_stat_user_tables ON pg_tables.tablename = pg_stat_user_tables.relname
WHERE tablename IN ('audit_logs', 'idempotency_keys', 'rate_limits')
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Quarterly: Analyze and optimize indexes
ANALYZE audit_logs;
ANALYZE idempotency_keys;
ANALYZE rate_limits;

-- Check for unused indexes
SELECT 
  indexrelname as index_name,
  relname as table_name,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
AND relname IN ('audit_logs', 'idempotency_keys', 'rate_limits')
ORDER BY idx_scan ASC;
```

### Environment Variable Management
```bash
# Quarterly: Review and update rate limits based on usage patterns
# Check current usage:
psql $DATABASE_URL -c "
SELECT 
  user_role,
  endpoint,
  AVG(count) as avg_requests,
  MAX(count) as max_requests
FROM rate_limits 
WHERE window_start >= NOW() - INTERVAL '30 days'
GROUP BY user_role, endpoint
ORDER BY max_requests DESC;
"

# Update limits if needed:
netlify env:set SECURITY_RATE_LIMIT_CUSTOMER_MAX 15  # Example increase
```

### Security Updates
```bash
# Monthly: Update security dependencies
npm audit
npm update

# Quarterly: Review security configuration
# Check for new security best practices
# Update documentation as needed
```

### Data Retention Policy Updates
```sql
-- Update retention periods if business requirements change
UPDATE data_retention_settings 
SET retention_days = 2190  -- 6 years instead of 7
WHERE resource_type = 'customer_data';

-- Enable auto-delete for previously manual review items (if approved)
UPDATE data_retention_settings 
SET auto_delete = true
WHERE resource_type = 'appointments' 
AND retention_days < 1095;  -- Less than 3 years
```

## Support Information

### Documentation Links
- [Security Hardening Guide](docs/security/security-hardening-guide.md)
- [Operational Playbook](docs/security/operational-playbook.md)
- [Database Schema](docs/db/11_security_hardening_schema.sql)

### Key Contacts
- **Security Lead**: [Contact Information]
- **Database Administrator**: [Contact Information]
- **DevOps Engineer**: [Contact Information]

### Emergency Procedures
- **Security Incident**: Follow [Incident Response Plan]
- **Database Issues**: Contact DBA immediately
- **Performance Problems**: Check operational playbook first

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________
**Next Review Date**: _______________