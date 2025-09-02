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

## Future Enhancements

### Planned Features
- Email notifications for appointments
- SMS reminders
- Customer loyalty program
- Advanced analytics dashboard
- Mobile app API
- Multi-location support
- Online payment integration