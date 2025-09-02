-- Customer Management & GDPR Compliance Migration
-- This migration adds audit logging and GDPR compliance features

-- Create audit log table for GDPR compliance
CREATE TABLE customer_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'soft_deleted', 'gdpr_export', 'gdpr_deletion_requested'
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  data_before JSONB, -- Previous state (for updates)
  data_after JSONB, -- New state (for creates/updates)
  reason TEXT, -- Optional reason for the action
  ip_address INET, -- Track IP for security
  user_agent TEXT, -- Track user agent for security
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add soft delete fields to customers table
ALTER TABLE customers 
ADD COLUMN is_deleted BOOLEAN DEFAULT false,
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN deletion_reason TEXT;

-- Add GDPR compliance fields
ALTER TABLE customers
ADD COLUMN gdpr_consent_given BOOLEAN DEFAULT false,
ADD COLUMN gdpr_consent_date TIMESTAMPTZ,
ADD COLUMN gdpr_data_exported_at TIMESTAMPTZ,
ADD COLUMN gdpr_deletion_requested_at TIMESTAMPTZ,
ADD COLUMN gdpr_deletion_reason TEXT;

-- Create indexes for performance
CREATE INDEX idx_customer_audit_log_customer_id ON customer_audit_log(customer_id);
CREATE INDEX idx_customer_audit_log_performed_by ON customer_audit_log(performed_by);
CREATE INDEX idx_customer_audit_log_action ON customer_audit_log(action);
CREATE INDEX idx_customer_audit_log_created_at ON customer_audit_log(created_at);
CREATE INDEX idx_customers_is_deleted ON customers(is_deleted);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);

-- Add updated_at trigger to audit log
CREATE TRIGGER update_customer_audit_log_updated_at 
  BEFORE UPDATE ON customer_audit_log 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically log customer changes
CREATE OR REPLACE FUNCTION log_customer_audit()
RETURNS TRIGGER AS $$
DECLARE
  audit_action TEXT;
  user_id UUID;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    audit_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    audit_action := 'updated';
  ELSIF TG_OP = 'DELETE' THEN
    audit_action := 'deleted';
  END IF;

  -- Get current user (this should be set by the application)
  user_id := current_setting('app.current_user_id', true)::UUID;
  
  -- Insert audit record
  INSERT INTO customer_audit_log (
    customer_id,
    action,
    performed_by,
    data_before,
    data_after,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    audit_action,
    user_id,
    CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic audit logging
CREATE TRIGGER customer_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_audit();

-- Create view for active customers (excluding soft-deleted)
CREATE VIEW active_customers AS
SELECT 
  c.*,
  p.email,
  p.full_name,
  p.phone as profile_phone,
  p.role,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at
FROM customers c
JOIN profiles p ON c.profile_id = p.id
WHERE c.is_deleted = false;

-- Create view for customer audit history
CREATE VIEW customer_audit_history AS
SELECT 
  cal.*,
  p.full_name as performed_by_name,
  p.email as performed_by_email,
  c.customer_number
FROM customer_audit_log cal
LEFT JOIN profiles p ON cal.performed_by = p.id
LEFT JOIN customers c ON cal.customer_id = c.id
ORDER BY cal.created_at DESC;

-- Function to soft delete a customer (GDPR compliant)
CREATE OR REPLACE FUNCTION soft_delete_customer(
  customer_uuid UUID,
  deleting_user_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Validate inputs
  IF customer_uuid IS NULL OR deleting_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer ID and deleting user ID are required');
  END IF;

  -- Check if customer exists and is not already deleted
  IF NOT EXISTS (
    SELECT 1 FROM customers 
    WHERE id = customer_uuid AND is_deleted = false
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found or already deleted');
  END IF;

  -- Set app context for audit logging
  PERFORM set_config('app.current_user_id', deleting_user_id::text, true);

  -- Perform soft delete
  UPDATE customers 
  SET 
    is_deleted = true,
    deleted_at = NOW(),
    deleted_by = deleting_user_id,
    deletion_reason = reason,
    updated_at = NOW()
  WHERE id = customer_uuid;

  -- Log GDPR action separately
  INSERT INTO customer_audit_log (
    customer_id,
    action,
    performed_by,
    reason,
    created_at
  ) VALUES (
    customer_uuid,
    'soft_deleted',
    deleting_user_id,
    reason,
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Customer soft deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted customer
CREATE OR REPLACE FUNCTION restore_customer(
  customer_uuid UUID,
  restoring_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Validate inputs
  IF customer_uuid IS NULL OR restoring_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer ID and restoring user ID are required');
  END IF;

  -- Check if customer exists and is deleted
  IF NOT EXISTS (
    SELECT 1 FROM customers 
    WHERE id = customer_uuid AND is_deleted = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found or not deleted');
  END IF;

  -- Set app context for audit logging
  PERFORM set_config('app.current_user_id', restoring_user_id::text, true);

  -- Restore customer
  UPDATE customers 
  SET 
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL,
    deletion_reason = NULL,
    updated_at = NOW()
  WHERE id = customer_uuid;

  -- Log restoration action
  INSERT INTO customer_audit_log (
    customer_id,
    action,
    performed_by,
    reason,
    created_at
  ) VALUES (
    customer_uuid,
    'restored',
    restoring_user_id,
    'Customer restored from soft delete',
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Customer restored successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to export customer data (GDPR right to data portability)
CREATE OR REPLACE FUNCTION export_customer_data(customer_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  customer_data JSONB;
  appointment_data JSONB;
  audit_data JSONB;
  result JSONB;
BEGIN
  -- Get customer basic data
  SELECT jsonb_build_object(
    'customer_info', row_to_json(c),
    'profile_info', row_to_json(p)
  ) INTO customer_data
  FROM customers c
  JOIN profiles p ON c.profile_id = p.id
  WHERE c.id = customer_uuid;

  -- Get appointment history
  SELECT jsonb_agg(
    jsonb_build_object(
      'appointment', row_to_json(a),
      'service', row_to_json(s),
      'staff', jsonb_build_object(
        'name', st.full_name,
        'email', st.email
      )
    )
  ) INTO appointment_data
  FROM appointments a
  JOIN services s ON a.service_id = s.id
  JOIN staff st ON a.staff_id = st.id
  WHERE a.customer_id = customer_uuid;

  -- Get audit history
  SELECT jsonb_agg(row_to_json(cal)) INTO audit_data
  FROM customer_audit_log cal
  WHERE cal.customer_id = customer_uuid;

  -- Build complete export
  result := jsonb_build_object(
    'export_timestamp', NOW(),
    'customer_data', customer_data,
    'appointments', COALESCE(appointment_data, '[]'::jsonb),
    'audit_history', COALESCE(audit_data, '[]'::jsonb)
  );

  -- Log the export action
  INSERT INTO customer_audit_log (
    customer_id,
    action,
    performed_by,
    reason,
    created_at
  ) VALUES (
    customer_uuid,
    'gdpr_export',
    customer_uuid, -- Customer exported their own data
    'GDPR data export requested',
    NOW()
  );

  -- Update export timestamp
  UPDATE customers 
  SET gdpr_data_exported_at = NOW()
  WHERE id = customer_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;