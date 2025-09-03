# Backup & Restore Guide

This guide covers comprehensive backup and restore procedures for the Schnittwerk Your Style salon booking system.

## Table of Contents

- [Overview](#overview)
- [Backup Strategy](#backup-strategy)
- [Automated Backups](#automated-backups)
- [Manual Backups](#manual-backups)
- [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
- [Restore Procedures](#restore-procedures)
- [Testing & Validation](#testing--validation)
- [Disaster Recovery](#disaster-recovery)
- [Monitoring & Alerts](#monitoring--alerts)

## Overview

The system uses Supabase as the primary database, which provides built-in backup capabilities. This guide covers both automated and manual backup procedures, as well as comprehensive restore testing.

### Data Components

- **Database**: PostgreSQL via Supabase (customer data, bookings, staff, services)
- **File Storage**: Supabase Storage (profile images, service images, documents)
- **Configuration**: Environment variables and application settings
- **Logs**: Application logs and audit trails

## Backup Strategy

### Backup Types

1. **Automated Daily Backups** (Supabase)
   - Full database snapshots
   - Retention: 7 days (Starter) / 30 days (Pro) / 90 days (Team+)
   - No additional cost for basic retention

2. **Point-in-Time Recovery (PITR)**
   - Available on Pro plan and above
   - Recovery to any point within the last 7 days
   - Cost: Additional storage costs apply

3. **Manual Exports**
   - On-demand database exports
   - File storage downloads
   - Configuration backups

### Backup Schedule

| Component | Frequency | Retention | Method |
|-----------|-----------|-----------|---------|
| Database | Daily (automated) | 30 days | Supabase snapshots |
| Database | Weekly (PITR) | 7 days | Point-in-time recovery |
| File Storage | Weekly | 30 days | Manual download |
| Configuration | On change | Indefinite | Git repository |
| Logs | Daily | 90 days | Netlify logs |

## Automated Backups

### Supabase Automated Backups

Supabase automatically creates daily backups of your database:

1. **Access Backup Settings**
   ```
   Supabase Dashboard → Project → Settings → Database → Backups
   ```

2. **View Available Backups**
   - Daily snapshots are listed with timestamps
   - Download links available for manual access
   - Restore options for each backup

3. **Backup Monitoring**
   ```sql
   -- Check last backup status
   SELECT 
     backup_id,
     created_at,
     status,
     size_bytes
   FROM pg_stat_backup_files 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Enable Point-in-Time Recovery

**Prerequisites**: Pro plan or higher

1. **Enable PITR**
   ```
   Supabase Dashboard → Project → Settings → Database → Point-in-time recovery
   → Enable PITR
   ```

2. **Configuration**
   - **Recovery Window**: 7 days (default)
   - **Storage Cost**: ~$0.024 per GB per month
   - **Network Cost**: ~$0.09 per GB for data transfer

3. **Monitor PITR Status**
   ```bash
   # Check PITR status via API
   curl -X GET \
     "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/backups" \
     -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"
   ```

## Manual Backups

### Database Export

1. **Via Supabase Dashboard**
   ```
   Dashboard → Settings → Database → Database export
   → Download backup
   ```

2. **Via CLI (pg_dump)**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login
   supabase login
   
   # Export database
   supabase db dump \
     --project-ref YOUR_PROJECT_REF \
     --schema public \
     --file backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Selective Table Export**
   ```bash
   # Export specific tables
   pg_dump \
     "postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/postgres" \
     --schema public \
     --table bookings \
     --table customers \
     --table staff \
     --file selective_backup.sql
   ```

### File Storage Backup

1. **Manual Download via Dashboard**
   ```
   Supabase Dashboard → Storage → salon-media → Download selected files
   ```

2. **Automated Script**
   ```bash
   #!/bin/bash
   # backup-storage.sh
   
   BACKUP_DIR="/backup/storage/$(date +%Y%m%d)"
   mkdir -p "$BACKUP_DIR"
   
   # Download all files from storage bucket
   supabase storage ls salon-media --recursive | while read file; do
     supabase storage download salon-media "$file" "$BACKUP_DIR/$file"
   done
   
   # Create compressed archive
   tar -czf "storage_backup_$(date +%Y%m%d_%H%M%S).tar.gz" "$BACKUP_DIR"
   ```

### Configuration Backup

1. **Environment Variables**
   ```bash
   # Export current environment variables
   env | grep -E '^(VITE_|SUPABASE_|SMTP_|TWILIO_)' > env_backup_$(date +%Y%m%d).txt
   ```

2. **Netlify Configuration**
   ```bash
   # Export Netlify site configuration
   netlify api listSiteEnvVars --site-id=${SITE_ID} > netlify_env_backup.json
   ```

## Point-in-Time Recovery (PITR)

### When to Use PITR

- **Data corruption**: Accidental data deletion or modification
- **Application bugs**: Faulty code that corrupted data
- **Security incidents**: Unauthorized data changes
- **Testing**: Create point-in-time copies for testing

### PITR Process

1. **Determine Recovery Point**
   ```sql
   -- Find the exact timestamp before the incident
   SELECT 
     created_at,
     updated_at,
     action_type
   FROM audit_logs 
   WHERE created_at >= '2024-01-01 10:00:00'
   ORDER BY created_at DESC;
   ```

2. **Initiate Recovery**
   ```
   Supabase Dashboard → Settings → Database → Point-in-time recovery
   → Select recovery timestamp
   → Create new project from backup
   ```

3. **Validation**
   - Verify data integrity at recovery point
   - Check application functionality
   - Validate recent changes are excluded

### PITR Costs

- **Storage**: ~$0.024 per GB per month
- **Compute**: Standard database pricing during recovery
- **Network**: ~$0.09 per GB for data transfer
- **Estimated monthly cost**: $10-50 for typical salon database

## Restore Procedures

### Full Database Restore

1. **From Supabase Backup**
   ```
   Supabase Dashboard → Settings → Database → Backups
   → Select backup → Restore
   → Confirm overwrite
   ```

2. **From SQL Dump**
   ```bash
   # Create new database (recommended)
   createdb salon_restore
   
   # Restore from backup
   psql "postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/salon_restore" \
     -f backup_20240101_120000.sql
   
   # Verify restoration
   psql "postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/salon_restore" \
     -c "SELECT COUNT(*) FROM bookings;"
   ```

### Selective Data Restore

1. **Table-Level Restore**
   ```sql
   -- Backup current table
   CREATE TABLE bookings_backup AS SELECT * FROM bookings;
   
   -- Restore specific table from dump
   \copy bookings FROM 'bookings_backup.csv' WITH CSV HEADER;
   
   -- Verify restoration
   SELECT COUNT(*) FROM bookings;
   SELECT MAX(created_at) FROM bookings;
   ```

2. **Row-Level Restore**
   ```sql
   -- Restore specific customer data
   INSERT INTO customers (id, email, name, phone, created_at)
   SELECT id, email, name, phone, created_at
   FROM customers_backup 
   WHERE email = 'customer@example.com'
   ON CONFLICT (id) DO UPDATE SET
     email = EXCLUDED.email,
     name = EXCLUDED.name,
     phone = EXCLUDED.phone;
   ```

### File Storage Restore

1. **Bulk Upload**
   ```bash
   # Restore all files from backup
   for file in backup_storage/*; do
     supabase storage upload salon-media "$(basename "$file")" "$file"
   done
   ```

2. **Selective Restore**
   ```bash
   # Restore specific file types
   find backup_storage/ -name "*.jpg" -o -name "*.png" | while read file; do
     relative_path="${file#backup_storage/}"
     supabase storage upload salon-media "$relative_path" "$file"
   done
   ```

## Testing & Validation

### Backup Testing Schedule

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| Backup Integrity | Weekly | Verify backup files are valid |
| Restore Test | Monthly | Full restore to staging environment |
| PITR Test | Quarterly | Point-in-time recovery validation |
| Disaster Recovery | Bi-annually | Complete system restoration |

### Automated Backup Testing

1. **Create Test Script**
   ```bash
   #!/bin/bash
   # test-backup-restore.sh
   
   set -e
   
   BACKUP_FILE="test_backup_$(date +%Y%m%d_%H%M%S).sql"
   TEST_DB="salon_test_restore"
   
   echo "Starting backup validation test..."
   
   # Create backup
   pg_dump "$SOURCE_DB" > "$BACKUP_FILE"
   
   # Create test database
   createdb "$TEST_DB"
   
   # Restore backup
   psql "$TEST_DB" < "$BACKUP_FILE"
   
   # Validate restoration
   ORIGINAL_COUNT=$(psql "$SOURCE_DB" -t -c "SELECT COUNT(*) FROM bookings;")
   RESTORED_COUNT=$(psql "$TEST_DB" -t -c "SELECT COUNT(*) FROM bookings;")
   
   if [ "$ORIGINAL_COUNT" = "$RESTORED_COUNT" ]; then
     echo "✅ Backup validation successful"
   else
     echo "❌ Backup validation failed: count mismatch"
     exit 1
   fi
   
   # Cleanup
   dropdb "$TEST_DB"
   rm "$BACKUP_FILE"
   ```

2. **Schedule via Cron**
   ```bash
   # Add to crontab
   0 2 * * 0 /opt/scripts/test-backup-restore.sh >> /var/log/backup-test.log 2>&1
   ```

### Validation Checklist

- [ ] **Data Integrity**
  - [ ] Row counts match between backup and source
  - [ ] Foreign key relationships are intact
  - [ ] Indexes are properly restored
  - [ ] Sequences are at correct values

- [ ] **Application Functionality**
  - [ ] User authentication works
  - [ ] Booking creation/modification functions
  - [ ] Payment processing is operational
  - [ ] Notifications are sent correctly

- [ ] **Performance**
  - [ ] Query response times are acceptable
  - [ ] No missing indexes causing slow queries
  - [ ] Connection pool is functioning

## Disaster Recovery

### Recovery Time Objectives (RTO)

| Scenario | Target RTO | Procedure |
|----------|------------|-----------|
| Database corruption | 2 hours | Restore from latest backup |
| Complete data loss | 4 hours | Full system restoration |
| Storage failure | 1 hour | Restore from file backup |
| Configuration loss | 30 minutes | Redeploy from Git |

### Recovery Point Objectives (RPO)

| Data Type | Target RPO | Backup Frequency |
|-----------|------------|------------------|
| Customer data | 24 hours | Daily automated |
| Bookings | 24 hours | Daily automated |
| File uploads | 7 days | Weekly manual |
| Configuration | 0 hours | Git versioned |

### Disaster Recovery Procedures

1. **Assess Damage**
   - Identify affected systems
   - Determine data loss scope
   - Estimate recovery time

2. **Activate Recovery Team**
   - Notify stakeholders
   - Assign recovery roles
   - Begin communication plan

3. **System Recovery**
   ```bash
   # Emergency recovery script
   #!/bin/bash
   
   echo "Starting disaster recovery..."
   
   # 1. Create new Supabase project if needed
   supabase projects create salon-recovery
   
   # 2. Restore database from latest backup
   supabase db restore --project-ref NEW_PROJECT_REF backup.sql
   
   # 3. Update environment variables
   export VITE_SUPABASE_URL="new-project-url"
   export VITE_SUPABASE_ANON_KEY="new-anon-key"
   
   # 4. Deploy application
   npm run build
   netlify deploy --prod
   
   # 5. Restore file storage
   ./restore-storage.sh
   
   echo "Recovery complete. Verify functionality."
   ```

4. **Validation & Testing**
   - Verify all critical functions
   - Test user authentication
   - Confirm data integrity
   - Validate integrations

## Monitoring & Alerts

### Backup Monitoring

1. **Supabase Backup Status**
   ```sql
   -- Monitor backup success/failure
   SELECT 
     backup_id,
     status,
     created_at,
     error_message
   FROM backup_logs 
   WHERE created_at >= NOW() - INTERVAL '7 days'
   ORDER BY created_at DESC;
   ```

2. **Storage Usage Monitoring**
   ```sql
   -- Monitor database size growth
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables 
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

### Alert Configuration

1. **Backup Failure Alerts**
   - Monitor daily backup completion
   - Alert on backup size anomalies
   - Notify on restoration failures

2. **Storage Alerts**
   - Warn at 80% storage capacity
   - Alert on rapid growth patterns
   - Monitor PITR storage costs

### Health Check Integration

The system health endpoint (`/api/health`) includes backup monitoring:

```json
{
  "status": "healthy",
  "checks": {
    "backup": {
      "status": "healthy",
      "message": "Last backup completed successfully",
      "details": {
        "lastBackup": "2024-01-01T02:00:00Z",
        "backupSize": "156MB",
        "retention": "30 days"
      }
    }
  }
}
```

## Emergency Contacts

### Recovery Team

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| Technical Lead | [Name] | [Phone] | [Email] |
| Database Admin | [Name] | [Phone] | [Email] |
| DevOps Engineer | [Name] | [Phone] | [Email] |

### Vendor Support

| Service | Support Level | Contact |
|---------|---------------|---------|
| Supabase | Pro Support | support@supabase.com |
| Netlify | Business Support | support@netlify.com |

---

## Test Recovery Log

### Most Recent Test: [DATE]

**Test Type**: Full Database Restore
**Duration**: 45 minutes
**Result**: ✅ Successful

**Steps Performed**:
1. Created backup from production database
2. Restored to staging environment
3. Validated data integrity (all tables)
4. Tested application functionality
5. Verified performance metrics

**Issues Found**: None
**Next Test**: [NEXT_DATE]

---

*Last Updated: [DATE]*
*Next Review: [DATE]*