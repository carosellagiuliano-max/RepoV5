-- Rollback for Business Settings & Configuration
-- Run this if you need to undo 11_business_settings.sql

-- Drop triggers and functions
DROP TRIGGER IF EXISTS settings_update_metadata ON settings;
DROP FUNCTION IF EXISTS update_settings_metadata();
DROP FUNCTION IF EXISTS validate_appointment_timing(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS is_within_business_hours(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_business_setting(TEXT);
DROP FUNCTION IF EXISTS validate_opening_hours(JSONB);

-- Remove business settings
DELETE FROM settings WHERE key IN (
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

-- Drop indexes
DROP INDEX IF EXISTS idx_settings_category;
DROP INDEX IF EXISTS idx_settings_key;

-- Remove updated_by column
ALTER TABLE settings DROP COLUMN IF EXISTS updated_by;