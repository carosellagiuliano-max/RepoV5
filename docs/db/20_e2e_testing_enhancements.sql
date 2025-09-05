-- E2E Testing Database Enhancements
-- This file contains database improvements specifically for E2E testing

-- Add indices for better E2E test performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_role ON profiles(email, role);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_date ON appointments(staff_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_date ON appointments(customer_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_staff_availability_day ON staff_availability(staff_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON media_assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_customers_profile_email ON customers(profile_id) INCLUDE (phone);

-- Add E2E test markers to identify test data
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;

-- Create test data cleanup function
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
  -- Delete test appointments first (foreign key constraints)
  DELETE FROM appointments WHERE is_test_data = TRUE;
  
  -- Delete test staff services
  DELETE FROM staff_services 
  WHERE staff_id IN (SELECT profile_id FROM staff WHERE is_test_data = TRUE)
     OR service_id IN (SELECT id FROM services WHERE is_test_data = TRUE);
  
  -- Delete test staff availability
  DELETE FROM staff_availability 
  WHERE staff_id IN (SELECT profile_id FROM staff WHERE is_test_data = TRUE);
  
  -- Delete test staff timeoff
  DELETE FROM staff_timeoff 
  WHERE staff_id IN (SELECT profile_id FROM staff WHERE is_test_data = TRUE);
  
  -- Delete test media assets
  DELETE FROM media_assets WHERE is_test_data = TRUE;
  
  -- Delete test customers
  DELETE FROM customers WHERE is_test_data = TRUE;
  
  -- Delete test staff
  DELETE FROM staff WHERE is_test_data = TRUE;
  
  -- Delete test services
  DELETE FROM services WHERE is_test_data = TRUE;
  
  -- Delete test profiles (this should cascade delete auth users)
  DELETE FROM profiles WHERE is_test_data = TRUE;
  
  -- Clean up audit logs for test users
  DELETE FROM admin_audit 
  WHERE admin_id IN (
    SELECT id FROM profiles 
    WHERE email LIKE '%@test.local' OR is_test_data = TRUE
  );
  
  RAISE NOTICE 'Test data cleanup completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced RLS policies for E2E testing
-- Allow test data access for service role
CREATE POLICY "test_data_access" ON profiles FOR ALL
  USING (
    (is_test_data = TRUE AND auth.role() = 'service_role') OR
    (is_test_data = FALSE AND (id = auth.uid() OR is_admin()))
  );

CREATE POLICY "test_customers_access" ON customers FOR ALL
  USING (
    (is_test_data = TRUE AND auth.role() = 'service_role') OR
    (is_test_data = FALSE AND (profile_id = auth.uid() OR is_staff()))
  );

CREATE POLICY "test_staff_access" ON staff FOR ALL
  USING (
    (is_test_data = TRUE AND auth.role() = 'service_role') OR
    (is_test_data = FALSE AND (profile_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "test_services_access" ON services FOR ALL
  USING (
    (is_test_data = TRUE AND auth.role() = 'service_role') OR
    (is_test_data = FALSE)
  );

CREATE POLICY "test_appointments_access" ON appointments FOR ALL
  USING (
    (is_test_data = TRUE AND auth.role() = 'service_role') OR
    (is_test_data = FALSE AND (customer_id = auth.uid() OR staff_id = auth.uid() OR is_admin()))
  );

-- Function to mark records as test data
CREATE OR REPLACE FUNCTION mark_as_test_data(
  table_name TEXT,
  record_id UUID
)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET is_test_data = TRUE WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get test data statistics
CREATE OR REPLACE FUNCTION get_test_data_stats()
RETURNS TABLE(
  table_name TEXT,
  test_records_count BIGINT,
  total_records_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'profiles'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM profiles
  UNION ALL
  SELECT 'customers'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM customers
  UNION ALL
  SELECT 'staff'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM staff
  UNION ALL
  SELECT 'services'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM services
  UNION ALL
  SELECT 'appointments'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM appointments
  UNION ALL
  SELECT 'media_assets'::TEXT, 
         COUNT(*) FILTER (WHERE is_test_data = TRUE),
         COUNT(*)
  FROM media_assets;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced booking conflict detection for E2E tests
CREATE OR REPLACE FUNCTION check_appointment_conflicts_e2e(
  p_staff_id UUID,
  p_appointment_date DATE,
  p_start_time TIME,
  p_duration_minutes INTEGER,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflict_type TEXT,
  conflict_details JSONB
) AS $$
DECLARE
  v_end_time TIME;
  v_conflicting_appointment RECORD;
  v_staff_availability RECORD;
BEGIN
  v_end_time := p_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check for overlapping appointments
  FOR v_conflicting_appointment IN
    SELECT id, appointment_time, duration_minutes, customer_id
    FROM appointments
    WHERE staff_id = p_staff_id
      AND appointment_date = p_appointment_date
      AND status NOT IN ('cancelled', 'completed')
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
      AND (
        (appointment_time, appointment_time + (duration_minutes || ' minutes')::INTERVAL)
        OVERLAPS
        (p_start_time, v_end_time)
      )
  LOOP
    RETURN QUERY SELECT 
      'appointment_conflict'::TEXT,
      jsonb_build_object(
        'conflicting_appointment_id', v_conflicting_appointment.id,
        'conflicting_time', v_conflicting_appointment.appointment_time,
        'conflicting_customer', v_conflicting_appointment.customer_id
      );
  END LOOP;
  
  -- Check staff availability
  SELECT * INTO v_staff_availability
  FROM staff_availability
  WHERE staff_id = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_appointment_date)
    AND is_available = TRUE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'staff_unavailable'::TEXT,
      jsonb_build_object(
        'day_of_week', EXTRACT(DOW FROM p_appointment_date),
        'reason', 'Staff not available on this day'
      );
  ELSIF p_start_time < v_staff_availability.start_time OR 
        v_end_time > v_staff_availability.end_time THEN
    RETURN QUERY SELECT 
      'outside_working_hours'::TEXT,
      jsonb_build_object(
        'staff_start', v_staff_availability.start_time,
        'staff_end', v_staff_availability.end_time,
        'requested_start', p_start_time,
        'requested_end', v_end_time
      );
  END IF;
  
  -- Check for time off
  IF EXISTS (
    SELECT 1 FROM staff_timeoff
    WHERE staff_id = p_staff_id
      AND p_appointment_date BETWEEN start_date AND end_date
  ) THEN
    RETURN QUERY SELECT 
      'staff_timeoff'::TEXT,
      jsonb_build_object(
        'timeoff_reason', (
          SELECT reason FROM staff_timeoff
          WHERE staff_id = p_staff_id
            AND p_appointment_date BETWEEN start_date AND end_date
          LIMIT 1
        )
      );
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate test appointment slots
CREATE OR REPLACE FUNCTION generate_test_appointment_slots(
  p_staff_id UUID,
  p_date DATE,
  p_service_duration INTEGER DEFAULT 30
)
RETURNS TABLE(
  time_slot TIME,
  available BOOLEAN,
  conflict_reason TEXT
) AS $$
DECLARE
  v_staff_availability RECORD;
  v_current_time TIME;
  v_slot_interval INTERVAL := '30 minutes';
BEGIN
  -- Get staff availability for the day
  SELECT * INTO v_staff_availability
  FROM staff_availability
  WHERE staff_id = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_date)
    AND is_available = TRUE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TIME, FALSE, 'Staff not available'::TEXT;
    RETURN;
  END IF;
  
  -- Generate time slots
  v_current_time := v_staff_availability.start_time;
  
  WHILE v_current_time + (p_service_duration || ' minutes')::INTERVAL <= v_staff_availability.end_time LOOP
    -- Check for conflicts
    IF EXISTS (
      SELECT 1 FROM check_appointment_conflicts_e2e(
        p_staff_id, 
        p_date, 
        v_current_time, 
        p_service_duration
      )
    ) THEN
      RETURN QUERY SELECT 
        v_current_time, 
        FALSE, 
        (SELECT conflict_type FROM check_appointment_conflicts_e2e(
          p_staff_id, p_date, v_current_time, p_service_duration
        ) LIMIT 1);
    ELSE
      RETURN QUERY SELECT v_current_time, TRUE, NULL::TEXT;
    END IF;
    
    v_current_time := v_current_time + v_slot_interval;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add E2E test correlation tracking
CREATE TABLE IF NOT EXISTS e2e_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT UNIQUE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  test_suite TEXT,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  test_data_created JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to track E2E test runs
CREATE OR REPLACE FUNCTION start_e2e_test_run(
  p_correlation_id TEXT,
  p_test_suite TEXT DEFAULT 'full'
)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO e2e_test_runs (correlation_id, test_suite, status)
  VALUES (p_correlation_id, p_test_suite, 'running')
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_e2e_test_run(
  p_correlation_id TEXT,
  p_status TEXT DEFAULT 'completed'
)
RETURNS void AS $$
BEGIN
  UPDATE e2e_test_runs
  SET completed_at = NOW(),
      status = p_status,
      updated_at = NOW()
  WHERE correlation_id = p_correlation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions for E2E testing
GRANT EXECUTE ON FUNCTION cleanup_test_data() TO service_role;
GRANT EXECUTE ON FUNCTION mark_as_test_data(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_test_data_stats() TO service_role;
GRANT EXECUTE ON FUNCTION check_appointment_conflicts_e2e(UUID, DATE, TIME, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION generate_test_appointment_slots(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION start_e2e_test_run(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION complete_e2e_test_run(TEXT, TEXT) TO service_role;

GRANT ALL ON TABLE e2e_test_runs TO service_role;

-- Add helpful views for E2E testing
CREATE OR REPLACE VIEW test_data_summary AS
SELECT 
  'profiles' as table_name,
  COUNT(*) FILTER (WHERE is_test_data = TRUE) as test_count,
  COUNT(*) as total_count
FROM profiles
UNION ALL
SELECT 
  'customers',
  COUNT(*) FILTER (WHERE is_test_data = TRUE),
  COUNT(*)
FROM customers
UNION ALL
SELECT 
  'staff',
  COUNT(*) FILTER (WHERE is_test_data = TRUE),
  COUNT(*)
FROM staff
UNION ALL
SELECT 
  'services',
  COUNT(*) FILTER (WHERE is_test_data = TRUE),
  COUNT(*)
FROM services
UNION ALL
SELECT 
  'appointments',
  COUNT(*) FILTER (WHERE is_test_data = TRUE),
  COUNT(*)
FROM appointments;

GRANT SELECT ON test_data_summary TO service_role, authenticated;

-- Add test environment detection
CREATE OR REPLACE FUNCTION is_test_environment()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if we're in a test environment based on database name or other indicators
  RETURN current_database() LIKE '%test%' 
      OR current_database() LIKE '%staging%'
      OR EXISTS (SELECT 1 FROM profiles WHERE email LIKE '%@test.local' LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_test_environment() IS 'Detects if the current database is a test environment';

-- Log when this migration is applied
INSERT INTO e2e_test_runs (correlation_id, test_suite, status, completed_at)
VALUES ('migration-' || extract(epoch from now()), 'database-setup', 'completed', NOW())
ON CONFLICT (correlation_id) DO NOTHING;