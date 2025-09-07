-- Rollback for Business Settings & Configuration
-- Run this if you need to undo 11_business_settings.sql
-- UPDATED FOR CONSOLIDATED SCHEMA

-- Drop functions
DROP FUNCTION IF EXISTS validate_appointment_timing(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS is_within_business_hours(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_business_setting(TEXT);
DROP FUNCTION IF EXISTS validate_opening_hours(JSONB);

-- Remove business settings
DELETE FROM business_settings WHERE key IN (
    'opening_hours',
    'max_advance_booking_days',
    'buffer_time_minutes',
    'smtp_host',
    'smtp_port',
    'smtp_username',
    'smtp_password',
    'smtp_from_email',
    'smtp_from_name',
    'smtp_use_tls',
    'business_name',
    'business_address',
    'business_phone',
    'business_email'
);