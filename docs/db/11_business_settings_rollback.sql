-- Rollback for Business Settings Management
-- Safely removes settings table and related functions

-- Drop functions first
DROP FUNCTION IF EXISTS update_setting(TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS get_setting(TEXT);

-- Drop RLS policies
DROP POLICY IF EXISTS "Admins can manage all settings" ON settings;
DROP POLICY IF EXISTS "Staff can read non-sensitive settings" ON settings;
DROP POLICY IF EXISTS "Customers cannot access settings" ON settings;

-- Drop indexes
DROP INDEX IF EXISTS idx_settings_key;
DROP INDEX IF EXISTS idx_settings_category;

-- Drop table
DROP TABLE IF EXISTS settings;