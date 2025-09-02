-- Business Settings RLS Policies
-- Controls access to business settings

-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can manage all settings
CREATE POLICY "Admins can manage all settings"
ON settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 2: Staff can read business settings (public ones)
CREATE POLICY "Staff can read public business settings"
ON settings
FOR SELECT
TO authenticated
USING (
  is_public = true
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('staff', 'admin')
  )
);

-- Policy 3: Customers can read very limited public settings
CREATE POLICY "Customers can read limited public settings"  
ON settings
FOR SELECT
TO authenticated
USING (
  is_public = true
  AND category = 'business'
  AND key IN ('business_name', 'business_address', 'business_phone', 'business_email', 'opening_hours', 'max_advance_booking_days')
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'customer'
  )
);

-- Policy 4: Anonymous users can read very basic public info
CREATE POLICY "Anonymous can read basic business info"
ON settings  
FOR SELECT
TO anon
USING (
  is_public = true
  AND category = 'business'
  AND key IN ('business_name', 'opening_hours')
);