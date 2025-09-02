# Duplicate Detection & Import/Export Setup Guide

## Overview
This guide explains how to set up the new duplicate detection and import/export functionality for customer management.

## Database Setup

### 1. Apply Database Migration
Execute the SQL migration to create the required tables and functions:

```bash
# Run this in your Supabase SQL editor or via psql
cat docs/db/11_duplicate_detection_import_export.sql
```

This migration creates:
- `customer_duplicates` - Tracks potential duplicate customers
- `customer_merges` - Audit log for merge operations  
- `customer_import_logs` - Import operation tracking
- `customer_import_details` - Row-level import results
- Database functions for duplicate detection and merging
- Proper indexes for performance

### 2. Verify Tables Created
Check that all tables were created successfully:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'customer_duplicates',
  'customer_merges', 
  'customer_import_logs',
  'customer_import_details'
);

-- Verify functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'detect_customer_duplicates',
  'merge_customers',
  'export_customers_csv'
);
```

### 3. RLS Policies
The migration automatically creates appropriate RLS (Row Level Security) policies. Verify they're active:

```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN (
  'customer_duplicates',
  'customer_merges',
  'customer_import_logs', 
  'customer_import_details'
);
```

## Environment Variables

No new environment variables are required. The functionality uses existing Supabase configuration:

- `SUPABASE_URL` - For backend functions
- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations
- `JWT_SECRET` - For authentication
- `VITE_SUPABASE_URL` - For frontend
- `VITE_SUPABASE_ANON_KEY` - For frontend

## Deployment Checklist

### Backend Functions
The following Netlify Functions are added:

- `/.netlify/functions/admin/customers/merge/detect`
- `/.netlify/functions/admin/customers/merge/execute` 
- `/.netlify/functions/admin/customers/export/csv`
- `/.netlify/functions/admin/customers/import/csv`

Verify they deploy correctly:

```bash
# Test endpoints after deployment
curl -H "Authorization: Bearer <admin-token>" \
  https://your-site.netlify.app/.netlify/functions/admin/customers/import/template

curl -H "Authorization: Bearer <admin-token>" \
  https://your-site.netlify.app/.netlify/functions/admin/customers/merge/detect?confidenceThreshold=0.8
```

### Frontend Components
New admin UI components are added:

- **Dubletten-Erkennung** - Duplicate detection and management
- **Import & Export** - CSV import/export functionality

Access via Admin Dashboard → Dubletten-Erkennung / Import & Export

## Testing the Setup

### 1. Duplicate Detection
1. Go to Admin → Dubletten-Erkennung
2. Click "Dubletten suchen" 
3. Verify it runs without errors
4. Create test customers with similar data to test detection

### 2. CSV Export
1. Go to Admin → Import & Export → Export
2. Configure export settings
3. Click "Vorschau" to test preview generation
4. Try exporting with different formats and filters

### 3. CSV Import
1. Go to Admin → Import & Export → Import  
2. Click "Vorlage herunterladen" to get template
3. Fill template with test data
4. Upload and test validation
5. Execute import to verify it works

### 4. Customer Merging
1. Create duplicate customers manually
2. Run duplicate detection
3. Click "Zusammenführen" on a duplicate pair
4. Test merge preview and execution
5. Verify appointments are transferred correctly

## Troubleshooting

### Common Issues

**1. Database Functions Not Found**
```
Error: function detect_customer_duplicates does not exist
```
**Solution:** Re-run the migration SQL file

**2. RLS Policy Errors**
```
Error: new row violates row-level security policy
```
**Solution:** Verify RLS policies were created correctly and user has admin role

**3. Import/Export Timeouts**
```
Error: Function timeout
```
**Solution:** Large operations may need increased timeout limits in Netlify

**4. GDPR Export Issues**
```
Error: No customers match export criteria
```
**Solution:** Ensure customers have GDPR consent for detailed exports

### Debug Commands

```sql
-- Check duplicate detection function
SELECT detect_customer_duplicates();

-- Check customer merge function  
SELECT merge_customers(
  'customer-a-uuid'::uuid,
  'customer-b-uuid'::uuid, 
  '{"full_name": "primary"}'::jsonb,
  'admin-user-uuid'::uuid
);

-- Check export function
SELECT * FROM export_customers_csv('{}', 'basic');

-- Verify audit logging
SELECT * FROM customer_audit_log ORDER BY created_at DESC LIMIT 10;
```

## Performance Tuning

### Database Indexes
The migration creates these indexes for optimal performance:

```sql
-- Verify indexes exist
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename IN (
  'customer_duplicates',
  'customer_merges',
  'customer_import_logs'
)
ORDER BY tablename, indexname;
```

### Recommended Settings

For large datasets (>10,000 customers), consider:

1. **Duplicate Detection Limits**: Keep confidence threshold ≥ 0.7
2. **Import Batch Size**: Process in chunks of 1,000 rows
3. **Export Pagination**: Use filters to limit result sets
4. **Database Maintenance**: Regular VACUUM and ANALYZE

## Monitoring

### Key Metrics to Monitor

1. **Duplicate Detection Performance**
   ```sql
   -- Average detection time
   SELECT avg(extract(epoch from completed_at - created_at)) as avg_seconds
   FROM customer_import_logs 
   WHERE status = 'completed';
   ```

2. **Import Success Rates**
   ```sql
   -- Import success rate
   SELECT 
     status,
     count(*) as total,
     round(100.0 * count(*) / sum(count(*)) over(), 2) as percentage
   FROM customer_import_logs 
   GROUP BY status;
   ```

3. **Merge Activity**
   ```sql
   -- Recent merge activity
   SELECT 
     date_trunc('day', created_at) as day,
     count(*) as merges
   FROM customer_merges 
   WHERE created_at > now() - interval '30 days'
   GROUP BY day
   ORDER BY day;
   ```

### Error Monitoring

Monitor these log tables for issues:

- `customer_audit_log` - All customer operations
- `customer_import_logs` - Import operations
- `customer_import_details` - Row-level import results

## Security Considerations

### Data Access
- All operations require admin authentication
- RLS policies enforce data isolation
- Complete audit trail for compliance

### GDPR Compliance  
- Export functions respect GDPR consent
- Data retention policies are enforced
- Right to be forgotten is supported via soft delete

### API Rate Limiting
- Endpoints have appropriate rate limits
- Failed operations are logged
- Suspicious activity can be detected

## Support

### Documentation
- See `docs/duplicate-detection-import-export.md` for API documentation
- Check inline code comments for implementation details
- Review TypeScript interfaces for data structures

### Common Maintenance Tasks

**1. Clean up old import logs:**
```sql
DELETE FROM customer_import_logs 
WHERE created_at < now() - interval '90 days'
AND status IN ('completed', 'failed');
```

**2. Archive old merge records:**
```sql
-- Archive merges older than 2 years to separate table
INSERT INTO customer_merges_archive 
SELECT * FROM customer_merges 
WHERE created_at < now() - interval '2 years';
```

**3. Update duplicate detection thresholds:**
```sql
-- Review confidence scores and adjust thresholds
SELECT 
  match_type,
  avg(confidence_score) as avg_confidence,
  min(confidence_score) as min_confidence,
  max(confidence_score) as max_confidence
FROM customer_duplicates 
WHERE status = 'merged'
GROUP BY match_type;
```

This setup provides a robust, scalable solution for customer duplicate detection and data management with full audit trails and GDPR compliance.