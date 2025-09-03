# Security Operations Playbook

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Security Incident Response](#security-incident-response)
3. [Data Retention Management](#data-retention-management)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Emergency Procedures](#emergency-procedures)

## Daily Operations

### Morning Security Check (10 minutes)

**Checklist**:
- [ ] Review overnight security alerts
- [ ] Check data retention job execution status
- [ ] Verify rate limiting metrics are normal
- [ ] Review failed authentication attempts
- [ ] Check idempotency cache hit rates

**Commands**:
```bash
# Check last 24 hours of security metrics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/metrics?hours=24"

# Review retention job status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/retention/executions?limit=5"
```

**Normal Baselines**:
- Rate limit violations: < 50/day
- Failed auth attempts: < 100/day
- Idempotency hit rate: 15-25%
- Data retention jobs: 1 successful/day

### Weekly Security Review (30 minutes)

**Checklist**:
- [ ] Review audit logs for admin actions
- [ ] Analyze rate limiting patterns
- [ ] Check for unusual access patterns
- [ ] Verify data retention compliance
- [ ] Update security documentation

**Audit Review Query**:
```sql
-- Top admin actions this week
SELECT action_type, COUNT(*) as count, admin_email
FROM admin_audit 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY action_type, admin_email
ORDER BY count DESC;

-- Failed operations this week
SELECT action_type, resource_type, COUNT(*) as failures
FROM admin_audit 
WHERE created_at >= NOW() - INTERVAL '7 days' 
  AND success = false
GROUP BY action_type, resource_type
ORDER BY failures DESC;
```

## Security Incident Response

### High Rate Limit Violations

**Trigger**: > 100 violations/hour from single IP

**Response Steps**:
1. **Immediate**: Check if legitimate traffic spike
2. **Investigate**: Review user patterns and endpoints
3. **Block**: Temporarily increase rate limits or block IP
4. **Monitor**: Watch for distributed patterns

```bash
# Get top violating IPs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/rate-limits/violations?hours=1"

# Temporarily block IP (if supported)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/ip-block" \
  -d '{"ip": "192.168.1.100", "duration_hours": 24, "reason": "Rate limit violation"}'
```

### Authentication Anomalies

**Trigger**: > 20 failed attempts/hour from single IP

**Response Steps**:
1. **Alert**: Notify security team immediately
2. **Investigate**: Check for credential stuffing/brute force
3. **Protect**: Implement additional auth controls
4. **Monitor**: Enhanced logging for affected accounts

```bash
# Get failed auth attempts by IP
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/auth-failures?hours=1&group_by=ip"

# Get affected user accounts
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/auth-failures?hours=1&group_by=user"
```

### Data Breach Indicators

**Triggers**:
- Unusual data access patterns
- Large data exports
- Admin actions outside business hours

**Response Steps**:
1. **Immediate**: Document everything, don't delete
2. **Assess**: Determine scope and data types affected
3. **Contain**: Revoke suspicious access immediately
4. **Notify**: Follow legal notification requirements
5. **Investigate**: Full forensic analysis

```sql
-- Unusual admin activity outside business hours
SELECT admin_email, action_type, resource_type, created_at, ip_address
FROM admin_audit 
WHERE EXTRACT(HOUR FROM created_at) NOT BETWEEN 8 AND 18
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Large data operations
SELECT admin_email, action_type, action_data, created_at
FROM admin_audit 
WHERE action_data->>'operation_size' IS NOT NULL
  AND (action_data->>'operation_size')::int > 1000
ORDER BY created_at DESC;
```

## Data Retention Management

### Monthly Retention Review

**Checklist**:
- [ ] Review retention policies for compliance changes
- [ ] Execute dry runs for next month's deletions
- [ ] Verify archive storage integrity
- [ ] Update retention documentation

**Dry Run Procedure**:
```bash
# Execute dry run for all policies
curl -X POST -H "Authorization: Bearer $NETLIFY_CRON_SECRET" \
  "$FUNCTIONS_BASE/data-retention-job"

# Review dry run results
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/retention/executions?type=dry_run&limit=10"
```

### Quarterly Data Cleanup

**Checklist**:
- [ ] Execute actual retention policies (after dry run approval)
- [ ] Verify deletions completed successfully
- [ ] Archive important data before deletion
- [ ] Update compliance documentation

**Execution Procedure**:
```bash
# Set environment for actual execution
export DATA_RETENTION_DRY_RUN=false

# Execute retention policies
curl -X POST -H "Authorization: Bearer $NETLIFY_CRON_SECRET" \
  "$FUNCTIONS_BASE/data-retention-job"

# Monitor execution
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/retention/executions?type=execute&limit=5"
```

**Emergency Rollback** (within 24 hours):
```bash
# Get execution ID from logs
EXECUTION_ID="uuid-here"

# Initiate rollback
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/retention/rollback" \
  -d '{"execution_id": "'$EXECUTION_ID'", "reason": "Emergency rollback due to..."}'
```

## Monitoring & Alerts

### Security Metrics Dashboard

**Key Metrics to Monitor**:

1. **Rate Limiting**:
   - Requests per minute by endpoint
   - Rate limit violations by IP
   - 429 response rate

2. **Authentication**:
   - Login success/failure rates
   - Token expiration patterns
   - Multi-role access patterns

3. **Idempotency**:
   - Cache hit rates by endpoint
   - Duplicate request patterns
   - Key validation failures

4. **Audit Activity**:
   - Admin action volume
   - Data access patterns
   - Compliance operation success

### Alert Configuration

**Critical Alerts** (immediate response required):
```yaml
rate_limit_spike:
  condition: rate_limit_violations > 100/hour
  channels: [pagerduty, slack]
  
auth_failure_spike:
  condition: auth_failures > 50/hour/ip
  channels: [pagerduty, email]
  
data_retention_failure:
  condition: retention_job_status = failed
  channels: [pagerduty, email]
  
unusual_admin_activity:
  condition: admin_actions outside business_hours
  channels: [slack, email]
```

**Warning Alerts** (review within 4 hours):
```yaml
idempotency_low:
  condition: idempotency_hit_rate < 10%
  channels: [slack]
  
audit_log_gaps:
  condition: missing_audit_entries detected
  channels: [email]
  
rate_limit_trending_up:
  condition: rate_limit_violations trending > 20%
  channels: [slack]
```

### Custom Monitoring Queries

**Daily Security Report**:
```sql
-- Security summary for last 24 hours
WITH daily_stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE metric_type = 'rate_limit_exceeded') as rate_limit_violations,
    COUNT(*) FILTER (WHERE metric_type = 'auth_failure') as auth_failures,
    COUNT(*) FILTER (WHERE metric_type = 'idempotency_hit') as idempotency_hits,
    COUNT(*) FILTER (WHERE metric_type = 'audit_event') as audit_events
  FROM security_metrics 
  WHERE recorded_at >= NOW() - INTERVAL '24 hours'
)
SELECT * FROM daily_stats;
```

**Weekly Trends**:
```sql
-- Weekly security trends
SELECT 
  DATE_TRUNC('day', recorded_at) as day,
  metric_type,
  COUNT(*) as events
FROM security_metrics 
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY day, metric_type
ORDER BY day DESC, events DESC;
```

## Emergency Procedures

### System Compromise Response

**Immediate Actions** (within 5 minutes):
1. **Isolate**: Revoke all admin tokens
2. **Alert**: Notify incident response team
3. **Preserve**: Stop log rotation, backup current state
4. **Assess**: Determine scope of compromise

```bash
# Emergency token revocation
curl -X POST -H "Authorization: Bearer $MASTER_TOKEN" \
  "$API_BASE/admin/emergency/revoke-all-tokens" \
  -d '{"reason": "Security incident", "initiated_by": "security_team"}'

# Enable enhanced logging
curl -X POST -H "Authorization: Bearer $MASTER_TOKEN" \
  "$API_BASE/admin/security/enhanced-logging" \
  -d '{"duration_hours": 24, "level": "debug"}'
```

### Data Loss Prevention

**If unauthorized data access detected**:
1. **Stop**: Immediately revoke affected user access
2. **Audit**: Review all actions by affected accounts
3. **Secure**: Change all related passwords/tokens
4. **Report**: Follow data breach notification procedures

```bash
# Revoke specific user access
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/users/revoke-access" \
  -d '{"user_id": "suspicious-user-id", "reason": "Security incident"}'

# Get full audit trail for user
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/audit/user-trail?user_id=suspicious-user-id&days=30"
```

### Service Degradation Response

**High load/attack scenarios**:
1. **Rate Limit**: Reduce limits immediately
2. **Scale**: Enable additional rate limiting
3. **Block**: Implement geographic or IP-based blocks
4. **Communicate**: Update status page

```bash
# Emergency rate limit reduction
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/rate-limits/emergency" \
  -d '{"factor": 0.5, "duration_minutes": 60, "reason": "High load protection"}'

# Enable emergency mode
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/security/emergency-mode" \
  -d '{"enabled": true, "restrictions": ["limit_new_users", "increase_auth_requirements"]}'
```

## Contact Information

**Security Team**:
- Primary: security@schnittwerk.com
- Emergency: +41-XXX-XXX-XXXX
- Slack: #security-alerts

**Escalation Chain**:
1. Security Lead (immediate)
2. CTO (within 30 minutes)
3. CEO (within 2 hours for major incidents)
4. Legal Team (within 24 hours for data breaches)

**External Contacts**:
- Hosting Provider: Netlify Support
- Database Provider: Supabase Support
- Legal Counsel: [Contact Information]
- Law Enforcement: [As required by jurisdiction]

## Regular Testing

### Monthly Security Drills

**Tabletop Exercises**:
- Simulated data breach
- DDoS attack response
- Insider threat scenarios
- Compliance audit preparation

**Technical Tests**:
- Penetration testing
- Rate limit effectiveness
- Idempotency validation
- Audit trail completeness

### Quarterly Reviews

**Process Reviews**:
- Update incident response procedures
- Review and update monitoring thresholds
- Test emergency contact procedures
- Validate backup and recovery processes

**Documentation Updates**:
- Security playbook updates
- Compliance procedure reviews
- Training material updates
- Tool and process improvements

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Next Review**: [Date + 3 months]  
**Owner**: Security Team