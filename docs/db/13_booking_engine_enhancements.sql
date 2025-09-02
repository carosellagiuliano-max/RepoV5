-- Booking Engine & Availability Hardening - Database Enhancements
-- This migration adds tables and functions for robust booking management

-- Holidays and blackout dates table
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  is_recurring BOOLEAN DEFAULT false, -- For annual recurring holidays
  recurring_month INTEGER CHECK (recurring_month BETWEEN 1 AND 12),
  recurring_day INTEGER CHECK (recurring_day BETWEEN 1 AND 31),
  type TEXT DEFAULT 'public_holiday', -- public_holiday, blackout_date, maintenance
  description TEXT,
  affects_all_staff BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking policies configuration
CREATE TABLE IF NOT EXISTS booking_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  policy_key TEXT UNIQUE NOT NULL,
  policy_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking operations log for idempotency and audit
CREATE TABLE IF NOT EXISTS booking_operations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  operation_type TEXT NOT NULL, -- create, update, cancel, reschedule
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  request_data JSONB NOT NULL,
  response_data JSONB,
  status TEXT NOT NULL, -- pending, completed, failed
  error_message TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waitlist table for when slots are not available
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE, -- NULL for any staff
  preferred_start_date DATE NOT NULL,
  preferred_end_date DATE NOT NULL,
  preferred_times TIME[], -- Array of preferred start times
  preferred_days INTEGER[], -- Array of preferred days (0-6)
  notes TEXT,
  status TEXT DEFAULT 'active', -- active, notified, booked, cancelled
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_recurring ON holidays(is_recurring, recurring_month, recurring_day);
CREATE INDEX IF NOT EXISTS idx_booking_operations_idempotency ON booking_operations(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_booking_operations_appointment ON booking_operations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_customer ON waitlist(customer_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_service ON waitlist(service_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_staff ON waitlist(staff_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_dates ON waitlist(preferred_start_date, preferred_end_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Enhanced index for appointment overlaps (critical for booking performance)
CREATE INDEX IF NOT EXISTS idx_appointments_staff_time_range ON appointments(staff_id, starts_at, ends_at) WHERE status IN ('pending', 'confirmed');

-- Composite index for slot availability queries
CREATE INDEX IF NOT EXISTS idx_appointments_staff_starts_status ON appointments(staff_id, starts_at) WHERE status IN ('pending', 'confirmed');

-- Add updated_at triggers
CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_policies_updated_at BEFORE UPDATE ON booking_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_operations_updated_at BEFORE UPDATE ON booking_operations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON waitlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default booking policies
INSERT INTO booking_policies (policy_key, policy_value, description) VALUES
  ('cancellation_deadline_hours', '24', 'How many hours before appointment cancellation is allowed'),
  ('reschedule_deadline_hours', '2', 'How many hours before appointment reschedule is allowed'),
  ('max_reschedules', '3', 'Maximum number of times an appointment can be rescheduled'),
  ('advance_booking_limit_days', '90', 'Maximum days in advance booking is allowed'),
  ('minimum_booking_notice_hours', '2', 'Minimum hours notice required for booking'),
  ('waitlist_notification_hours', '48', 'Hours before appointment to notify waitlist customers'),
  ('double_booking_prevention', 'true', 'Prevent double booking with strict validation')
ON CONFLICT (policy_key) DO NOTHING;

-- Function to check if a date is a holiday
CREATE OR REPLACE FUNCTION is_holiday(check_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  is_holiday_result BOOLEAN := false;
BEGIN
  -- Check for exact date match
  SELECT EXISTS(
    SELECT 1 FROM holidays 
    WHERE date = check_date
    AND (type = 'public_holiday' OR type = 'blackout_date')
  ) INTO is_holiday_result;
  
  IF is_holiday_result THEN
    RETURN true;
  END IF;
  
  -- Check for recurring holidays
  SELECT EXISTS(
    SELECT 1 FROM holidays 
    WHERE is_recurring = true 
    AND recurring_month = EXTRACT(MONTH FROM check_date)
    AND recurring_day = EXTRACT(DAY FROM check_date)
    AND (type = 'public_holiday' OR type = 'blackout_date')
  ) INTO is_holiday_result;
  
  RETURN is_holiday_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get booking policy value
CREATE OR REPLACE FUNCTION get_booking_policy(policy_key TEXT)
RETURNS TEXT AS $$
DECLARE
  policy_value TEXT;
BEGIN
  SELECT bp.policy_value::TEXT INTO policy_value
  FROM booking_policies bp
  WHERE bp.policy_key = get_booking_policy.policy_key
  AND bp.is_active = true;
  
  RETURN policy_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to validate appointment timing with all business rules
CREATE OR REPLACE FUNCTION validate_appointment_timing(
  appointment_start TIMESTAMPTZ,
  appointment_end TIMESTAMPTZ
)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  check_date DATE;
  min_notice_hours INTEGER;
  max_advance_days INTEGER;
  business_hours JSONB;
  day_of_week INTEGER;
  start_time TIME;
  end_time TIME;
  day_hours JSONB;
  is_day_open BOOLEAN;
  day_start_time TIME;
  day_end_time TIME;
BEGIN
  check_date := appointment_start::DATE;
  start_time := appointment_start::TIME;
  end_time := appointment_end::TIME;
  day_of_week := EXTRACT(DOW FROM appointment_start);
  
  -- Basic time validation
  IF appointment_end <= appointment_start THEN
    RETURN QUERY SELECT false, 'End time must be after start time';
    RETURN;
  END IF;
  
  -- Check minimum booking notice
  min_notice_hours := COALESCE(get_booking_policy('minimum_booking_notice_hours')::INTEGER, 2);
  IF appointment_start < NOW() + (min_notice_hours || ' hours')::INTERVAL THEN
    RETURN QUERY SELECT false, 'Appointment must be booked at least ' || min_notice_hours || ' hours in advance';
    RETURN;
  END IF;
  
  -- Check maximum advance booking
  max_advance_days := COALESCE(get_booking_policy('advance_booking_limit_days')::INTEGER, 90);
  IF appointment_start > NOW() + (max_advance_days || ' days')::INTERVAL THEN
    RETURN QUERY SELECT false, 'Appointment cannot be booked more than ' || max_advance_days || ' days in advance';
    RETURN;
  END IF;
  
  -- Check if date is a holiday
  IF is_holiday(check_date) THEN
    RETURN QUERY SELECT false, 'Appointments cannot be booked on holidays or blackout dates';
    RETURN;
  END IF;
  
  -- Check business hours
  SELECT value INTO business_hours 
  FROM settings 
  WHERE key = 'opening_hours' AND category = 'business';
  
  IF business_hours IS NOT NULL THEN
    day_hours := business_hours->day_of_week::TEXT;
    
    IF day_hours IS NOT NULL THEN
      is_day_open := (day_hours->>'is_open')::BOOLEAN;
      
      IF NOT COALESCE(is_day_open, false) THEN
        RETURN QUERY SELECT false, 'Business is closed on this day';
        RETURN;
      END IF;
      
      day_start_time := (day_hours->>'start_time')::TIME;
      day_end_time := (day_hours->>'end_time')::TIME;
      
      IF start_time < day_start_time OR end_time > day_end_time THEN
        RETURN QUERY SELECT false, 'Appointment time is outside business hours (' || 
          day_start_time || ' - ' || day_end_time || ')';
        RETURN;
      END IF;
    END IF;
  END IF;
  
  -- If we get here, timing is valid
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced slot generation function with all constraints
CREATE OR REPLACE FUNCTION rpc_get_available_slots_enhanced(
  p_staff_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_buffer_minutes INTEGER DEFAULT 15,
  p_slot_interval_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_preferred BOOLEAN
) AS $$
DECLARE
  day_of_week_num INTEGER;
  service_duration INTEGER;
  availability_record RECORD;
  current_time TIME;
  slot_start TIMESTAMPTZ;
  slot_end TIMESTAMPTZ;
  business_hours JSONB;
  day_hours JSONB;
  is_day_open BOOLEAN;
  day_start_time TIME;
  day_end_time TIME;
  buffer_interval INTERVAL;
BEGIN
  -- Check if date is a holiday
  IF is_holiday(p_date) THEN
    RETURN;
  END IF;
  
  -- Get service duration
  SELECT duration_minutes INTO service_duration 
  FROM services 
  WHERE id = p_service_id AND is_active = true;
  
  IF service_duration IS NULL THEN
    RETURN;
  END IF;
  
  day_of_week_num := EXTRACT(DOW FROM p_date);
  buffer_interval := (p_buffer_minutes || ' minutes')::INTERVAL;
  
  -- Check business hours first
  SELECT value INTO business_hours 
  FROM settings 
  WHERE key = 'opening_hours' AND category = 'business';
  
  IF business_hours IS NOT NULL THEN
    day_hours := business_hours->day_of_week_num::TEXT;
    
    IF day_hours IS NOT NULL THEN
      is_day_open := (day_hours->>'is_open')::BOOLEAN;
      
      IF NOT COALESCE(is_day_open, false) THEN
        RETURN; -- Business closed this day
      END IF;
      
      day_start_time := (day_hours->>'start_time')::TIME;
      day_end_time := (day_hours->>'end_time')::TIME;
    ELSE
      RETURN; -- No hours defined for this day
    END IF;
  ELSE
    -- Fallback to staff availability if no business hours
    day_start_time := '09:00'::TIME;
    day_end_time := '17:00'::TIME;
  END IF;
  
  -- Loop through staff availability for this day
  FOR availability_record IN 
    SELECT sa.start_time, sa.end_time
    FROM staff_availability sa
    WHERE sa.staff_id = p_staff_id
    AND sa.day_of_week = day_of_week_num
    AND sa.availability_type = 'available'
    ORDER BY sa.start_time
  LOOP
    -- Constrain availability to business hours
    current_time := GREATEST(availability_record.start_time, day_start_time);
    
    -- Generate slots for this availability window
    WHILE current_time + (service_duration || ' minutes')::INTERVAL <= 
          LEAST(availability_record.end_time, day_end_time) LOOP
      
      slot_start := p_date + current_time;
      slot_end := slot_start + (service_duration || ' minutes')::INTERVAL;
      
      -- Skip past slots
      IF slot_start <= NOW() THEN
        current_time := current_time + (p_slot_interval_minutes || ' minutes')::INTERVAL;
        CONTINUE;
      END IF;
      
      -- Check if this slot is available
      IF NOT EXISTS (
        -- No time off conflicts
        SELECT 1 FROM staff_timeoff sto
        WHERE sto.staff_id = p_staff_id
        AND p_date BETWEEN sto.start_date AND sto.end_date
        AND (
          (sto.start_time IS NULL AND sto.end_time IS NULL) OR
          (sto.start_time IS NOT NULL AND sto.end_time IS NOT NULL AND
           NOT (current_time + (service_duration || ' minutes')::INTERVAL <= sto.start_time OR 
                current_time >= sto.end_time))
        )
      ) AND NOT EXISTS (
        -- No appointment conflicts (with buffer)
        SELECT 1 FROM appointments a
        WHERE a.staff_id = p_staff_id
        AND a.status IN ('pending', 'confirmed')
        AND NOT (
          slot_end + buffer_interval <= a.starts_at OR
          slot_start - buffer_interval >= a.ends_at
        )
      ) THEN
        -- This slot is available
        RETURN QUERY SELECT 
          slot_start, 
          slot_end, 
          service_duration,
          (current_time BETWEEN '10:00'::TIME AND '16:00'::TIME) as is_preferred; -- Mark preferred hours
      END IF;
      
      -- Move to next slot
      current_time := current_time + (p_slot_interval_minutes || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for idempotent booking creation
CREATE OR REPLACE FUNCTION create_booking_idempotent(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_staff_id UUID,
  p_service_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_price DECIMAL,
  p_notes TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  operation_id UUID,
  appointment_id UUID,
  status TEXT,
  error_message TEXT
) AS $$
DECLARE
  existing_operation RECORD;
  new_appointment_id UUID;
  operation_id UUID;
  buffer_minutes INTEGER;
  timing_validation RECORD;
  slot_validation RECORD;
BEGIN
  -- Check if operation already exists
  SELECT * INTO existing_operation
  FROM booking_operations
  WHERE idempotency_key = p_idempotency_key;
  
  IF existing_operation.id IS NOT NULL THEN
    -- Return existing operation result
    RETURN QUERY SELECT 
      existing_operation.id,
      existing_operation.appointment_id,
      existing_operation.status,
      existing_operation.error_message;
    RETURN;
  END IF;
  
  -- Create new operation record
  operation_id := uuid_generate_v4();
  
  INSERT INTO booking_operations (
    id, idempotency_key, operation_type, request_data, status, user_id
  ) VALUES (
    operation_id,
    p_idempotency_key,
    'create',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'staff_id', p_staff_id,
      'service_id', p_service_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'price', p_price,
      'notes', p_notes
    ),
    'pending',
    p_user_id
  );
  
  BEGIN
    -- Validate timing
    SELECT * INTO timing_validation FROM validate_appointment_timing(p_starts_at, p_ends_at);
    
    IF NOT timing_validation.is_valid THEN
      UPDATE booking_operations 
      SET status = 'failed', error_message = timing_validation.error_message
      WHERE id = operation_id;
      
      RETURN QUERY SELECT operation_id, NULL::UUID, 'failed', timing_validation.error_message;
      RETURN;
    END IF;
    
    -- Get buffer minutes from settings
    SELECT COALESCE(value::INTEGER, 15) INTO buffer_minutes
    FROM settings 
    WHERE key = 'buffer_time_minutes' AND category = 'business';
    
    -- Validate slot availability
    SELECT * INTO slot_validation
    FROM rpc_validate_appointment_slot(
      p_staff_id, p_service_id, p_starts_at, p_ends_at, buffer_minutes, NULL
    );
    
    IF NOT (slot_validation.rpc_validate_appointment_slot->>'is_valid')::BOOLEAN THEN
      UPDATE booking_operations 
      SET status = 'failed', 
          error_message = 'Slot not available: ' || 
                         (slot_validation.rpc_validate_appointment_slot->'errors'->>0)
      WHERE id = operation_id;
      
      RETURN QUERY SELECT 
        operation_id, 
        NULL::UUID, 
        'failed', 
        'Slot not available: ' || (slot_validation.rpc_validate_appointment_slot->'errors'->>0);
      RETURN;
    END IF;
    
    -- Create the appointment
    INSERT INTO appointments (
      customer_id, staff_id, service_id, starts_at, ends_at, 
      status, price, notes
    ) VALUES (
      p_customer_id, p_staff_id, p_service_id, p_starts_at, p_ends_at,
      'pending', p_price, p_notes
    ) RETURNING id INTO new_appointment_id;
    
    -- Update operation record
    UPDATE booking_operations 
    SET appointment_id = new_appointment_id, 
        status = 'completed',
        response_data = jsonb_build_object('appointment_id', new_appointment_id)
    WHERE id = operation_id;
    
    RETURN QUERY SELECT operation_id, new_appointment_id, 'completed', NULL::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    UPDATE booking_operations 
    SET status = 'failed', error_message = SQLERRM
    WHERE id = operation_id;
    
    RETURN QUERY SELECT operation_id, NULL::UUID, 'failed', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;