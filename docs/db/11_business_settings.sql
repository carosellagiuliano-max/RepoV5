-- Business Settings & Configuration
-- Migration 11: Enhance existing business_settings table with advanced features

-- Enhance business_settings table with new columns
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);

-- Convert value column from TEXT to JSONB for better data handling
ALTER TABLE business_settings 
  ALTER COLUMN value TYPE JSONB USING value::JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS business_settings_key_idx ON business_settings(key);
CREATE INDEX IF NOT EXISTS business_settings_category_idx ON business_settings(category);

-- Update RLS policies for business_settings table
DROP POLICY IF EXISTS "Admins can manage all settings" ON business_settings;
DROP POLICY IF EXISTS "Staff can read all settings" ON business_settings;
DROP POLICY IF EXISTS "Customers can read public settings" ON business_settings;

-- Admin can do everything
CREATE POLICY "Admins can manage all settings" ON business_settings
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Staff can only read settings
CREATE POLICY "Staff can read all settings" ON business_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff');

-- Customers can only read public settings
CREATE POLICY "Customers can read public settings" ON business_settings
  FOR SELECT
  TO authenticated
  USING (
    is_public = true AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
  );

-- Clear existing settings and insert enhanced default business settings
DELETE FROM business_settings;

INSERT INTO business_settings (key, value, description, category, is_public) VALUES
-- Business Hours (public so customers can see them)
('business_hours', '{
  "monday": {"open": "09:00", "close": "18:00", "closed": false},
  "tuesday": {"open": "09:00", "close": "18:00", "closed": false},
  "wednesday": {"open": "09:00", "close": "18:00", "closed": false},
  "thursday": {"open": "09:00", "close": "18:00", "closed": false},
  "friday": {"open": "09:00", "close": "18:00", "closed": false},
  "saturday": {"open": "09:00", "close": "16:00", "closed": false},
  "sunday": {"open": "10:00", "close": "16:00", "closed": true}
}', 'Default business opening hours for each day of the week', 'business_hours', true),

-- Booking Configuration (public so customers understand limits)
('booking_window_days', '30', 'Maximum days in advance customers can book appointments', 'booking', true),
('buffer_time_minutes', '15', 'Buffer time between appointments in minutes', 'booking', true),
('min_advance_booking_hours', '24', 'Minimum hours in advance for booking', 'booking', true),
('max_appointments_per_day', '50', 'Maximum number of appointments per day', 'booking', false),

-- Cancellation Policy (public)
('cancellation_hours', '24', 'Hours before appointment that cancellation is allowed', 'booking', true),
('no_show_policy', '"No-show appointments will be charged 50% of service fee"', 'Policy for no-show appointments', 'booking', true),

-- SMTP Configuration (private - admin only)
('smtp_host', '""', 'SMTP server hostname', 'email', false),
('smtp_port', '587', 'SMTP server port', 'email', false),
('smtp_user', '""', 'SMTP username', 'email', false),
('smtp_password', '""', 'SMTP password (encrypted)', 'email', false),
('smtp_from_email', '"noreply@schnittwerk-your-style.de"', 'Default from email address', 'email', false),
('smtp_from_name', '"Schnittwerk Your Style"', 'Default from name', 'email', false),
('smtp_use_tls', 'true', 'Use TLS encryption for SMTP', 'email', false),

-- Business Information (public)
('business_name', '"Schnittwerk Your Style"', 'Business name', 'business_info', true),
('business_address', '"Musterstraße 123, 12345 Musterstadt"', 'Business address', 'business_info', true),
('business_phone', '"+49 123 456789"', 'Business phone number', 'business_info', true),
('business_email', '"info@schnittwerk-your-style.de"', 'Business email', 'business_info', true),

-- Notification Settings (private)
('email_notifications_enabled', 'true', 'Enable email notifications', 'notifications', false),
('sms_notifications_enabled', 'false', 'Enable SMS notifications', 'notifications', false),
('booking_confirmation_email', 'true', 'Send email confirmation for bookings', 'notifications', false),
('booking_reminder_email', 'true', 'Send email reminders before appointments', 'notifications', false),
('reminder_hours_before', '24', 'Hours before appointment to send reminder', 'notifications', false);

-- Update the existing trigger to handle updated_by
DROP TRIGGER IF EXISTS update_business_settings_updated_at ON business_settings;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Create enhanced trigger function for business_settings
CREATE OR REPLACE FUNCTION update_business_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_settings_updated_at_trigger
  BEFORE UPDATE ON business_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_business_settings_updated_at();

-- Function to get a setting value by key
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS JSONB AS $$
DECLARE
  setting_value JSONB;
BEGIN
  SELECT value INTO setting_value
  FROM business_settings
  WHERE key = setting_key;
  
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a setting value
CREATE OR REPLACE FUNCTION update_setting(setting_key TEXT, setting_value JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  -- Check if user has admin role
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update settings';
  END IF;

  UPDATE business_settings 
  SET value = setting_value,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE key = setting_key;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback instructions:
-- To rollback this migration, run:
/*
DROP TRIGGER IF EXISTS update_business_settings_updated_at_trigger ON business_settings;
DROP FUNCTION IF EXISTS update_business_settings_updated_at();
DROP FUNCTION IF EXISTS get_setting(TEXT);
DROP FUNCTION IF EXISTS update_setting(TEXT, JSONB);

ALTER TABLE business_settings
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS updated_by,
  ALTER COLUMN value TYPE TEXT USING value::TEXT;

-- Restore original simple trigger
CREATE TRIGGER update_business_settings_updated_at 
  BEFORE UPDATE ON business_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/