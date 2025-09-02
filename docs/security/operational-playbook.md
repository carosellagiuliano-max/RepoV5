# Security Operations Playbook

## Quick Reference

### Emergency Contacts
- **Security Incidents**: System Administrator
- **Database Issues**: Database Administrator  
- **GDPR Compliance**: Data Protection Officer
- **Escalation**: CTO/Technical Director

### Critical Commands

#### Disable Security Features (Emergency)
```bash
# Stop data retention cleanup
netlify env:set DATA_RETENTION_CLEANUP_ENABLED false

# Disable audit logging
netlify env:set SECURITY_AUDIT_LOG_ENABLED false

# Disable rate limiting for all roles
netlify env:set SECURITY_RATE_LIMIT_CUSTOMER_MAX 1000
netlify env:set SECURITY_RATE_LIMIT_STAFF_MAX 1000
netlify env:set SECURITY_RATE_LIMIT_ADMIN_MAX 1000
```

#### Check System Health
```sql
-- Check audit log health
SELECT COUNT(*) as log_count, MAX(created_at) as latest_log 
FROM audit_logs WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Check rate limiting status
SELECT endpoint, user_role, COUNT(*) as requests 
FROM rate_limits WHERE window_start >= NOW() - INTERVAL '1 hour'
GROUP BY endpoint, user_role ORDER BY requests DESC;

-- Check data retention job status
SELECT * FROM data_retention_jobs 
WHERE started_at >= NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;
```

## Daily Operations

### Morning Checklist (10 minutes)
1. **Check overnight security alerts**
   - Review failed authentication attempts
   - Check for rate limiting violations
   - Verify data retention job completion

2. **Review audit logs**
   ```sql
   SELECT action, COUNT(*) as count, user_role
   FROM audit_logs 
   WHERE created_at >= NOW() - INTERVAL '24 hours'
   GROUP BY action, user_role
   ORDER BY count DESC;
   ```

3. **Monitor system performance**
   - Check security middleware response times
   - Verify database query performance
   - Review error rates

### Incident Response

#### High Rate Limit Violations
1. **Identify the source**
   ```sql
   SELECT key, endpoint, count, user_role, window_start
   FROM rate_limits 
   WHERE count > 50 AND window_start >= NOW() - INTERVAL '1 hour'
   ORDER BY count DESC;
   ```

2. **Take action**
   - Block IP if malicious activity detected
   - Contact user if legitimate high usage
   - Adjust rate limits if needed

#### Authentication Failures
1. **Check failed login attempts**
   ```sql
   SELECT ip_address, COUNT(*) as failed_attempts
   FROM audit_logs 
   WHERE action = 'login_failed' 
   AND created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY ip_address
   HAVING COUNT(*) > 10;
   ```

2. **Response actions**
   - Temporarily block suspicious IPs
   - Notify affected users
   - Review authentication logs

#### Data Retention Job Failures
1. **Check job status**
   ```sql
   SELECT * FROM data_retention_jobs 
   WHERE status = 'failed' 
   AND started_at >= NOW() - INTERVAL '24 hours';
   ```

2. **Manual cleanup if needed**
   ```sql
   -- Example: Clean expired idempotency keys
   SELECT cleanup_expired_idempotency_keys();
   
   -- Example: Clean old rate limits
   SELECT cleanup_old_rate_limits();
   ```

## Weekly Operations

### Security Review (30 minutes)
1. **Analyze security trends**
   - Review weekly authentication patterns
   - Check for unusual audit log activities
   - Monitor rate limiting effectiveness

2. **Performance optimization**
   - Review security table sizes
   - Check index performance
   - Clean up old log entries if needed

3. **Configuration review**
   - Verify rate limits are appropriate
   - Check data retention settings
   - Update security documentation

## Monthly Operations

### Compliance Audit (2 hours)
1. **Generate compliance reports**
   - Export audit logs for external review
   - Verify GDPR data retention compliance
   - Document security incidents

2. **Security assessment**
   - Review security configuration changes
   - Assess threat landscape changes
   - Update security procedures

## Troubleshooting Guide

### Common Issues

#### Security Middleware Slow Response
**Symptoms**: High response times, timeouts
**Diagnosis**:
```sql
-- Check for database connection issues
SELECT pg_stat_database.datname, 
       pg_stat_database.numbackends,
       pg_stat_database.xact_commit,
       pg_stat_database.xact_rollback
FROM pg_stat_database;
```
**Solutions**:
- Check database connection pool
- Review security table indexes
- Consider caching for rate limiting

#### Idempotency Key Conflicts
**Symptoms**: Duplicate processing errors
**Diagnosis**:
```sql
-- Check for duplicate idempotency keys
SELECT key, COUNT(*) as duplicates
FROM idempotency_keys 
GROUP BY key 
HAVING COUNT(*) > 1;
```
**Solutions**:
- Review client-side key generation
- Check for clock synchronization issues
- Verify key expiration logic

#### Audit Log Storage Growth
**Symptoms**: High disk usage, slow queries
**Diagnosis**:
```sql
-- Check audit log table size
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE tablename = 'audit_logs';
```
**Solutions**:
- Run data retention cleanup manually
- Archive old audit logs
- Consider partitioning large tables

### Emergency Procedures

#### Complete Security Bypass (Critical)
**Use only in extreme emergencies**
```bash
# 1. Switch to original booking functions
mv netlify/functions/booking-create.ts netlify/functions/booking-create-secure.ts.backup
mv netlify/functions/booking-create-original.ts netlify/functions/booking-create.ts

mv netlify/functions/booking-cancel.ts netlify/functions/booking-cancel-secure.ts.backup
mv netlify/functions/booking-cancel-original.ts netlify/functions/booking-cancel.ts

# 2. Deploy immediately
netlify deploy --prod

# 3. Disable security in database
psql $DATABASE_URL -c "ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;"
psql $DATABASE_URL -c "ALTER TABLE idempotency_keys DISABLE ROW LEVEL SECURITY;"
```

#### Database Recovery
```sql
-- Backup critical security tables
CREATE TABLE audit_logs_backup AS SELECT * FROM audit_logs;
CREATE TABLE idempotency_keys_backup AS SELECT * FROM idempotency_keys;

-- If needed, restore from backup
TRUNCATE audit_logs;
INSERT INTO audit_logs SELECT * FROM audit_logs_backup;
```

## Monitoring Commands

### Quick Health Check
```bash
#!/bin/bash
# security-health-check.sh

echo "=== Security Health Check ==="
echo "Date: $(date)"
echo

# Check if security features are enabled
echo "Security Features Status:"
echo "- Audit Logging: $SECURITY_AUDIT_LOG_ENABLED"
echo "- Data Retention: $DATA_RETENTION_CLEANUP_ENABLED"
echo "- Abuse Detection: $SECURITY_ABUSE_DETECTION_ENABLED"
echo

# Database checks
psql $DATABASE_URL -c "
SELECT 'Audit Logs (24h)' as metric, COUNT(*) as value
FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'Rate Limit Records (1h)', COUNT(*)
FROM rate_limits WHERE window_start >= NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 'Failed Jobs (24h)', COUNT(*)
FROM data_retention_jobs 
WHERE status = 'failed' AND started_at >= NOW() - INTERVAL '24 hours';
"
```

### Performance Monitoring
```sql
-- Security table performance
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename IN ('audit_logs', 'idempotency_keys', 'rate_limits');

-- Query performance
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements 
WHERE query LIKE '%audit_logs%' OR query LIKE '%idempotency%'
ORDER BY total_time DESC;
```

## Contact Information

### Internal Team
- **DevOps Engineer**: [Email/Phone]
- **Security Officer**: [Email/Phone]
- **Database Administrator**: [Email/Phone]
- **Development Team Lead**: [Email/Phone]

### External Contacts
- **Cloud Provider Support**: [Support Channel]
- **Security Vendor**: [Contact Information]
- **Legal/Compliance**: [Contact Information]

---

**Last Updated**: $(date)
**Version**: 1.0
**Next Review**: $(date -d "+1 month")