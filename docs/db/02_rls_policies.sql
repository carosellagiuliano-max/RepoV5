-- Row Level Security (RLS) Policies for Schnittwerk
-- This file contains all RLS policies for secure data access

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_timeoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's customer record
CREATE OR REPLACE FUNCTION get_current_customer_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT c.id 
    FROM customers c
    JOIN profiles p ON c.profile_id = p.id
    WHERE p.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's staff record
CREATE OR REPLACE FUNCTION get_current_staff_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT s.id 
    FROM staff s
    JOIN profiles p ON s.profile_id = p.id
    WHERE p.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
-- Users can view their own profile, admins can view all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

-- Users can update their own profile, admins can update all
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin());

-- Only admins can insert profiles (user registration handled by auth)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can delete profiles
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (is_admin());

-- CUSTOMERS POLICIES
-- Customers can view their own data, staff/admin can view all
CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (
    profile_id = auth.uid() OR 
    is_staff()
  );

-- Customers can update their own data, staff/admin can update all
CREATE POLICY "customers_update" ON customers FOR UPDATE
  USING (
    profile_id = auth.uid() OR 
    is_admin()
  );

-- Staff/admin can create customer records
CREATE POLICY "customers_insert" ON customers FOR INSERT
  WITH CHECK (is_staff());

-- Only admins can delete customers
CREATE POLICY "customers_delete" ON customers FOR DELETE
  USING (is_admin());

-- STAFF POLICIES
-- Active staff visible to all authenticated users, all staff to admin/staff
CREATE POLICY "staff_select" ON staff FOR SELECT
  USING (
    (is_active = true AND auth.uid() IS NOT NULL) OR
    is_staff()
  );

-- Only admins can modify staff
CREATE POLICY "staff_insert" ON staff FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "staff_update" ON staff FOR UPDATE
  USING (is_admin());

CREATE POLICY "staff_delete" ON staff FOR DELETE
  USING (is_admin());

-- SERVICES POLICIES
-- Active services visible to all, all services to admin
CREATE POLICY "services_select" ON services FOR SELECT
  USING (
    (is_active = true) OR
    is_admin()
  );

-- Only admins can modify services
CREATE POLICY "services_insert" ON services FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "services_update" ON services FOR UPDATE
  USING (is_admin());

CREATE POLICY "services_delete" ON services FOR DELETE
  USING (is_admin());

-- STAFF_SERVICES POLICIES
-- Active mappings for active staff/services visible to all, all to admin
CREATE POLICY "staff_services_select" ON staff_services FOR SELECT
  USING (
    (is_active = true AND auth.uid() IS NOT NULL) OR
    is_admin()
  );

-- Only admins can modify staff-service mappings
CREATE POLICY "staff_services_insert" ON staff_services FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "staff_services_update" ON staff_services FOR UPDATE
  USING (is_admin());

CREATE POLICY "staff_services_delete" ON staff_services FOR DELETE
  USING (is_admin());

-- APPOINTMENTS POLICIES
-- Customers see their own appointments, staff see their assigned appointments, admin sees all
CREATE POLICY "appointments_select" ON appointments FOR SELECT
  USING (
    customer_id = get_current_customer_id() OR
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- Customers can create appointments for themselves, staff/admin can create any
CREATE POLICY "appointments_insert" ON appointments FOR INSERT
  WITH CHECK (
    customer_id = get_current_customer_id() OR
    is_staff()
  );

-- Customers can cancel their own appointments, staff can update their assigned appointments, admin can update all
CREATE POLICY "appointments_update" ON appointments FOR UPDATE
  USING (
    (customer_id = get_current_customer_id() AND status = 'pending') OR
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- Only admins can delete appointments
CREATE POLICY "appointments_delete" ON appointments FOR DELETE
  USING (is_admin());

-- STAFF_AVAILABILITY POLICIES
-- Visible to all authenticated users for booking, modifiable by staff themselves and admins
CREATE POLICY "staff_availability_select" ON staff_availability FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Staff can manage their own availability, admins can manage all
CREATE POLICY "staff_availability_insert" ON staff_availability FOR INSERT
  WITH CHECK (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "staff_availability_update" ON staff_availability FOR UPDATE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "staff_availability_delete" ON staff_availability FOR DELETE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- STAFF_TIMEOFF POLICIES
-- Visible to admins and the staff member themselves
CREATE POLICY "staff_timeoff_select" ON staff_timeoff FOR SELECT
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- Staff can manage their own timeoff, admins can manage all
CREATE POLICY "staff_timeoff_insert" ON staff_timeoff FOR INSERT
  WITH CHECK (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "staff_timeoff_update" ON staff_timeoff FOR UPDATE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "staff_timeoff_delete" ON staff_timeoff FOR DELETE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- MEDIA_ASSETS POLICIES
-- MEDIA_FILES POLICIES
-- Public assets visible to all, private assets to uploader and admins
CREATE POLICY "media_files_select" ON media_files FOR SELECT
  USING (
    is_public = true OR
    uploaded_by = auth.uid() OR
    is_admin()
  );

-- Authenticated users can upload, admins can upload anything
CREATE POLICY "media_files_insert" ON media_files FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND uploaded_by = auth.uid()) OR
    is_admin()
  );

-- Users can update their own uploads, admins can update all
CREATE POLICY "media_files_update" ON media_files FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    is_admin()
  );

-- Users can delete their own uploads, admins can delete all
CREATE POLICY "media_files_delete" ON media_files FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    is_admin()
  );

-- SETTINGS POLICIES
-- BUSINESS_SETTINGS POLICIES
-- Admins can view all settings.
CREATE POLICY "business_settings_select" ON business_settings FOR SELECT
  USING (is_admin());

-- Only admins can modify settings
CREATE POLICY "business_settings_insert" ON business_settings FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "business_settings_update" ON business_settings FOR UPDATE
  USING (is_admin());

CREATE POLICY "business_settings_delete" ON business_settings FOR DELETE
  USING (is_admin());