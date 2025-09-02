-- Enhanced database schema to align with TypeScript types
-- This migration updates the existing schema for production readiness

-- Update the profiles table to match our types
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS full_name,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update the staff table to align with our types
ALTER TABLE staff 
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS staff_number,
  DROP COLUMN IF EXISTS status,
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 100),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update customers table structure
ALTER TABLE customers
  DROP COLUMN IF EXISTS customer_number,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS address_street,
  DROP COLUMN IF EXISTS address_city,
  DROP COLUMN IF EXISTS address_postal_code,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS notes;

-- Update services table to match our types
ALTER TABLE services
  DROP COLUMN IF EXISTS base_price,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_consultation BOOLEAN DEFAULT false;

-- Update appointments table to match our types
ALTER TABLE appointments
  DROP COLUMN IF EXISTS starts_at,
  DROP COLUMN IF EXISTS ends_at,
  DROP COLUMN IF EXISTS price,
  DROP COLUMN IF EXISTS internal_notes,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Fix appointment status enum to match our types
DROP TYPE IF EXISTS appointment_status CASCADE;
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');

-- Add the status column back
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS status appointment_status DEFAULT 'pending';

-- Update staff_availability table
ALTER TABLE staff_availability
  DROP COLUMN IF EXISTS availability_type,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Update staff_timeoff table
ALTER TABLE staff_timeoff
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Rename media_assets to media_files to match our types
DROP TABLE IF EXISTS media_files;
ALTER TABLE IF EXISTS media_assets RENAME TO media_files;

-- Update media_files table structure
ALTER TABLE media_files
  DROP COLUMN IF EXISTS original_filename,
  DROP COLUMN IF EXISTS width,
  DROP COLUMN IF EXISTS height,
  DROP COLUMN IF EXISTS alt_text,
  DROP COLUMN IF EXISTS caption,
  ADD COLUMN IF NOT EXISTS original_name TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS file_path TEXT NOT NULL DEFAULT '/uploads/unknown';

-- Rename settings to business_settings
DROP TABLE IF EXISTS business_settings;
ALTER TABLE IF EXISTS settings RENAME TO business_settings;

-- Update business_settings table
ALTER TABLE business_settings
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS is_public,
  ALTER COLUMN value TYPE TEXT USING value::TEXT;

-- Add proper constraints and indexes
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS no_overlapping_appointments,
  DROP CONSTRAINT IF EXISTS valid_time_range;

-- Add new constraints
ALTER TABLE appointments
  ADD CONSTRAINT valid_appointment_time_range CHECK (end_time > start_time);

-- Create new indexes for better performance
DROP INDEX IF EXISTS idx_appointments_starts_at;
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_end_time ON appointments(end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status_start_time ON appointments(status, start_time);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_timeoff_approved ON staff_timeoff(is_approved);

-- Update existing triggers
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add missing triggers for new tables
CREATE TRIGGER update_staff_timeoff_updated_at 
  BEFORE UPDATE ON staff_timeoff 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_files_updated_at 
  BEFORE UPDATE ON media_files 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_settings_updated_at 
  BEFORE UPDATE ON business_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();