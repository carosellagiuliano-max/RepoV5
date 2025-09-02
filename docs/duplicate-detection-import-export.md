# Duplicate Detection & Import/Export Documentation

## Overview

This feature provides comprehensive customer duplicate detection, merging, and CSV import/export functionality with full GDPR compliance.

## Features

### 1. Duplicate Detection
- **Fuzzy Matching**: Finds potential duplicates using email (exact), phone (exact), and name similarity (Levenshtein distance)
- **Configurable Thresholds**: Adjustable confidence levels from 50% to 100%
- **Match Types**: email, phone, name_fuzzy, manual
- **Review Workflow**: Pending → Reviewed → Merged/Dismissed

### 2. Customer Merging
- **Preview Mode**: See merge results before execution
- **Field-by-Field Strategy**: Choose which data to keep for each field
- **Appointment Transfer**: All appointments moved to primary customer
- **Complete Audit Trail**: Full logging of merge operations

### 3. CSV Export
- **GDPR Compliant**: Automatic filtering based on consent
- **Multiple Formats**:
  - Basic: Name, email, creation date
  - Detailed: All contact information (requires GDPR consent)
  - GDPR Full: Complete data including appointments (requires GDPR consent)
- **Advanced Filtering**: City, postal code, date ranges, deletion status

### 4. CSV Import
- **Smart Mapping**: Auto-detection of CSV columns
- **Validation**: Comprehensive error checking before import
- **Dry-Run Mode**: Test imports without affecting data
- **Duplicate Handling**: Skip, update, or create new records
- **Progress Tracking**: Detailed import logs and status

## API Endpoints

### Duplicate Detection

#### `GET /.netlify/functions/admin/customers/merge/detect`
Find potential duplicates using fuzzy matching.

**Query Parameters:**
- `customerId` (optional): Check specific customer
- `confidenceThreshold` (optional): Minimum similarity (0.0-1.0, default: 0.7)
- `limit` (optional): Maximum results (default: 100)

**Response:**
```json
{
  "duplicates": [
    {
      "customer_a_id": "uuid",
      "customer_b_id": "uuid", 
      "match_type": "email|phone|name_fuzzy|manual",
      "confidence_score": 0.95,
      "match_details": {
        "matched_email": "test@example.com",
        "customer_a_name": "John Doe",
        "customer_b_name": "Jon Doe"
      },
      "customer_a": { /* customer data */ },
      "customer_b": { /* customer data */ }
    }
  ],
  "total": 5
}
```

#### `GET /.netlify/functions/admin/customers/merge/list`
List all tracked duplicates with filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `status` (optional): pending|reviewed|merged|dismissed
- `matchType` (optional): email|phone|name_fuzzy|manual
- `minConfidence` (optional): Minimum confidence score

#### `POST /.netlify/functions/admin/customers/merge/mark-reviewed`
Mark a duplicate as reviewed.

**Body:**
```json
{
  "duplicateId": "uuid"
}
```

#### `POST /.netlify/functions/admin/customers/merge/dismiss`
Dismiss a duplicate as false positive.

**Body:**
```json
{
  "duplicateId": "uuid",
  "reason": "Different customers with similar names"
}
```

### Customer Merging

#### `POST /.netlify/functions/admin/customers/merge/preview`
Generate merge preview without executing.

**Body:**
```json
{
  "primaryCustomerId": "uuid",
  "mergeCustomerId": "uuid", 
  "mergeStrategy": {
    "full_name": "primary|merge",
    "phone": "primary|merge|combine",
    "date_of_birth": "primary|merge",
    "address_street": "primary|merge",
    "address_city": "primary|merge", 
    "address_postal_code": "primary|merge",
    "emergency_contact_name": "primary|merge",
    "emergency_contact_phone": "primary|merge",
    "notes": "primary|merge|combine"
  }
}
```

**Response:**
```json
{
  "primary_customer": { /* customer data */ },
  "merge_customer": { /* customer data */ },
  "merged_result": { /* preview of result */ },
  "transfer_summary": {
    "appointments_to_transfer": 5,
    "total_appointments_after_merge": 12
  }
}
```

#### `POST /.netlify/functions/admin/customers/merge/execute`
Execute customer merge.

**Body:**
```json
{
  "primaryCustomerId": "uuid",
  "mergeCustomerId": "uuid",
  "mergeStrategy": { /* same as preview */ },
  "notes": "Merged duplicate accounts created during registration issue"
}
```

#### `GET /.netlify/functions/admin/customers/merge/history`
Get merge history.

**Query Parameters:**
- `page`, `limit`: Pagination
- `customerId` (optional): Filter by customer

### CSV Export

#### `GET /.netlify/functions/admin/customers/export/csv`
Export customers to CSV.

**Query Parameters:**
- `format`: basic|detailed|gdpr_full
- `hasGdprConsent` (optional): true|false
- `city` (optional): Filter by city
- `postalCode` (optional): Filter by postal code  
- `registeredAfter` (optional): ISO date
- `registeredBefore` (optional): ISO date
- `includeDeleted` (optional): Include soft-deleted customers

**Response:**
```json
{
  "csv": "customer_number,full_name,email,created_at\nC20240001,John Doe,john@example.com,2024-01-15",
  "filename": "customers-basic-2024-01-15.csv",
  "count": 150,
  "format": "basic"
}
```

#### `POST /.netlify/functions/admin/customers/export/preview`
Preview export results.

**Body:**
```json
{
  "filters": {
    "format": "detailed",
    "hasGdprConsent": true,
    "city": "Berlin"
  },
  "format": "detailed"
}
```

### CSV Import

#### `GET /.netlify/functions/admin/customers/import/template`
Download CSV import template.

**Response:**
```json
{
  "template": {
    "headers": ["full_name", "email", "phone", "date_of_birth", "gdpr_consent_given"],
    "field_mappings": [
      {
        "csvColumn": "full_name",
        "databaseField": "full_name", 
        "required": true
      }
    ]
  },
  "csv_template": "full_name,email,phone,date_of_birth,gdpr_consent_given\nMax Mustermann,max@example.com,+49123456789,1985-06-15,true"
}
```

#### `POST /.netlify/functions/admin/customers/import/validate`
Validate CSV import (dry-run).

**Body:**
```json
{
  "csvData": "full_name,email\nJohn Doe,john@example.com",
  "filename": "customers.csv",
  "fieldMapping": [
    {
      "csvColumn": "full_name",
      "databaseField": "full_name",
      "required": true
    },
    {
      "csvColumn": "email", 
      "databaseField": "email",
      "required": true,
      "transform": "email"
    }
  ],
  "importMode": "create_only|update_existing|create_and_update",
  "duplicateHandling": "skip|update|create_new"
}
```

**Response:**
```json
{
  "import_log_id": "uuid",
  "summary": {
    "total_rows": 100,
    "valid_rows": 95,
    "invalid_rows": 3,
    "duplicate_rows": 2,
    "warning_rows": 5
  },
  "rows": [
    {
      "rowNumber": 2,
      "status": "valid|invalid|duplicate",
      "data": { "full_name": "John Doe", "email": "john@example.com" },
      "errors": ["Email format invalid"],
      "warnings": ["Phone number missing"]
    }
  ],
  "ready_for_import": true
}
```

#### `POST /.netlify/functions/admin/customers/import/execute`
Execute CSV import.

**Body:**
```json
{
  "importLogId": "uuid", // From validation
  "csvData": "...", // Or provide new data
  "fieldMapping": [/* mappings */],
  "importMode": "create_only",
  "duplicateHandling": "skip"
}
```

#### `GET /.netlify/functions/admin/customers/import/logs`
Get import history.

**Query Parameters:**
- `page`, `limit`: Pagination
- `status` (optional): Filter by status

## CSV Formats

### Import Template
```csv
full_name,email,phone,date_of_birth,address_street,address_city,address_postal_code,emergency_contact_name,emergency_contact_phone,notes,gdpr_consent_given
Max Mustermann,max.mustermann@example.com,+49 123 456789,1985-06-15,Musterstraße 123,Musterstadt,12345,Maria Mustermann,+49 123 456790,Preferred appointment time: afternoons,true
```

### Export Formats

**Basic Export:**
```csv
customer_number,full_name,email,created_at
C20240001,Max Mustermann,max@example.com,2024-01-15T10:30:00Z
```

**Detailed Export:**
```csv
customer_number,full_name,email,phone,date_of_birth,address_street,address_city,address_postal_code,emergency_contact_name,emergency_contact_phone,gdpr_consent_given,gdpr_consent_date,created_at,updated_at
C20240001,Max Mustermann,max@example.com,+49123456789,1985-06-15,Musterstraße 123,Musterstadt,12345,Maria Mustermann,+49123456790,true,2024-01-15T10:30:00Z,2024-01-15T10:30:00Z,2024-01-20T15:45:00Z
```

**GDPR Full Export:**
```csv
customer_number,full_name,email,phone,date_of_birth,address_street,address_city,address_postal_code,emergency_contact_name,emergency_contact_phone,notes,gdpr_consent_given,gdpr_consent_date,created_at,updated_at,appointment_count,total_spent,last_appointment
C20240001,Max Mustermann,max@example.com,+49123456789,1985-06-15,Musterstraße 123,Musterstadt,12345,Maria Mustermann,+49123456790,Regular customer since 2024,true,2024-01-15T10:30:00Z,2024-01-15T10:30:00Z,2024-01-20T15:45:00Z,5,245.50,2024-12-01T14:00:00Z
```

## Data Transformations

### Import Transformations
- **date**: Converts date strings to YYYY-MM-DD format
- **boolean**: Converts true/false, yes/no, ja/nein, 1/0 to boolean
- **phone**: Normalizes phone number format
- **email**: Normalizes email to lowercase

### Field Mappings
- `full_name` → `profiles.full_name` (required)
- `email` → `profiles.email` (required, unique)
- `phone` → `profiles.phone`
- `date_of_birth` → `customers.date_of_birth`
- `address_*` → `customers.address_*`
- `emergency_contact_*` → `customers.emergency_contact_*`
- `notes` → `customers.notes`
- `gdpr_consent_given` → `customers.gdpr_consent_given`

## GDPR Compliance

### Export Rules
- **Basic Format**: No consent required, exports only public data
- **Detailed Format**: Requires GDPR consent, exports all contact data
- **GDPR Full Format**: Requires GDPR consent, exports complete customer data including appointments

### Data Retention
- Customer data retained per GDPR settings (default: 7 years)
- Audit logs retained for 10 years
- Import logs retained for 3 years
- Merge history retained permanently for audit purposes

### Consent Management
- Export functions automatically filter by consent status
- Import can set GDPR consent during customer creation
- Detailed audit trail for all consent changes

## Error Handling

### Common Validation Errors
- Missing required fields (name, email)
- Invalid email format
- Duplicate email addresses
- Invalid date formats
- Phone number format issues

### Import Error Codes
- `EMPTY_CSV`: No data in CSV file
- `INVALID_MAPPING`: Field mapping configuration error
- `VALIDATION_ERROR`: Data validation failed
- `DUPLICATE_EMAIL`: Email already exists
- `CUSTOMER_NOT_FOUND`: Referenced customer doesn't exist

### Merge Error Codes
- `INVALID_MERGE`: Cannot merge customer with itself
- `CUSTOMER_NOT_FOUND`: One or both customers not found
- `CUSTOMER_DELETED`: Cannot merge deleted customers
- `MERGE_FAILED`: Database error during merge operation

## Performance Considerations

### Limits
- **Duplicate Detection**: Maximum 1000 results per query
- **CSV Export**: No hard limit, but large exports may timeout
- **CSV Import**: Recommended maximum 10,000 rows per import
- **API Rate Limits**: 
  - Detection: 50 requests/minute
  - Export: 10 requests/minute  
  - Import: 5 requests/minute
  - Merge: 20 requests/minute

### Optimization
- Duplicate detection uses database indexes on email, phone, and name
- Large imports are processed in batches
- Export uses streaming for large datasets
- Pagination used for all list endpoints

## Security

### Authentication
- All endpoints require JWT authentication
- Admin role required for all operations
- User context tracked in audit logs

### Authorization
- RLS policies enforce data access controls
- Import/export limited to admin users
- Merge operations tracked with user attribution

### Audit Trail
- Complete logging of all duplicate detection operations
- Merge operations logged with before/after states
- Import operations logged with detailed results
- Export operations logged with GDPR compliance status