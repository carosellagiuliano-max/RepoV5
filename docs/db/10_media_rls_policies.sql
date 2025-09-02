-- Media Management RLS Policies
-- Controls access to media files and storage

-- Enable RLS on media table
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admin can do everything
CREATE POLICY "Admins can manage all media"
ON media
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

-- Policy 2: Staff can read media
CREATE POLICY "Staff can read media"
ON media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'staff')
    AND profiles.is_active = true
  )
);

-- Policy 3: Public media can be read by anyone (for public galleries)
CREATE POLICY "Public media readable by all"
ON media
FOR SELECT
TO anon, authenticated
USING (is_public = true AND is_active = true);

-- Supabase Storage policies for salon-media bucket
-- These need to be created in the Supabase dashboard under Storage > Policies

-- Storage Policy 1: Admin can upload files
-- Bucket: salon-media
-- Policy name: Admin can upload
-- Target roles: authenticated
-- Policy type: INSERT
-- Policy definition:
/*
(EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
  AND profiles.is_active = true
))
*/

-- Storage Policy 2: Admin can delete files
-- Bucket: salon-media
-- Policy name: Admin can delete
-- Target roles: authenticated
-- Policy type: DELETE
-- Policy definition:
/*
(EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
  AND profiles.is_active = true
))
*/

-- Storage Policy 3: Anyone can read files (we control access via signed URLs)
-- Bucket: salon-media
-- Policy name: Anyone can read
-- Target roles: authenticated, anon
-- Policy type: SELECT
-- Policy definition:
/*
true
*/

-- Comments for documentation
COMMENT ON POLICY "Admins can manage all media" ON media IS 'Allows admin users full CRUD access to all media records';
COMMENT ON POLICY "Staff can read media" ON media IS 'Allows staff users to read media records for admin interfaces';
COMMENT ON POLICY "Public media readable by all" ON media IS 'Allows public access to media marked as public';