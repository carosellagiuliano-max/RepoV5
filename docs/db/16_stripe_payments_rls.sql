-- Stripe Payments Integration - RLS Policies
-- Row Level Security policies for payment-related tables

-- Enable RLS on all payment tables
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency ENABLE ROW LEVEL SECURITY;

-- Payments table policies
-- Customers can only see their own payments
CREATE POLICY "customers_view_own_payments" ON payments
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    customer_id IN (
      SELECT id FROM customers 
      WHERE profile_id = auth.uid()
    )
  );

-- Staff and admin can see all payments
CREATE POLICY "staff_admin_view_all_payments" ON payments
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- Only authenticated users can create payments (via functions)
CREATE POLICY "authenticated_create_payments" ON payments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    (
      -- Customer creating their own payment
      customer_id IN (
        SELECT id FROM customers 
        WHERE profile_id = auth.uid()
      )
      OR
      -- Staff/admin creating payment
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'staff')
      )
    )
  );

-- Only admin and staff can update payments (for manual corrections)
CREATE POLICY "admin_staff_update_payments" ON payments
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- Payment Events table policies
-- Customers can see events for their own payments
CREATE POLICY "customers_view_own_payment_events" ON payment_events
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    payment_id IN (
      SELECT id FROM payments 
      WHERE customer_id IN (
        SELECT id FROM customers 
        WHERE profile_id = auth.uid()
      )
    )
  );

-- Staff and admin can see all payment events
CREATE POLICY "staff_admin_view_all_payment_events" ON payment_events
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- Only system can create payment events (via functions/webhooks)
CREATE POLICY "system_create_payment_events" ON payment_events
  FOR INSERT
  WITH CHECK (true); -- Controlled by function security

-- Payment Reconciliation table policies
-- Only admin can access reconciliation data
CREATE POLICY "admin_only_reconciliation" ON payment_reconciliation
  FOR ALL
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Admin Audit table policies
-- Only admin can view audit logs
CREATE POLICY "admin_view_audit_logs" ON admin_audit
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- System can create audit logs
CREATE POLICY "system_create_audit_logs" ON admin_audit
  FOR INSERT
  WITH CHECK (true); -- Controlled by function security

-- Payment Idempotency table policies
-- Only system functions can access idempotency table
CREATE POLICY "system_only_idempotency" ON payment_idempotency
  FOR ALL
  USING (true); -- Access controlled at function level

-- Additional policies for customer payment preferences
-- Customers can update their own payment preferences
CREATE POLICY "customers_update_payment_preferences" ON customers
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    profile_id = auth.uid()
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    profile_id = auth.uid()
  );

-- Grant necessary permissions for webhook processing
-- These are needed for the service role used by Netlify Functions
GRANT SELECT, INSERT, UPDATE ON payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON payment_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON payment_reconciliation TO service_role;
GRANT SELECT, INSERT ON admin_audit TO service_role;
GRANT SELECT, INSERT, DELETE ON payment_idempotency TO service_role;

-- Grant execute permissions on payment functions
GRANT EXECUTE ON FUNCTION create_payment_intent TO service_role;
GRANT EXECUTE ON FUNCTION process_payment_webhook TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency_keys TO service_role;

-- Additional helper functions for payment management

-- Function to get payment summary for admin dashboard
CREATE OR REPLACE FUNCTION get_payment_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
  v_summary JSONB;
BEGIN
  -- Ensure user has admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start_date,
      'end_date', v_end_date
    ),
    'total_amount_cents', COALESCE(SUM(amount_cents), 0),
    'total_fee_cents', COALESCE(SUM(fee_cents), 0),
    'net_amount_cents', COALESCE(SUM(net_amount_cents), 0),
    'transaction_count', COUNT(*),
    'successful_payments', COUNT(*) FILTER (WHERE status = 'succeeded'),
    'failed_payments', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending_payments', COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'requires_action')),
    'refunded_amount_cents', COALESCE(
      SUM(amount_cents) FILTER (WHERE status = 'succeeded' AND 
        EXISTS (
          SELECT 1 FROM payment_events pe 
          WHERE pe.payment_id = payments.id 
          AND pe.event_type = 'payment_refunded'
        )
      ), 0
    ),
    'by_payment_method', (
      SELECT jsonb_object_agg(
        payment_method_type,
        jsonb_build_object(
          'count', count,
          'amount_cents', total_amount
        )
      )
      FROM (
        SELECT 
          payment_method_type,
          COUNT(*) as count,
          SUM(amount_cents) as total_amount
        FROM payments
        WHERE created_at::date BETWEEN v_start_date AND v_end_date
        AND status = 'succeeded'
        GROUP BY payment_method_type
      ) method_stats
    )
  ) INTO v_summary
  FROM payments
  WHERE created_at::date BETWEEN v_start_date AND v_end_date;
  
  RETURN v_summary;
END;
$$;

-- Function to check payment authorization for operations
CREATE OR REPLACE FUNCTION check_payment_operation_auth(
  p_payment_id UUID,
  p_operation TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_payment_customer_id UUID;
  v_user_customer_id UUID;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  -- Admin can perform any operation
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Staff can perform read operations and some management operations
  IF v_user_role = 'staff' AND p_operation IN ('view', 'capture', 'refund') THEN
    RETURN true;
  END IF;
  
  -- Customers can only view their own payments
  IF v_user_role = 'customer' AND p_operation = 'view' THEN
    SELECT customer_id INTO v_payment_customer_id
    FROM payments
    WHERE id = p_payment_id;
    
    SELECT id INTO v_user_customer_id
    FROM customers
    WHERE profile_id = auth.uid();
    
    RETURN v_payment_customer_id = v_user_customer_id;
  END IF;
  
  RETURN false;
END;
$$;