# Business Settings & Configuration - Implementation Summary

## Overview

This implementation provides comprehensive business settings management for the Schnittwerk salon system, allowing admins to configure and enforce central business rules throughout the booking flow.

## Features Implemented

### 1. Database Schema & Migrations

**Migration Files:**
- `docs/db/11_business_settings.sql` - Enhanced settings table with business settings
- `docs/db/11_business_settings_rollback.sql` - Rollback script
- `docs/db/12_business_settings_rls.sql` - Row Level Security policies

**Key Database Functions:**
- `validate_opening_hours(hours JSONB)` - Validates opening hours JSON structure
- `get_business_setting(setting_key TEXT)` - Retrieves business settings with type casting
- `is_within_business_hours(check_datetime TIMESTAMPTZ)` - Checks if datetime is within business hours
- `validate_appointment_timing()` - Validates appointments against business rules

### 2. Backend API (Netlify Functions)

**Settings Management (`/netlify/functions/admin/settings.ts`):**
- GET: Retrieve settings by category
- PUT: Batch update settings
- PATCH: Update single setting
- Full JWT authentication + admin role validation
- Comprehensive Zod schema validation

**SMTP Testing (`/netlify/functions/admin/smtp-test.ts`):**
- Server-side only email testing
- Professional HTML email templates
- SMTP connection validation
- Detailed error reporting

**Enhanced Booking Functions:**
- `booking-create.ts`: Now validates against business settings (opening hours, advance booking limits, buffer time)
- `availability.ts`: Uses dynamic buffer time from settings

### 3. Frontend Implementation

**React Query Hooks (`src/hooks/use-settings.ts`):**
- `useBusinessSettings()` - Load business settings
- `useEmailSettings()` - Load email settings  
- `useUpdateBusinessSettings()` - Update business settings
- `useUpdateEmailSettings()` - Update email settings
- `useSmtpTest()` - Send test emails
- `useAppointmentValidation()` - Validate appointments against business rules

**Admin UI (`src/components/admin/AdminSettings.tsx`):**
- Real-time business settings management
- Opening hours configuration (7 days with individual time ranges)
- Business information management
- SMTP configuration and testing
- Loading states and error handling

**Booking Flow Integration (`src/components/booking/appointment-booking-dialog.tsx`):**
- Dynamic time slot generation based on opening hours
- Calendar respects business hours and advance booking limits
- Real-time appointment validation
- Business rule enforcement at UI level

### 4. Business Settings Structure

**Opening Hours:**
```json
{
  "0": {"is_open": false, "start_time": "10:00", "end_time": "14:00"}, // Sunday
  "1": {"is_open": true, "start_time": "09:00", "end_time": "18:00"},  // Monday
  "2": {"is_open": true, "start_time": "09:00", "end_time": "18:00"},  // Tuesday
  "3": {"is_open": true, "start_time": "09:00", "end_time": "18:00"},  // Wednesday
  "4": {"is_open": true, "start_time": "09:00", "end_time": "19:00"},  // Thursday
  "5": {"is_open": true, "start_time": "09:00", "end_time": "19:00"},  // Friday
  "6": {"is_open": true, "start_time": "08:00", "end_time": "16:00"}   // Saturday
}
```

**Business Settings:**
- `max_advance_booking_days`: 1-365 days (default: 30)
- `buffer_time_minutes`: 0-120 minutes (default: 15)
- `business_name`: Salon name
- `business_address`: Full address
- `business_phone`: Contact phone
- `business_email`: Contact email

**Email Settings:**
- SMTP server configuration
- Authentication credentials
- From email/name settings
- TLS encryption toggle

## Business Rule Enforcement

### 1. Opening Hours
- **Calendar**: Disables closed days in date picker
- **Time Slots**: Generated dynamically based on business hours for selected date
- **Backend**: Validates all appointments against opening hours

### 2. Advance Booking Limits
- **Frontend**: Calendar disables dates beyond max advance booking limit
- **Backend**: Validates appointment start date against max advance days setting

### 3. Buffer Time
- **Availability**: Uses dynamic buffer time from settings (not hardcoded)
- **Booking**: Applies buffer time between appointments
- **Conflict Detection**: Prevents bookings within buffer time of existing appointments

### 4. Real-time Validation
- Settings loaded from database on each request
- Frontend validates before API calls
- Backend validates before database operations
- Database functions provide final validation layer

## API Endpoints

### Settings Management
```
GET    /admin/settings?category=business
PUT    /admin/settings
PATCH  /admin/settings?key=setting_key
```

### SMTP Testing
```
POST   /admin/smtp-test
```

## Security & Access Control

**Row Level Security:**
- Admins: Full read/write access to all settings
- Staff: Read access to public business settings only
- Customers: Read access to very limited public settings (business name, opening hours)
- Anonymous: Read access to basic public info only

**Authentication:**
- JWT token validation required
- Admin role required for modifications
- Rate limiting: 50 requests/minute for settings, 10 requests/15min for SMTP

## Environment Variables

**Required for SMTP functionality:**
```
SMTP_HOST=your_smtp_server
SMTP_PORT=587
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password
SMTP_FROM_EMAIL=noreply@schnittwerk-your-style.de
SMTP_FROM_NAME=Schnittwerk Your Style
SMTP_USE_TLS=true
```

## Deployment Instructions

### 1. Database Migration
Run the following SQL files in order in Supabase SQL Editor:
1. `docs/db/11_business_settings.sql`
2. `docs/db/12_business_settings_rls.sql`

### 2. Environment Variables
Set the SMTP configuration variables in Netlify environment settings.

### 3. Verification
1. Admin can access settings in admin panel
2. SMTP test sends emails successfully
3. Booking calendar respects opening hours
4. Time slots match business hours
5. Advance booking limits are enforced

## File Changes Summary

**Database:**
- `docs/db/11_business_settings.sql` (NEW)
- `docs/db/11_business_settings_rollback.sql` (NEW)
- `docs/db/12_business_settings_rls.sql` (NEW)

**Backend:**
- `netlify/functions/admin/settings.ts` (NEW)
- `netlify/functions/admin/smtp-test.ts` (NEW)
- `netlify/functions/booking-create.ts` (UPDATED - business rules enforcement)
- `netlify/functions/availability.ts` (UPDATED - dynamic buffer time)

**Frontend:**
- `src/hooks/use-settings.ts` (NEW)
- `src/components/admin/AdminSettings.tsx` (UPDATED - real API integration)
- `src/components/booking/appointment-booking-dialog.tsx` (UPDATED - business rules)
- `src/lib/types/database.ts` (UPDATED - settings types)
- `src/lib/validation/schemas.ts` (UPDATED - settings schemas)

**Documentation:**
- `docs/admin.md` (UPDATED)
- `docs/integration.md` (UPDATED)
- `.env.example` (UPDATED)

**Dependencies:**
- `nodemailer` and `@types/nodemailer` added for SMTP functionality

## Maintainer To-Dos

1. **SQL Migration Order:** Run database migrations in the specified order
2. **Environment Variables:** Configure SMTP settings in Netlify environment
3. **Verify Functionality:** Test admin settings, SMTP, and booking enforcement
4. **Monitor:** Check that booking flow properly enforces business rules

## Testing Recommendations

**Unit Tests:**
- Settings validation (Zod schemas)
- Business rule validation functions
- SMTP configuration validation

**Integration Tests:**
- Settings CRUD operations
- SMTP test functionality
- Booking flow with various business settings

**E2E Tests:**
- Admin changes opening hours → booking calendar updates
- Admin changes advance booking limit → calendar respects limit
- Admin changes buffer time → availability calculation uses new time

This implementation provides a complete, production-ready business settings management system that strictly enforces business rules throughout the salon booking system.