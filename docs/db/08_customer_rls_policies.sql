-- RLS Policies for Customer Management & GDPR Compliance
-- This migration adds Row Level Security policies for customer data access

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on customer audit log
ALTER TABLE customer_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all customers (including soft-deleted)
CREATE POLICY "admin_all_customers" ON customers
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Customers can only see their own data (and only if not soft-deleted)
CREATE POLICY "customer_own_data" ON customers
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() 
    AND is_deleted = false
  );

-- Policy: Customers can update their own data (except sensitive fields)
CREATE POLICY "customer_update_own" ON customers
  FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid() 
    AND is_deleted = false
  )
  WITH CHECK (
    profile_id = auth.uid() 
    AND is_deleted = false
    -- Prevent customers from modifying sensitive fields
    AND (OLD.is_deleted = NEW.is_deleted)
    AND (OLD.deleted_at = NEW.deleted_at)
    AND (OLD.deleted_by = NEW.deleted_by)
    AND (OLD.deletion_reason = NEW.deletion_reason)
  );

-- Policy: Staff can see customers they have appointments with
CREATE POLICY "staff_appointment_customers" ON customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN staff s ON p.id = s.profile_id
      JOIN appointments a ON s.id = a.staff_id
      WHERE p.id = auth.uid() 
      AND p.role = 'staff'
      AND a.customer_id = customers.id
      AND customers.is_deleted = false
    )
  );

-- Audit log policies

-- Policy: Admins can see all audit logs
CREATE POLICY "admin_all_audit_logs" ON customer_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Customers can see their own audit logs
CREATE POLICY "customer_own_audit_logs" ON customer_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_audit_log.customer_id
      AND c.profile_id = auth.uid()
      AND c.is_deleted = false
    )
  );

-- Policy: Only admins can insert audit logs (system function)
CREATE POLICY "admin_insert_audit_logs" ON customer_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Additional policies for active_customers view
-- Note: Views inherit policies from underlying tables, but we can create specific ones

-- Grant permissions to roles
GRANT SELECT ON active_customers TO authenticated;
GRANT SELECT ON customer_audit_history TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION soft_delete_customer(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_customer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION export_customer_data(UUID) TO authenticated;

-- Create a function to check if user is admin (helper for policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if user is customer owner
CREATE OR REPLACE FUNCTION is_customer_owner(customer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = customer_uuid 
    AND customers.profile_id = auth.uid()
    AND customers.is_deleted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if user is staff with access to customer
CREATE OR REPLACE FUNCTION has_staff_access_to_customer(customer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN staff s ON p.id = s.profile_id
    JOIN appointments a ON s.id = a.staff_id
    WHERE p.id = auth.uid() 
    AND p.role = 'staff'
    AND a.customer_id = customer_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policy for appointments to respect customer soft-delete
DROP POLICY IF EXISTS "customer_soft_delete_appointments" ON appointments;
CREATE POLICY "customer_soft_delete_appointments" ON appointments
  FOR ALL
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = appointments.customer_id
      AND c.is_deleted = true
    ) OR is_admin()
  );

-- Ensure profiles RLS allows customer profile updates
DROP POLICY IF EXISTS "customer_profile_update" ON profiles;
CREATE POLICY "customer_profile_update" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent role escalation
    AND (OLD.role = NEW.role OR is_admin())
  );