-- Business Settings Management
-- Creates settings table for centralized business configuration

-- Settings table for key-value configuration storage
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create index for faster key lookups
CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category ON settings(category);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy 1: Admins can do everything
CREATE POLICY "Admins can manage all settings"
ON settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- Policy 2: Staff can read non-sensitive settings
CREATE POLICY "Staff can read non-sensitive settings"
ON settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'staff')
    AND profiles.is_active = true
  )
  AND (is_sensitive = false OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  ))
);

-- Policy 3: No access for customers (explicit deny)
CREATE POLICY "Customers cannot access settings"
ON settings
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Insert default business settings
INSERT INTO settings (key, value, description, category) VALUES
  ('business.opening_hours', 
   '{"monday":{"enabled":true,"start":"09:00","end":"18:00"},"tuesday":{"enabled":true,"start":"09:00","end":"18:00"},"wednesday":{"enabled":true,"start":"09:00","end":"18:00"},"thursday":{"enabled":true,"start":"09:00","end":"18:00"},"friday":{"enabled":true,"start":"09:00","end":"18:00"},"saturday":{"enabled":true,"start":"09:00","end":"18:00"},"sunday":{"enabled":false,"start":"09:00","end":"18:00"}}',
   'Default opening hours for each day of the week',
   'business'),
   
  ('booking.window_days', 
   '30',
   'Maximum number of days in advance customers can book appointments',
   'booking'),
   
  ('booking.buffer_time_minutes', 
   '15',
   'Buffer time between appointments in minutes',
   'booking'),
   
  ('booking.cancellation_hours', 
   '24',
   'Minimum hours before appointment start time to allow cancellation',
   'booking'),
   
  ('smtp.host', 
   '""',
   'SMTP server hostname for email notifications',
   'email',
   true),
   
  ('smtp.port', 
   '587',
   'SMTP server port',
   'email'),
   
  ('smtp.user', 
   '""',
   'SMTP authentication username',
   'email',
   true),
   
  ('smtp.password', 
   '""',
   'SMTP authentication password',
   'email',
   true),
   
  ('smtp.from_email', 
   '"noreply@schnittwerk-your-style.de"',
   'From email address for notifications',
   'email'),
   
  ('smtp.from_name', 
   '"Schnittwerk Your Style"',
   'From name for email notifications',
   'email'),
   
  ('business.name', 
   '"Schnittwerk Your Style"',
   'Business name displayed to customers',
   'business'),
   
  ('business.address', 
   '"Musterstraße 123, 12345 Musterstadt"',
   'Business address for contact information',
   'business'),
   
  ('business.phone', 
   '"+49 123 456789"',
   'Business phone number for contact',
   'business'),
   
  ('business.email', 
   '"info@schnittwerk-your-style.de"',
   'Business email address for contact',
   'business')
ON CONFLICT (key) DO NOTHING;

-- Function to update settings with audit trail
CREATE OR REPLACE FUNCTION update_setting(
  setting_key TEXT,
  setting_value JSONB,
  user_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
BEGIN
  UPDATE settings 
  SET 
    value = setting_value,
    updated_at = NOW(),
    updated_by = user_id
  WHERE key = setting_key;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting key % not found', setting_key;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT value INTO result 
  FROM settings 
  WHERE key = setting_key;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_setting(TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_setting(TEXT) TO authenticated;