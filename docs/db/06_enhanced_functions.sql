-- Enhanced Views and Functions for production
-- This creates optimized views and functions for the admin portal

-- Enhanced view for staff with their profiles
CREATE OR REPLACE VIEW staff_with_profiles AS
SELECT 
  s.id,
  s.profile_id,
  p.email,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  s.specialties,
  s.bio,
  s.hire_date,
  s.hourly_rate,
  s.commission_rate,
  s.is_active,
  s.created_at,
  s.updated_at
FROM staff s
JOIN profiles p ON s.profile_id = p.id;

-- Enhanced view for appointments with all details
CREATE OR REPLACE VIEW appointments_with_details AS
SELECT 
  a.id,
  a.customer_id,
  p_customer.email as customer_email,
  p_customer.first_name as customer_first_name,
  p_customer.last_name as customer_last_name,
  p_customer.phone as customer_phone,
  a.staff_id,
  p_staff.first_name as staff_first_name,
  p_staff.last_name as staff_last_name,
  a.service_id,
  srv.name as service_name,
  srv.description as service_description,
  srv.category as service_category,
  srv.duration_minutes as service_duration_minutes,
  srv.price_cents as service_price_cents,
  a.start_time,
  a.end_time,
  a.status,
  a.notes,
  a.cancellation_reason,
  a.cancelled_at,
  a.created_at,
  a.updated_at
FROM appointments a
JOIN customers c ON a.customer_id = c.id
JOIN profiles p_customer ON c.profile_id = p_customer.id
JOIN staff s ON a.staff_id = s.id
JOIN profiles p_staff ON s.profile_id = p_staff.id
JOIN services srv ON a.service_id = srv.id;

-- Function to get available time slots (updated for new schema)
CREATE OR REPLACE FUNCTION get_available_slots(
  p_staff_id UUID,
  p_service_id UUID,
  p_start_date TEXT,
  p_end_date TEXT
)
RETURNS TABLE(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
) AS $$
DECLARE
  service_duration INTEGER;
  current_date DATE;
  end_date DATE;
  day_of_week_num INTEGER;
  availability_record RECORD;
  current_time TIME;
  slot_start TIMESTAMPTZ;
  slot_end TIMESTAMPTZ;
BEGIN
  -- Get service duration
  SELECT duration_minutes INTO service_duration 
  FROM services 
  WHERE id = p_service_id AND is_active = true;
  
  IF service_duration IS NULL THEN
    RETURN;
  END IF;
  
  current_date := p_start_date::DATE;
  end_date := p_end_date::DATE;
  
  -- Loop through each date in the range
  WHILE current_date <= end_date LOOP
    day_of_week_num := EXTRACT(DOW FROM current_date);
    
    -- Check if staff is available on this day
    FOR availability_record IN 
      SELECT sa.start_time, sa.end_time
      FROM staff_availability sa
      WHERE sa.staff_id = p_staff_id
      AND sa.day_of_week = day_of_week_num
      AND sa.is_available = true
      ORDER BY sa.start_time
    LOOP
      current_time := availability_record.start_time;
      
      -- Generate 30-minute slots within this availability window
      WHILE current_time + (service_duration || ' minutes')::INTERVAL <= availability_record.end_time LOOP
        slot_start := current_date + current_time;
        slot_end := slot_start + (service_duration || ' minutes')::INTERVAL;
        
        -- Skip past slots
        IF slot_start <= NOW() THEN
          current_time := current_time + INTERVAL '30 minutes';
          CONTINUE;
        END IF;
        
        -- Check if this slot is available
        IF NOT EXISTS (
          -- No time off conflicts
          SELECT 1 FROM staff_timeoff sto
          WHERE sto.staff_id = p_staff_id
          AND sto.is_approved = true
          AND current_date BETWEEN sto.start_date AND sto.end_date
          AND (
            (sto.start_time IS NULL AND sto.end_time IS NULL) OR
            (sto.start_time IS NOT NULL AND sto.end_time IS NOT NULL AND
             NOT (current_time + (service_duration || ' minutes')::INTERVAL <= sto.start_time OR 
                  current_time >= sto.end_time))
          )
        ) AND NOT EXISTS (
          -- No appointment conflicts
          SELECT 1 FROM appointments a
          WHERE a.staff_id = p_staff_id
          AND a.status IN ('pending', 'confirmed')
          AND NOT (
            slot_end <= a.start_time OR
            slot_start >= a.end_time
          )
        ) THEN
          -- This slot is available
          RETURN QUERY SELECT slot_start, slot_end;
        END IF;
        
        -- Move to next 30-minute slot
        current_time := current_time + INTERVAL '30 minutes';
      END LOOP;
    END LOOP;
    
    current_date := current_date + 1;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check appointment conflicts
CREATE OR REPLACE FUNCTION check_appointment_conflicts(
  p_staff_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  day_of_week_num INTEGER;
  start_time TIME;
  end_time TIME;
  appointment_date DATE;
BEGIN
  -- Basic validation
  IF p_start_time >= p_end_time THEN
    RETURN true; -- Invalid time range
  END IF;
  
  IF p_start_time <= NOW() THEN
    RETURN true; -- Cannot book in the past
  END IF;
  
  -- Extract components
  day_of_week_num := EXTRACT(DOW FROM p_start_time);
  start_time := p_start_time::TIME;
  end_time := p_end_time::TIME;
  appointment_date := p_start_time::DATE;
  
  -- Check if staff is active
  IF NOT EXISTS (
    SELECT 1 FROM staff s
    JOIN profiles p ON s.profile_id = p.id
    WHERE s.id = p_staff_id 
    AND s.is_active = true 
    AND p.is_active = true
  ) THEN
    RETURN true; -- Staff not active
  END IF;
  
  -- Check staff availability
  IF NOT EXISTS (
    SELECT 1 FROM staff_availability sa
    WHERE sa.staff_id = p_staff_id
    AND sa.day_of_week = day_of_week_num
    AND sa.start_time <= start_time
    AND sa.end_time >= end_time
    AND sa.is_available = true
  ) THEN
    RETURN true; -- Staff not available at this time
  END IF;
  
  -- Check for approved time off
  IF EXISTS (
    SELECT 1 FROM staff_timeoff sto
    WHERE sto.staff_id = p_staff_id
    AND sto.is_approved = true
    AND appointment_date BETWEEN sto.start_date AND sto.end_date
    AND (
      (sto.start_time IS NULL AND sto.end_time IS NULL) OR
      (sto.start_time IS NOT NULL AND sto.end_time IS NOT NULL AND
       NOT (end_time <= sto.start_time OR start_time >= sto.end_time))
    )
  ) THEN
    RETURN true; -- Staff on approved time off
  END IF;
  
  -- Check for appointment conflicts
  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.staff_id = p_staff_id
    AND a.status IN ('pending', 'confirmed')
    AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
    AND NOT (
      p_end_time <= a.start_time OR
      p_start_time >= a.end_time
    )
  ) THEN
    RETURN true; -- Conflicting appointment
  END IF;
  
  RETURN false; -- No conflicts
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get staff utilization metrics
CREATE OR REPLACE FUNCTION get_staff_utilization(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  staff_id UUID,
  staff_name TEXT,
  total_hours DECIMAL,
  booked_hours DECIMAL,
  utilization_rate DECIMAL,
  total_appointments INTEGER,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as staff_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as staff_name,
    -- Calculate total available hours
    (
      SELECT SUM(
        EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 3600 *
        (p_end_date - p_start_date + 1) / 7
      )
      FROM staff_availability sa
      WHERE sa.staff_id = s.id
      AND sa.is_available = true
    ) as total_hours,
    -- Calculate booked hours
    COALESCE(
      (
        SELECT SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600)
        FROM appointments a
        WHERE a.staff_id = s.id
        AND a.status IN ('confirmed', 'completed')
        AND a.start_time::DATE BETWEEN p_start_date AND p_end_date
      ), 0
    ) as booked_hours,
    -- Calculate utilization rate
    CASE 
      WHEN (
        SELECT SUM(
          EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 3600 *
          (p_end_date - p_start_date + 1) / 7
        )
        FROM staff_availability sa
        WHERE sa.staff_id = s.id
        AND sa.is_available = true
      ) > 0 THEN
        COALESCE(
          (
            SELECT SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600)
            FROM appointments a
            WHERE a.staff_id = s.id
            AND a.status IN ('confirmed', 'completed')
            AND a.start_time::DATE BETWEEN p_start_date AND p_end_date
          ), 0
        ) / (
          SELECT SUM(
            EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 3600 *
            (p_end_date - p_start_date + 1) / 7
          )
          FROM staff_availability sa
          WHERE sa.staff_id = s.id
          AND sa.is_available = true
        ) * 100
      ELSE 0
    END as utilization_rate,
    -- Count appointments
    COALESCE(
      (
        SELECT COUNT(*)
        FROM appointments a
        WHERE a.staff_id = s.id
        AND a.status IN ('confirmed', 'completed')
        AND a.start_time::DATE BETWEEN p_start_date AND p_end_date
      ), 0
    ) as total_appointments,
    -- Calculate revenue
    COALESCE(
      (
        SELECT SUM(srv.price_cents / 100.0)
        FROM appointments a
        JOIN services srv ON a.service_id = srv.id
        WHERE a.staff_id = s.id
        AND a.status = 'completed'
        AND a.start_time::DATE BETWEEN p_start_date AND p_end_date
      ), 0
    ) as total_revenue
  FROM staff s
  JOIN profiles p ON s.profile_id = p.id
  WHERE s.is_active = true
  ORDER BY utilization_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get appointment statistics
CREATE OR REPLACE FUNCTION get_appointment_stats(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  date DATE,
  total_appointments INTEGER,
  confirmed_appointments INTEGER,
  completed_appointments INTEGER,
  cancelled_appointments INTEGER,
  no_show_appointments INTEGER,
  total_revenue DECIMAL,
  new_customers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      a.start_time::DATE as appointment_date,
      COUNT(*) as total_appts,
      COUNT(*) FILTER (WHERE a.status = 'confirmed') as confirmed_appts,
      COUNT(*) FILTER (WHERE a.status = 'completed') as completed_appts,
      COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled_appts,
      COUNT(*) FILTER (WHERE a.status = 'no_show') as no_show_appts,
      SUM(CASE WHEN a.status = 'completed' THEN srv.price_cents / 100.0 ELSE 0 END) as revenue
    FROM appointments a
    JOIN services srv ON a.service_id = srv.id
    WHERE a.start_time::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY a.start_time::DATE
  ),
  new_customer_stats AS (
    SELECT 
      c.created_at::DATE as signup_date,
      COUNT(*) as new_customer_count
    FROM customers c
    WHERE c.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY c.created_at::DATE
  )
  SELECT 
    generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE as date,
    COALESCE(ds.total_appts, 0) as total_appointments,
    COALESCE(ds.confirmed_appts, 0) as confirmed_appointments,
    COALESCE(ds.completed_appts, 0) as completed_appointments,
    COALESCE(ds.cancelled_appts, 0) as cancelled_appointments,
    COALESCE(ds.no_show_appts, 0) as no_show_appointments,
    COALESCE(ds.revenue, 0) as total_revenue,
    COALESCE(ncs.new_customer_count, 0) as new_customers
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE d
  LEFT JOIN daily_stats ds ON d = ds.appointment_date
  LEFT JOIN new_customer_stats ncs ON d = ncs.signup_date
  ORDER BY d;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;