-- Analytics RLS Policies
-- Ensure only admin users can access analytics data

-- Enable RLS on analytics views (if not already enabled)
-- Note: Views inherit RLS from base tables, but we add explicit policies for clarity

-- RLS policy for analytics_appointment_summary view
-- Only admins can access appointment analytics
CREATE POLICY "Admin only analytics appointment summary" ON appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Additional RLS policies for analytics functions
-- These will be enforced through the Netlify Functions layer with JWT validation

-- Create a security definer function wrapper for analytics access
-- This ensures proper permission checking before accessing analytics data
CREATE OR REPLACE FUNCTION analytics_access_check()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin
  RETURN EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION analytics_access_check TO authenticated;

-- Update analytics functions to include security checks
CREATE OR REPLACE FUNCTION get_appointment_metrics_secure(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE,
  staff_filter UUID DEFAULT NULL,
  service_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  total_appointments BIGINT,
  completed_appointments BIGINT,
  cancelled_appointments BIGINT,
  pending_appointments BIGINT,
  confirmed_appointments BIGINT,
  total_revenue NUMERIC,
  average_ticket NUMERIC,
  unique_customers BIGINT,
  average_duration NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only admins can access analytics
  IF NOT analytics_access_check() THEN
    RAISE EXCEPTION 'Access denied: Admin role required for analytics data';
  END IF;

  RETURN QUERY
  SELECT * FROM get_appointment_metrics(start_date, end_date, staff_filter, service_filter);
END;
$$;

-- Update staff performance function with security
CREATE OR REPLACE FUNCTION get_staff_performance_metrics_secure(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  total_appointments BIGINT,
  completed_appointments BIGINT,
  total_revenue NUMERIC,
  average_ticket NUMERIC,
  utilization_rate NUMERIC,
  customer_satisfaction NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only admins can access analytics
  IF NOT analytics_access_check() THEN
    RAISE EXCEPTION 'Access denied: Admin role required for analytics data';
  END IF;

  RETURN QUERY
  SELECT * FROM get_staff_performance_metrics(start_date, end_date);
END;
$$;

-- Function to get analytics data for CSV export
CREATE OR REPLACE FUNCTION get_analytics_export_data(
  export_type TEXT, -- 'appointments', 'staff', 'services', 'revenue'
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE,
  staff_filter UUID DEFAULT NULL,
  service_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  export_row JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only admins can export analytics
  IF NOT analytics_access_check() THEN
    RAISE EXCEPTION 'Access denied: Admin role required for analytics export';
  END IF;

  CASE export_type
    WHEN 'appointments' THEN
      RETURN QUERY
      SELECT jsonb_build_object(
        'date', appointment_date,
        'staff_name', staff_name,
        'service_name', service_name,
        'service_category', service_category,
        'status', status,
        'price', price,
        'duration_minutes', duration_minutes
      ) as export_row
      FROM analytics_appointment_summary
      WHERE appointment_date BETWEEN start_date AND end_date
        AND (staff_filter IS NULL OR staff_id = staff_filter)
        AND (service_filter IS NULL OR service_id = service_filter)
      ORDER BY appointment_date DESC;

    WHEN 'staff' THEN
      RETURN QUERY
      SELECT jsonb_build_object(
        'staff_name', staff_name,
        'total_appointments', total_appointments,
        'completed_appointments', completed_appointments,
        'total_revenue', total_revenue,
        'average_ticket', average_ticket,
        'utilization_rate', utilization_rate
      ) as export_row
      FROM get_staff_performance_metrics(start_date, end_date);

    WHEN 'services' THEN
      RETURN QUERY
      SELECT jsonb_build_object(
        'service_name', service_name,
        'service_category', service_category,
        'total_bookings', total_bookings,
        'completed_bookings', completed_bookings,
        'total_revenue', total_revenue,
        'average_price', average_price,
        'bookings_last_30_days', bookings_last_30_days
      ) as export_row
      FROM analytics_service_popularity
      WHERE (service_filter IS NULL OR service_id = service_filter);

    WHEN 'revenue' THEN
      RETURN QUERY
      SELECT jsonb_build_object(
        'date', date,
        'total_appointments', total_appointments,
        'completed_appointments', completed_appointments,
        'daily_revenue', daily_revenue,
        'average_ticket', average_ticket,
        'unique_customers', unique_customers
      ) as export_row
      FROM analytics_revenue_summary
      WHERE date BETWEEN start_date AND end_date
      ORDER BY date DESC;

    ELSE
      RAISE EXCEPTION 'Invalid export type: %', export_type;
  END CASE;
END;
$$;

-- Grant permissions for secure functions
GRANT EXECUTE ON FUNCTION get_appointment_metrics_secure TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_metrics_secure TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_export_data TO authenticated;

-- Comment on functions for documentation
COMMENT ON FUNCTION analytics_access_check() IS 'Checks if current user has admin role for analytics access';
COMMENT ON FUNCTION get_appointment_metrics_secure(DATE, DATE, UUID, UUID) IS 'Secure wrapper for appointment metrics with admin role check';
COMMENT ON FUNCTION get_staff_performance_metrics_secure(DATE, DATE) IS 'Secure wrapper for staff performance metrics with admin role check';
COMMENT ON FUNCTION get_analytics_export_data(TEXT, DATE, DATE, UUID, UUID) IS 'Exports analytics data in JSON format for CSV conversion with admin role check';