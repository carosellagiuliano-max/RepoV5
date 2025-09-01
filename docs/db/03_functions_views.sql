-- Database Functions and Views for Schnittwerk
-- This file contains utility functions and views for business logic

-- Function to get available staff for a service at a specific time
CREATE OR REPLACE FUNCTION rpc_get_available_staff(
  p_service_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_buffer_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
  staff_id UUID,
  staff_name TEXT,
  email TEXT,
  phone TEXT,
  custom_price DECIMAL,
  estimated_duration INTEGER
) AS $$
DECLARE
  day_of_week_num INTEGER;
  start_time TIME;
  end_time TIME;
BEGIN
  -- Extract day of week and times
  day_of_week_num := EXTRACT(DOW FROM p_starts_at);
  start_time := p_starts_at::TIME;
  end_time := p_ends_at::TIME;
  
  RETURN QUERY
  SELECT DISTINCT
    s.id as staff_id,
    s.full_name as staff_name,
    s.email,
    s.phone,
    COALESCE(ss.custom_price, srv.base_price) as custom_price,
    COALESCE(ss.estimated_duration_minutes, srv.duration_minutes) as estimated_duration
  FROM staff s
  JOIN staff_services ss ON s.id = ss.staff_id
  JOIN services srv ON ss.service_id = srv.id
  WHERE 
    -- Staff is active and offers this service
    s.status = 'active'
    AND ss.service_id = p_service_id
    AND ss.is_active = true
    AND srv.is_active = true
    
    -- Staff has availability on this day/time
    AND EXISTS (
      SELECT 1 FROM staff_availability sa
      WHERE sa.staff_id = s.id
      AND sa.day_of_week = day_of_week_num
      AND sa.start_time <= start_time
      AND sa.end_time >= end_time
      AND sa.availability_type = 'available'
    )
    
    -- Staff is not on time off
    AND NOT EXISTS (
      SELECT 1 FROM staff_timeoff sto
      WHERE sto.staff_id = s.id
      AND p_starts_at::DATE BETWEEN sto.start_date AND sto.end_date
      AND (
        -- All day time off
        (sto.start_time IS NULL AND sto.end_time IS NULL) OR
        -- Specific time range overlaps
        (sto.start_time IS NOT NULL AND sto.end_time IS NOT NULL AND
         NOT (end_time <= sto.start_time OR start_time >= sto.end_time))
      )
    )
    
    -- Staff doesn't have conflicting appointments (with buffer)
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.staff_id = s.id
      AND a.status IN ('pending', 'confirmed')
      AND NOT (
        p_ends_at + (p_buffer_minutes || ' minutes')::INTERVAL <= a.starts_at OR
        p_starts_at - (p_buffer_minutes || ' minutes')::INTERVAL >= a.ends_at
      )
    )
  ORDER BY s.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available time slots for a staff member on a specific date
CREATE OR REPLACE FUNCTION rpc_get_available_slots(
  p_staff_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_buffer_minutes INTEGER DEFAULT 10,
  p_slot_duration_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER
) AS $$
DECLARE
  day_of_week_num INTEGER;
  service_duration INTEGER;
  availability_record RECORD;
  current_time TIME;
  slot_start TIMESTAMPTZ;
  slot_end TIMESTAMPTZ;
BEGIN
  -- Get service duration
  SELECT duration_minutes INTO service_duration 
  FROM services 
  WHERE id = p_service_id;
  
  IF service_duration IS NULL THEN
    service_duration := p_slot_duration_minutes;
  END IF;
  
  -- Extract day of week
  day_of_week_num := EXTRACT(DOW FROM p_date);
  
  -- Loop through staff availability for this day
  FOR availability_record IN 
    SELECT sa.start_time, sa.end_time
    FROM staff_availability sa
    WHERE sa.staff_id = p_staff_id
    AND sa.day_of_week = day_of_week_num
    AND sa.availability_type = 'available'
    ORDER BY sa.start_time
  LOOP
    current_time := availability_record.start_time;
    
    -- Generate slots for this availability window
    WHILE current_time + (service_duration || ' minutes')::INTERVAL <= availability_record.end_time LOOP
      slot_start := p_date + current_time;
      slot_end := slot_start + (service_duration || ' minutes')::INTERVAL;
      
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
          slot_end + (p_buffer_minutes || ' minutes')::INTERVAL <= a.starts_at OR
          slot_start - (p_buffer_minutes || ' minutes')::INTERVAL >= a.ends_at
        )
      ) THEN
        -- This slot is available
        RETURN QUERY SELECT slot_start, slot_end, service_duration;
      END IF;
      
      -- Move to next slot
      current_time := current_time + (p_slot_duration_minutes || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an appointment time is valid and available
CREATE OR REPLACE FUNCTION rpc_validate_appointment_slot(
  p_staff_id UUID,
  p_service_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_buffer_minutes INTEGER DEFAULT 10,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  day_of_week_num INTEGER;
  start_time TIME;
  end_time TIME;
  service_duration INTEGER;
  staff_active BOOLEAN;
  service_active BOOLEAN;
  staff_offers_service BOOLEAN;
  has_availability BOOLEAN;
  has_timeoff BOOLEAN;
  has_conflict BOOLEAN;
BEGIN
  -- Initialize result
  result := json_build_object(
    'is_valid', false,
    'errors', json_build_array(),
    'warnings', json_build_array()
  );
  
  -- Basic validations
  IF p_starts_at >= p_ends_at THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Invalid time range: end time must be after start time"]'::jsonb);
    RETURN result;
  END IF;
  
  IF p_starts_at < NOW() THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Cannot book appointments in the past"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Extract time components
  day_of_week_num := EXTRACT(DOW FROM p_starts_at);
  start_time := p_starts_at::TIME;
  end_time := p_ends_at::TIME;
  
  -- Check if staff is active
  SELECT status = 'active' INTO staff_active
  FROM staff WHERE id = p_staff_id;
  
  IF NOT COALESCE(staff_active, false) THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Staff member is not active"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Check if service is active
  SELECT is_active INTO service_active
  FROM services WHERE id = p_service_id;
  
  IF NOT COALESCE(service_active, false) THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Service is not active"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Check if staff offers this service
  SELECT EXISTS(
    SELECT 1 FROM staff_services ss
    WHERE ss.staff_id = p_staff_id 
    AND ss.service_id = p_service_id 
    AND ss.is_active = true
  ) INTO staff_offers_service;
  
  IF NOT staff_offers_service THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Staff member does not offer this service"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Check staff availability
  SELECT EXISTS(
    SELECT 1 FROM staff_availability sa
    WHERE sa.staff_id = p_staff_id
    AND sa.day_of_week = day_of_week_num
    AND sa.start_time <= start_time
    AND sa.end_time >= end_time
    AND sa.availability_type = 'available'
  ) INTO has_availability;
  
  IF NOT has_availability THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Staff member is not available at this time"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Check for time off
  SELECT EXISTS(
    SELECT 1 FROM staff_timeoff sto
    WHERE sto.staff_id = p_staff_id
    AND p_starts_at::DATE BETWEEN sto.start_date AND sto.end_date
    AND (
      (sto.start_time IS NULL AND sto.end_time IS NULL) OR
      (sto.start_time IS NOT NULL AND sto.end_time IS NOT NULL AND
       NOT (end_time <= sto.start_time OR start_time >= sto.end_time))
    )
  ) INTO has_timeoff;
  
  IF has_timeoff THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Staff member is not available (time off)"]'::jsonb);
    RETURN result;
  END IF;
  
  -- Check for appointment conflicts
  SELECT EXISTS(
    SELECT 1 FROM appointments a
    WHERE a.staff_id = p_staff_id
    AND a.status IN ('pending', 'confirmed')
    AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
    AND NOT (
      p_ends_at + (p_buffer_minutes || ' minutes')::INTERVAL <= a.starts_at OR
      p_starts_at - (p_buffer_minutes || ' minutes')::INTERVAL >= a.ends_at
    )
  ) INTO has_conflict;
  
  IF has_conflict THEN
    result := jsonb_set(result::jsonb, '{errors}', 
      (result->>'errors')::jsonb || '["Time slot conflicts with another appointment"]'::jsonb);
    RETURN result;
  END IF;
  
  -- If we get here, the slot is valid
  result := jsonb_set(result::jsonb, '{is_valid}', 'true'::jsonb);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for appointment details with related information
CREATE OR REPLACE VIEW appointment_details AS
SELECT 
  a.id,
  a.starts_at,
  a.ends_at,
  a.status,
  a.price,
  a.notes,
  a.internal_notes,
  a.created_at,
  a.updated_at,
  -- Customer details
  c.id as customer_id,
  p_customer.full_name as customer_name,
  p_customer.email as customer_email,
  p_customer.phone as customer_phone,
  -- Staff details
  s.id as staff_id,
  s.full_name as staff_name,
  s.email as staff_email,
  s.phone as staff_phone,
  -- Service details
  srv.id as service_id,
  srv.name as service_name,
  srv.description as service_description,
  srv.category as service_category,
  srv.duration_minutes as service_duration
FROM appointments a
JOIN customers c ON a.customer_id = c.id
JOIN profiles p_customer ON c.profile_id = p_customer.id
JOIN staff s ON a.staff_id = s.id
JOIN services srv ON a.service_id = srv.id;

-- View for staff with their services
CREATE OR REPLACE VIEW staff_with_services AS
SELECT 
  s.id as staff_id,
  s.full_name,
  s.email,
  s.phone,
  s.status,
  s.specialties,
  s.bio,
  s.avatar_url,
  json_agg(
    json_build_object(
      'service_id', srv.id,
      'service_name', srv.name,
      'category', srv.category,
      'base_price', srv.base_price,
      'custom_price', ss.custom_price,
      'duration_minutes', srv.duration_minutes,
      'estimated_duration', ss.estimated_duration_minutes
    )
  ) FILTER (WHERE srv.id IS NOT NULL) as services
FROM staff s
LEFT JOIN staff_services ss ON s.id = ss.staff_id AND ss.is_active = true
LEFT JOIN services srv ON ss.service_id = srv.id AND srv.is_active = true
GROUP BY s.id, s.full_name, s.email, s.phone, s.status, s.specialties, s.bio, s.avatar_url;