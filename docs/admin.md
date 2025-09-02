# Admin Portal Documentation

## Overview

The Schnittwerk Admin Portal provides comprehensive management capabilities for salon operations, including staff, services, appointments, customers, and business settings.

## Authentication & Authorization

### Roles
- **Admin**: Full access to all features
- **Staff**: Limited access to their own data and appointments
- **Customer**: Read-only access to personal data and appointments

### API Authentication
All admin API endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Admin role (unless otherwise specified)
- Rate limiting: 50 requests per minute for admin operations

## Admin API Endpoints

### Business Settings (`/netlify/functions/admin/settings`) 🆕

#### GET - List Business Settings
```
GET /admin/settings?category=business&include_sensitive=false
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50, max: 100)
- `category` (string): Filter by category (business, booking, email)
- `search` (string): Search in key and description
- `include_sensitive` (boolean): Include sensitive settings (default: false, admin only)

**Response:**
```json
{
  "settings": [
    {
      "id": "uuid",
      "key": "business.opening_hours",
      "value": {
        "monday": {"enabled": true, "start": "09:00", "end": "18:00"},
        "tuesday": {"enabled": true, "start": "09:00", "end": "18:00"}
      },
      "description": "Default opening hours for each day",
      "category": "business",
      "is_sensitive": false,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "updated_by": "admin-uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1
  }
}
```

#### PUT - Update Setting
```
PUT /admin/settings/{key}
```

**Body:**
```json
{
  "value": "new_value_or_object",
  "description": "Updated description",
  "category": "business",
  "is_sensitive": false
}
```

#### POST - Create Setting
```
POST /admin/settings
```

**Body:**
```json
{
  "key": "custom.setting",
  "value": "setting_value",
  "description": "Setting description",
  "category": "custom",
  "is_sensitive": false
}
```

#### DELETE - Delete Setting
```
DELETE /admin/settings/{key}
```

**Note:** Core settings (business.opening_hours, booking.window_days, etc.) cannot be deleted.

### SMTP Test Email (`/netlify/functions/admin/settings-test-email`) 🆕

#### POST - Send Test Email
```
POST /admin/settings-test-email
```

**Body:**
```json
{
  "to": "test@example.com",
  "subject": "SMTP Test Email",
  "body": "This is a test email to verify SMTP configuration."
}
```

**Response:**
```json
{
  "message": "Test email sent successfully",
  "messageId": "smtp-message-id",
  "accepted": ["test@example.com"],
  "rejected": []
}
```

**Rate Limiting:** 5 requests per minute for email testing

### Customer Management (`/netlify/functions/admin/customers`) 🆕

#### GET - List Customers
```
GET /admin/customers?page=1&limit=20&isDeleted=false&search=maria&hasGdprConsent=true
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search in name, email, phone, customer number
- `sortBy` (string): Sort field (created_at, updated_at, profiles.full_name)
- `sortOrder` (asc|desc): Sort direction (default: desc)
- `isDeleted` (boolean): Include deleted customers (default: false)
- `hasGdprConsent` (boolean): Filter by GDPR consent status
- `city` (string): Filter by city
- `postalCode` (string): Filter by postal code
- `registeredAfter` (date): Filter customers registered after date
- `registeredBefore` (date): Filter customers registered before date

### Media Management (`/netlify/functions/admin/media`) 🆕

#### GET - List Media Files
```
GET /admin/media?page=1&limit=20&category=gallery&isActive=true
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search in title, filename, description
- `category` (string): Filter by category (before_after, team, salon, products, gallery, other)
- `tags` (array): Filter by tags
- `isPublic` (boolean): Filter by public status
- `isActive` (boolean): Filter by active status (default: true)
- `mimeType` (string): Filter by MIME type prefix (e.g., "image/", "video/")
- `sortBy` (string): Sort field (created_at, title, filename, file_size)
- `sortOrder` (asc|desc): Sort direction (default: desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "uuid",
        "filename": "uuid.jpg",
        "original_filename": "salon_photo.jpg",
        "file_path": "uploads/2024/1/uuid.jpg",
        "file_size": 1024000,
        "mime_type": "image/jpeg",
        "storage_bucket": "salon-media",
        "title": "Salon Interior",
        "description": "Beautiful salon interior photo",
        "category": "salon",
        "tags": ["interior", "modern", "clean"],
        "uploaded_by": "admin_uuid",
        "uploaded_at": "2024-01-15T10:00:00Z",
        "is_active": true,
        "is_public": false,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### POST - Create Media Record
```
POST /admin/media
Content-Type: application/json
```

**Request Body:**
```json
{
  "filename": "uuid.jpg",
  "original_filename": "photo.jpg",
  "file_path": "uploads/2024/1/uuid.jpg",
  "file_size": 1024000,
  "mime_type": "image/jpeg",
  "storage_bucket": "salon-media",
  "title": "Photo Title",
  "description": "Photo description",
  "category": "gallery",
  "tags": ["tag1", "tag2"],
  "is_public": false
}
```

#### PUT - Update Media Metadata
```
PUT /admin/media/{id}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "category": "salon",
  "tags": ["updated", "tags"],
  "is_public": true,
  "is_active": true
}
```

#### DELETE - Delete Media
```
DELETE /admin/media/{id}
```

**Note:** This deletes both the database record and the file from Supabase Storage.

### Media Upload (`/netlify/functions/admin/media/upload`) 🆕

#### GET - Get Signed Upload URL
```
GET /admin/media/upload?filename=photo.jpg&mimeType=image/jpeg
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://supabase-storage-signed-url...",
    "filePath": "uploads/2024/1/uuid.jpg",
    "uniqueFilename": "uuid.jpg"
  }
}
```

#### POST - Complete Upload
```
POST /admin/media/upload
Content-Type: application/json
```

**Request Body:**
```json
{
  "filePath": "uploads/2024/1/uuid.jpg",
  "originalFilename": "photo.jpg",
  "fileSize": 1024000,
  "mimeType": "image/jpeg",
  "title": "Photo Title",
  "description": "Photo description",
  "category": "gallery",
  "tags": ["tag1", "tag2"],
  "is_public": false
}
```

### Media Signed URLs (`/netlify/functions/admin/media/signed-url`) 🆕

#### GET - Get Single Signed URL
```
GET /admin/media/signed-url/{id}?expiresIn=3600
```

**Query Parameters:**
- `expiresIn` (number): URL expiry in seconds (default: 3600 = 1 hour)

**Response:**
```json
{
  "success": true,
  "data": {
    "media": {...},
    "signedUrl": "https://supabase-storage-signed-url...",
    "expiresAt": "2024-01-15T12:00:00Z"
  }
}
```

#### POST - Get Batch Signed URLs
```
POST /admin/media/signed-url
Content-Type: application/json
```

**Request Body:**
```json
{
  "mediaIds": ["uuid1", "uuid2", "uuid3"],
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "media": {...},
        "signedUrl": "https://...",
        "expiresAt": "2024-01-15T12:00:00Z"
      }
    ],
    "failed": [],
    "expiresIn": 3600
  }
}
```

**Response:**
```json
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "customer_number": "C20240001",
      "profile_id": "uuid",
      "date_of_birth": "1990-05-15",
      "address_street": "Musterstraße 123",
      "address_city": "Zürich",
      "address_postal_code": "8001",
      "emergency_contact_name": "John Doe",
      "emergency_contact_phone": "+41791234567",
      "notes": "Customer notes",
      "gdpr_consent_given": true,
      "gdpr_consent_date": "2024-01-15T10:00:00Z",
      "is_deleted": false,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-20T15:30:00Z",
      "profiles": {
        "id": "uuid",
        "email": "maria@example.com",
        "full_name": "Maria Schmidt",
        "phone": "+41791234567",
        "role": "customer"
      },
      "stats": {
        "total_appointments": 15,
        "upcoming_appointments": 2,
        "completed_appointments": 12,
        "cancelled_appointments": 1,
        "total_spent": 850.50,
        "last_appointment_date": "2024-01-20T14:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### GET - Get Customer Details
```
GET /admin/customers/{customerId}
```

Returns detailed customer information including statistics.

#### POST - Create Customer
```
POST /admin/customers
Content-Type: application/json

{
  "email": "new.customer@example.com",
  "full_name": "New Customer",
  "phone": "+41791234567",
  "date_of_birth": "1985-03-20",
  "address_street": "Beispielstraße 456",
  "address_city": "Bern",
  "address_postal_code": "3001",
  "emergency_contact_name": "Emergency Contact",
  "emergency_contact_phone": "+41791234568",
  "notes": "VIP customer",
  "gdpr_consent_given": true
}
```

**Response:** Created customer object (201)

#### PUT - Update Customer
```
PUT /admin/customers/{customerId}
Content-Type: application/json

{
  "full_name": "Updated Name",
  "phone": "+41799999999",
  "notes": "Updated notes",
  "gdpr_consent_given": true
}
```

**Response:** Updated customer object

#### DELETE - Soft Delete Customer (GDPR Compliant)
```
DELETE /admin/customers/{customerId}
Content-Type: application/json

{
  "reason": "Customer requested account deletion"
}
```

**Features:**
- Soft delete (sets `is_deleted: true`)
- Maintains data integrity for historical records
- Logs deletion reason and administrator
- Automatic audit trail entry

#### PATCH - Restore Deleted Customer
```
PATCH /admin/customers/{customerId}/restore
```

Restores a soft-deleted customer account.

#### GET - Export Customer Data (GDPR Right to Portability)
```
GET /admin/customers/{customerId}/export
```

**Response:**
```json
{
  "export_timestamp": "2024-01-20T15:30:00Z",
  "customer_data": {
    "customer_info": { /* customer record */ },
    "profile_info": { /* profile record */ }
  },
  "appointments": [ /* all appointments */ ],
  "audit_history": [ /* GDPR audit trail */ ]
}
```

#### GET - Customer Audit Log
```
GET /admin/customers/{customerId}/audit-log
```

Returns complete GDPR-compliant audit trail for customer:
- All data modifications
- Export requests
- Deletion/restoration events
- Who performed each action and when

### Staff Management (`/netlify/functions/admin/staff`)

#### GET - List Staff
```
GET /admin/staff?page=1&limit=20&isActive=true&search=maria
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `isActive` (boolean): Filter by active status
- `search` (string): Search in name, email
- `specialties` (array): Filter by specialties
- `sortBy` (string): Sort field (default: created_at)
- `sortOrder` (asc|desc): Sort direction

**Response:**
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": "uuid",
        "profile_id": "uuid",
        "email": "maria@salon.com",
        "first_name": "Maria",
        "last_name": "Schmidt",
        "phone": "+49123456789",
        "avatar_url": "https://...",
        "specialties": ["Damenschnitte", "Colorationen"],
        "bio": "Experienced stylist...",
        "hire_date": "2020-01-15",
        "hourly_rate": 25.00,
        "commission_rate": 15.50,
        "is_active": true,
        "services": [
          {
            "id": "uuid",
            "name": "Damenschnitt",
            "category": "Cuts",
            "price_cents": 4500,
            "duration_minutes": 45
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 4,
      "totalPages": 1
    }
  }
}
```

#### POST - Create Staff
```json
{
  "email": "new@salon.com",
  "first_name": "Anna",
  "last_name": "Weber",
  "phone": "+49123456790",
  "specialties": ["Hochsteckfrisuren"],
  "bio": "Creative stylist specializing in updos",
  "hire_date": "2024-01-15",
  "hourly_rate": 27.00,
  "commission_rate": 18.00,
  "is_active": true,
  "serviceIds": ["uuid1", "uuid2"]
}
```

#### PUT - Update Staff
```
PUT /admin/staff/{staffId}
```
Same body as POST, all fields optional.

#### DELETE - Deactivate Staff
```
DELETE /admin/staff/{staffId}
```
Soft delete - sets `is_active: false`. Cannot delete staff with future appointments.

### Services Management (`/netlify/functions/admin/services`)

#### GET - List Services
```
GET /admin/services?category=Damenschnitte&isActive=true
```

#### POST - Create Service
```json
{
  "name": "Premium Coloration",
  "description": "Professional hair coloring with premium products",
  "duration_minutes": 120,
  "price_cents": 9500,
  "category": "Colorationen",
  "is_active": true,
  "requires_consultation": true,
  "staffIds": ["uuid1", "uuid2"]
}
```

#### PUT - Update Service
```
PUT /admin/services/{serviceId}
```

#### DELETE - Deactivate Service
```
DELETE /admin/services/{serviceId}
```

### Appointments Management (`/netlify/functions/admin/appointments`)

#### GET - List Appointments
```
GET /admin/appointments?staffId=uuid&startDate=2024-01-01&endDate=2024-01-31&status=confirmed
```

**Query Parameters:**
- `staffId` (uuid): Filter by staff member
- `serviceId` (uuid): Filter by service
- `customerId` (uuid): Filter by customer
- `status` (enum): pending|confirmed|completed|cancelled|no_show
- `startDate` (date): Filter from date (YYYY-MM-DD)
- `endDate` (date): Filter to date (YYYY-MM-DD)
- `search` (string): Search customer name, email, service

#### POST - Create Appointment
```json
{
  "customer_id": "uuid",
  "staff_id": "uuid",
  "service_id": "uuid",
  "start_time": "2024-01-15T10:00:00Z",
  "end_time": "2024-01-15T11:00:00Z",
  "status": "confirmed",
  "notes": "Customer prefers natural colors"
}
```

**Automatic Validation:**
- Conflict checking with existing appointments
- Staff availability validation
- Service-staff compatibility check
- Time-off period validation

#### PUT - Update Appointment
```
PUT /admin/appointments/{appointmentId}
```

**Special Status Updates:**
```json
{
  "status": "cancelled",
  "cancellation_reason": "Customer requested cancellation"
}
```

#### DELETE - Cancel Appointment
```
DELETE /admin/appointments/{appointmentId}
```
Soft delete - marks as cancelled. Cannot delete completed appointments.

## Business Logic

### Conflict Detection
The system automatically prevents:
- Double-booking staff members
- Booking during staff time-off
- Booking outside staff availability hours
- Booking services not offered by staff member
- Booking in the past

### Appointment Workflow
1. **Pending**: Initial status when customer books
2. **Confirmed**: Admin/staff confirms the appointment
3. **Completed**: Service finished, revenue recorded
4. **Cancelled**: Appointment cancelled (with reason)
5. **No Show**: Customer didn't arrive

### Staff Availability
- Weekly recurring schedule (Monday=1, Sunday=0)
- Time ranges for each day (e.g., 09:00-18:00)
- Individual time-off periods override availability
- Time-off requires approval workflow

### Service Assignment
- Many-to-many relationship between staff and services
- Custom pricing per staff-service combination
- Staff can only be booked for assigned services

## Data Validation

### Required Fields
- **Staff**: email, first_name, last_name
- **Service**: name, duration_minutes, price_cents
- **Appointment**: customer_id, staff_id, service_id, start_time, end_time

### Constraints
- Email must be unique and valid format
- Phone must match international format
- Hourly rate and commission rate must be positive
- Service duration must be positive
- Appointment end_time must be after start_time
- Time-off end_date must be after start_date

### Business Rules
- Cannot delete staff/services with future appointments
- Cannot book appointments in the past
- Staff must be active to receive bookings
- Services must be active to be bookable
- Media files are only accessible via signed URLs 🆕
- Only admin users can upload/delete media files 🆕
- File size limited to 10MB by default 🆕
- Supported file types: JPEG, PNG, WebP, GIF, MP4, WebM, MOV 🆕

## Error Handling

### Common Error Codes
- `VALIDATION_ERROR`: Request data validation failed
- `STAFF_NOT_FOUND`: Staff member doesn't exist
- `SERVICE_NOT_FOUND`: Service doesn't exist
- `APPOINTMENT_CONFLICT`: Time slot conflicts
- `STAFF_SERVICE_MISMATCH`: Staff doesn't offer service
- `HAS_FUTURE_APPOINTMENTS`: Cannot delete with future bookings
- `INSUFFICIENT_PERMISSIONS`: User lacks required role
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `MEDIA_NOT_FOUND`: Media file doesn't exist 🆕
- `FILE_TOO_LARGE`: Upload exceeds size limit 🆕
- `INVALID_FILE_TYPE`: File type not allowed 🆕
- `FILE_NOT_FOUND`: File not found in storage 🆕
- `UPLOAD_FAILED`: File upload to storage failed 🆕

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Staff member does not offer this service",
    "code": "STAFF_SERVICE_MISMATCH",
    "details": {
      "staffId": "uuid",
      "serviceId": "uuid"
    }
  }
}
```

## Performance Considerations

### Database Optimization
- Indexes on frequently queried columns
- Efficient pagination with LIMIT/OFFSET
- Optimized joins in views
- Conflict checking via database functions

### Caching Strategy
- Business settings cached for 5 minutes
- Staff availability cached for 1 minute
- Service catalog cached for 10 minutes

### Rate Limiting
- Admin operations: 50 requests/minute
- General API: 100 requests/minute
- Booking creation: 10 requests/minute (stricter)

## Security

### Data Protection
- Row Level Security (RLS) policies
- JWT token validation
- Role-based access control
- Audit logging with correlation IDs

### GDPR Compliance
- Soft delete for customer data
- Data export capabilities
- Anonymization of old records
- Consent tracking (future feature)

## Monitoring & Logging

### Structured Logging
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "correlationId": "req_1234567890_abc123",
  "level": "info",
  "message": "Staff member created successfully",
  "userId": "uuid",
  "staffId": "uuid"
}
```

### Key Metrics
- API response times
- Error rates by endpoint
- Authentication failures
- Database query performance

## Business Settings Management 🆕

### Overview
The business settings system provides centralized configuration management for all business operations. Settings are stored in the database and can be managed through the admin interface.

### Settings Categories

#### Business Information
- **Business Name**: Display name for the salon
- **Address**: Physical business address
- **Phone**: Contact phone number  
- **Email**: Business email address
- **Opening Hours**: Configurable hours for each day of the week

#### Booking Configuration
- **Booking Window**: Maximum days in advance customers can book (1-365 days)
- **Buffer Time**: Minutes between appointments (0-120 minutes)
- **Cancellation Hours**: Minimum notice required for cancellations (0-168 hours)

#### Email & SMTP Configuration
- **SMTP Host**: Email server hostname
- **SMTP Port**: Server port (typically 587 or 465)
- **SMTP User**: Authentication username
- **SMTP Password**: Authentication password (encrypted)
- **From Email**: Sender email address
- **From Name**: Sender display name

### Admin UI Features

#### Settings Management Interface
- **Tabbed Interface**: Organized by category (Business, Booking, Email)
- **Real-time Validation**: Form validation with helpful error messages
- **Visual Feedback**: Live preview of setting effects
- **Audit Trail**: Track who made changes and when

#### Opening Hours Configuration
- **Day-by-day Setup**: Enable/disable and set hours for each day
- **Visual Schedule**: Clear display of business hours
- **Flexible Timing**: Support for different hours per day

#### SMTP Testing
- **Configuration Test**: Send test emails to verify setup
- **Error Diagnosis**: Detailed error messages for troubleshooting
- **Security**: Sensitive credentials are masked in the UI

### Security & Access Control

#### Role-Based Access
- **Admin**: Full access to all settings including sensitive data
- **Staff**: Read-only access to non-sensitive settings
- **Customer**: No access to business settings

#### Data Protection
- **Sensitive Settings**: SMTP passwords and other credentials are encrypted
- **Audit Logging**: All changes are tracked with user and timestamp
- **Rate Limiting**: API endpoints have appropriate rate limits

### Integration with Booking System

#### How Settings Affect Bookings
- **Opening Hours**: Determines available appointment slots
- **Buffer Time**: Automatically added between appointments
- **Booking Window**: Limits how far in advance customers can book
- **Cancellation Policy**: Enforced in the booking interface

#### Real-time Updates
- Settings changes take effect immediately
- React Query cache invalidation ensures UI stays synchronized
- No server restart required for configuration changes

### Technical Implementation

#### Database Schema
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);
```

#### API Architecture
- **RESTful Endpoints**: Standard CRUD operations
- **JWT Authentication**: Secure admin-only access
- **Zod Validation**: Type-safe request/response validation
- **Error Handling**: Structured error responses

#### Frontend Architecture
- **React Query**: Efficient data fetching and caching
- **Form Validation**: Real-time validation with react-hook-form
- **Type Safety**: Full TypeScript support
- **Responsive Design**: Works on all device sizes

## Future Enhancements

### Planned Features
- Email notifications for appointments
- SMS reminders
- Customer loyalty program
- Advanced analytics dashboard
- Mobile app API
- Multi-location support
- Online payment integration
- Image optimization and thumbnails 🆕
- Video transcoding for web playback 🆕
- Media CDN integration 🆕
- Media search by AI-generated tags 🆕