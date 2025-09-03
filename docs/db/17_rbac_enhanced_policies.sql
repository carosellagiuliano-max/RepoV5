-- Enhanced RLS Policies for RBAC Refinement
-- Supports Admin/Staff/Receptionist/Customer roles with granular permissions
-- Includes field-level PII masking and comprehensive security policies

-- First update the user_role enum to include receptionist
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'receptionist';

-- Drop existing policies to recreate with enhanced logic
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;

DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;

DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_insert" ON services;
DROP POLICY IF EXISTS "services_update" ON services;
DROP POLICY IF EXISTS "services_delete" ON services;

DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

-- Enhanced helper functions for role checking

-- Helper function to check if current user is receptionist
CREATE OR REPLACE FUNCTION is_receptionist()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'receptionist'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has appointment management permissions
CREATE OR REPLACE FUNCTION has_appointment_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'staff', 'receptionist')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has customer management permissions
CREATE OR REPLACE FUNCTION has_customer_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'receptionist')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can manage system settings
CREATE OR REPLACE FUNCTION can_manage_system()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Field masking functions for PII protection

-- Mask email addresses for non-admin users
CREATE OR REPLACE FUNCTION mask_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only admins can see full email addresses
  IF is_admin() THEN
    RETURN email;
  END IF;
  
  -- Return masked email for other roles
  RETURN CASE 
    WHEN email IS NULL THEN NULL
    WHEN LENGTH(email) < 5 THEN '***'
    ELSE SUBSTRING(email FROM 1 FOR 2) || '***@***' || 
         SUBSTRING(email FROM POSITION('.' IN REVERSE(email)) FOR 2)
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mask phone numbers for non-admin users
CREATE OR REPLACE FUNCTION mask_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only admins can see full phone numbers
  IF is_admin() THEN
    RETURN phone;
  END IF;
  
  -- Return masked phone for other roles
  RETURN CASE
    WHEN phone IS NULL THEN NULL
    WHEN LENGTH(phone) < 8 THEN '***'
    ELSE SUBSTRING(phone FROM 1 FOR 3) || '***' || 
         SUBSTRING(phone FROM LENGTH(phone) - 1)
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced PROFILES POLICIES
-- Users can view their own profile, admins can view all, staff/receptionist can view basic info of others
CREATE POLICY "enhanced_profiles_select" ON profiles FOR SELECT
  USING (
    id = auth.uid() OR 
    is_admin() OR
    (is_staff() AND role IN ('admin', 'staff', 'receptionist')) OR
    (is_receptionist() AND role IN ('admin', 'staff', 'receptionist'))
  );

-- Users can update their own profile, admins can update all
CREATE POLICY "enhanced_profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin());

-- Only admins can insert profiles (user registration handled by auth)
CREATE POLICY "enhanced_profiles_insert" ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can delete profiles
CREATE POLICY "enhanced_profiles_delete" ON profiles FOR DELETE
  USING (is_admin());

-- Enhanced CUSTOMERS POLICIES with field-level masking
-- Admin can see all, receptionist can see all, staff can see customers with appointments, customers see own
CREATE POLICY "enhanced_customers_select" ON customers FOR SELECT
  USING (
    is_admin() OR
    is_receptionist() OR
    profile_id = auth.uid() OR 
    (is_staff() AND EXISTS (
      SELECT 1 FROM appointments a
      JOIN staff s ON s.id = a.staff_id
      WHERE s.profile_id = auth.uid() AND a.customer_id = customers.id
    ))
  );

-- Admin and receptionist can update all customers, customers can update own data, staff cannot update
CREATE POLICY "enhanced_customers_update" ON customers FOR UPDATE
  USING (
    is_admin() OR
    is_receptionist() OR
    profile_id = auth.uid()
  );

-- Admin, receptionist, and staff can create customer records
CREATE POLICY "enhanced_customers_insert" ON customers FOR INSERT
  WITH CHECK (has_appointment_access());

-- Only admins can delete customers (soft delete)
CREATE POLICY "enhanced_customers_delete" ON customers FOR DELETE
  USING (is_admin());

-- Enhanced STAFF POLICIES
-- Active staff visible to all authenticated users, all staff to admin
-- Receptionist can view staff for appointment management
CREATE POLICY "enhanced_staff_select" ON staff FOR SELECT
  USING (
    (status = 'active' AND auth.uid() IS NOT NULL) OR
    is_admin()
  );

-- Only admins can modify staff
CREATE POLICY "enhanced_staff_insert" ON staff FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "enhanced_staff_update" ON staff FOR UPDATE
  USING (is_admin());

CREATE POLICY "enhanced_staff_delete" ON staff FOR DELETE
  USING (is_admin());

-- Enhanced SERVICES POLICIES
-- Active services visible to all, all services to admin
CREATE POLICY "enhanced_services_select" ON services FOR SELECT
  USING (
    (is_active = true) OR
    is_admin()
  );

-- Only admins can modify services
CREATE POLICY "enhanced_services_insert" ON services FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "enhanced_services_update" ON services FOR UPDATE
  USING (is_admin());

CREATE POLICY "enhanced_services_delete" ON services FOR DELETE
  USING (is_admin());

-- Enhanced APPOINTMENTS POLICIES
-- Admin sees all, receptionist sees all, staff see assigned, customers see own
CREATE POLICY "enhanced_appointments_select" ON appointments FOR SELECT
  USING (
    is_admin() OR
    is_receptionist() OR
    customer_id = get_current_customer_id() OR
    staff_id = get_current_staff_id()
  );

-- Admin, receptionist, and staff can create appointments, customers can create own
CREATE POLICY "enhanced_appointments_insert" ON appointments FOR INSERT
  WITH CHECK (
    is_admin() OR
    is_receptionist() OR
    (is_staff() AND staff_id = get_current_staff_id()) OR
    (NOT is_staff() AND NOT is_receptionist() AND customer_id = get_current_customer_id())
  );

-- Admin and receptionist can update all, staff can update assigned, customers can update own pending
CREATE POLICY "enhanced_appointments_update" ON appointments FOR UPDATE
  USING (
    is_admin() OR
    is_receptionist() OR
    (staff_id = get_current_staff_id()) OR
    (customer_id = get_current_customer_id() AND status = 'pending')
  );

-- Only admins can delete appointments
CREATE POLICY "enhanced_appointments_delete" ON appointments FOR DELETE
  USING (is_admin());

-- Enhanced STAFF_AVAILABILITY POLICIES
-- Visible to all authenticated users for booking, modifiable by staff themselves and admins
CREATE POLICY "enhanced_staff_availability_select" ON staff_availability FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Staff can manage their own availability, admins can manage all
CREATE POLICY "enhanced_staff_availability_insert" ON staff_availability FOR INSERT
  WITH CHECK (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "enhanced_staff_availability_update" ON staff_availability FOR UPDATE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "enhanced_staff_availability_delete" ON staff_availability FOR DELETE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- Enhanced STAFF_TIMEOFF POLICIES
-- Visible to admins, receptionist (read-only), and the staff member themselves
CREATE POLICY "enhanced_staff_timeoff_select" ON staff_timeoff FOR SELECT
  USING (
    staff_id = get_current_staff_id() OR
    is_admin() OR
    is_receptionist()
  );

-- Staff can manage their own timeoff, admins can manage all
CREATE POLICY "enhanced_staff_timeoff_insert" ON staff_timeoff FOR INSERT
  WITH CHECK (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "enhanced_staff_timeoff_update" ON staff_timeoff FOR UPDATE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

CREATE POLICY "enhanced_staff_timeoff_delete" ON staff_timeoff FOR DELETE
  USING (
    staff_id = get_current_staff_id() OR
    is_admin()
  );

-- Enhanced SETTINGS POLICIES
-- Only admins can manage system settings
-- Public settings visible to authenticated users
CREATE POLICY "enhanced_settings_select" ON settings FOR SELECT
  USING (
    is_public = true OR
    is_admin()
  );

CREATE POLICY "enhanced_settings_insert" ON settings FOR INSERT
  WITH CHECK (can_manage_system());

CREATE POLICY "enhanced_settings_update" ON settings FOR UPDATE
  USING (can_manage_system());

CREATE POLICY "enhanced_settings_delete" ON settings FOR DELETE
  USING (can_manage_system());

-- Enhanced MEDIA_ASSETS POLICIES
-- Public assets visible to all, private assets to uploader and admins
-- Staff and admin can upload, receptionist and customer cannot
CREATE POLICY "enhanced_media_assets_select" ON media_assets FOR SELECT
  USING (
    is_public = true OR
    uploaded_by = auth.uid() OR
    is_admin()
  );

CREATE POLICY "enhanced_media_assets_insert" ON media_assets FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND uploaded_by = auth.uid() AND is_staff()) OR
    is_admin()
  );

CREATE POLICY "enhanced_media_assets_update" ON media_assets FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    is_admin()
  );

CREATE POLICY "enhanced_media_assets_delete" ON media_assets FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    is_admin()
  );

-- Create secure views with field masking for customer data
CREATE OR REPLACE VIEW customers_secure AS
SELECT 
  id,
  profile_id,
  customer_number,
  first_name,
  last_name,
  -- Mask PII fields based on user role
  CASE 
    WHEN is_admin() OR profile_id = auth.uid() THEN email
    ELSE mask_email(email)
  END as email,
  CASE 
    WHEN is_admin() OR profile_id = auth.uid() THEN phone
    ELSE mask_phone(phone)
  END as phone,
  -- Address fields only for admin and receptionist
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN address_street
    ELSE NULL
  END as address_street,
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN address_city
    ELSE NULL
  END as address_city,
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN address_postal_code
    ELSE NULL
  END as address_postal_code,
  -- Emergency contact only for admin and receptionist
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN emergency_contact_name
    ELSE NULL
  END as emergency_contact_name,
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN emergency_contact_phone
    ELSE mask_phone(emergency_contact_phone)
  END as emergency_contact_phone,
  -- Date of birth only for admin and receptionist
  CASE 
    WHEN is_admin() OR is_receptionist() OR profile_id = auth.uid() THEN date_of_birth
    ELSE NULL
  END as date_of_birth,
  -- Notes accessible to admin, receptionist, and staff with appointments
  CASE 
    WHEN is_admin() OR is_receptionist() THEN notes
    WHEN is_staff() AND EXISTS (
      SELECT 1 FROM appointments a
      JOIN staff s ON s.id = a.staff_id
      WHERE s.profile_id = auth.uid() AND a.customer_id = customers.id
    ) THEN notes
    ELSE NULL
  END as notes,
  created_at,
  updated_at
FROM customers;

-- Grant appropriate permissions on the secure view
GRANT SELECT ON customers_secure TO authenticated;

-- Create function to get role permissions for documentation
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE (
  resource TEXT,
  can_read BOOLEAN,
  can_create BOOLEAN,
  can_update BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'profiles'::TEXT, 
    (is_admin() OR auth.uid() IS NOT NULL)::BOOLEAN,
    is_admin()::BOOLEAN,
    (is_admin() OR auth.uid() IS NOT NULL)::BOOLEAN,
    is_admin()::BOOLEAN
  UNION ALL
  SELECT 
    'customers'::TEXT,
    (is_admin() OR is_receptionist() OR is_staff())::BOOLEAN,
    has_appointment_access()::BOOLEAN,
    (is_admin() OR is_receptionist())::BOOLEAN,
    is_admin()::BOOLEAN
  UNION ALL
  SELECT 
    'appointments'::TEXT,
    has_appointment_access()::BOOLEAN,
    has_appointment_access()::BOOLEAN,
    has_appointment_access()::BOOLEAN,
    is_admin()::BOOLEAN
  UNION ALL
  SELECT 
    'staff'::TEXT,
    (auth.uid() IS NOT NULL)::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN
  UNION ALL
  SELECT 
    'services'::TEXT,
    (auth.uid() IS NOT NULL)::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN
  UNION ALL
  SELECT 
    'settings'::TEXT,
    (is_admin())::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN,
    is_admin()::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;