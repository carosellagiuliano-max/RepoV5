-- Business Settings RLS Policies
-- Controls access to business settings (UPDATED FOR CONSOLIDATED SCHEMA)

-- Enable RLS on business_settings table
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can manage all settings
CREATE POLICY "Admins can manage all business settings"
ON business_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 2: Authenticated users can read business settings
CREATE POLICY "Authenticated users can read business settings"
ON business_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Policy 3: Anonymous users can read basic business info
CREATE POLICY "Anonymous can read basic business info"
ON business_settings
FOR SELECT
TO anon
USING (
  key IN ('business_name', 'business_address', 'business_phone', 'business_email', 'opening_hours', 'working_hours')
);