-- Analytics Views and Functions
-- SQL views and functions for efficient analytics data aggregation

-- Create analytics summary view for appointments
CREATE OR REPLACE VIEW analytics_appointment_summary AS
SELECT 
  DATE(a.starts_at) as appointment_date,
  EXTRACT(year FROM a.starts_at) as year,
  EXTRACT(month FROM a.starts_at) as month,
  EXTRACT(week FROM a.starts_at) as week,
  EXTRACT(dow FROM a.starts_at) as day_of_week,
  a.staff_id,
  s.full_name as staff_name,
  a.service_id,
  srv.name as service_name,
  srv.category as service_category,
  a.status,
  a.price,
  srv.duration_minutes,
  a.created_at,
  a.updated_at
FROM appointments a
JOIN staff s ON a.staff_id = s.id
JOIN services srv ON a.service_id = srv.id
WHERE a.status != 'cancelled';

-- Create staff utilization view
CREATE OR REPLACE VIEW analytics_staff_utilization AS
WITH staff_work_hours AS (
  SELECT 
    sa.staff_id,
    sa.day_of_week,
    EXTRACT(epoch FROM (sa.end_time - sa.start_time)) / 3600 as daily_hours
  FROM staff_availability sa
  WHERE sa.availability_type = 'available'
),
weekly_hours AS (
  SELECT 
    staff_id,
    SUM(daily_hours) as weekly_available_hours
  FROM staff_work_hours
  GROUP BY staff_id
),
appointment_hours AS (
  SELECT 
    a.staff_id,
    DATE_TRUNC('week', a.starts_at) as week_start,
    SUM(srv.duration_minutes::decimal / 60) as booked_hours
  FROM appointments a
  JOIN services srv ON a.service_id = srv.id
  WHERE a.status IN ('confirmed', 'completed')
    AND a.starts_at >= CURRENT_DATE - INTERVAL '12 weeks'
  GROUP BY a.staff_id, DATE_TRUNC('week', a.starts_at)
)
SELECT 
  ah.staff_id,
  s.full_name as staff_name,
  ah.week_start,
  ah.booked_hours,
  wh.weekly_available_hours,
  ROUND((ah.booked_hours / NULLIF(wh.weekly_available_hours, 0) * 100)::numeric, 2) as utilization_percentage
FROM appointment_hours ah
JOIN staff s ON ah.staff_id = s.id
JOIN weekly_hours wh ON ah.staff_id = wh.staff_id
ORDER BY ah.week_start DESC, s.full_name;

-- Create service popularity view
CREATE OR REPLACE VIEW analytics_service_popularity AS
SELECT 
  srv.id as service_id,
  srv.name as service_name,
  srv.category as service_category,
  srv.base_price,
  srv.duration_minutes,
  COUNT(a.id) as total_bookings,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_bookings,
  COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_bookings,
  ROUND(AVG(a.price), 2) as average_price,
  SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) as total_revenue,
  COUNT(CASE WHEN a.starts_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as bookings_last_30_days,
  COUNT(CASE WHEN a.starts_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as bookings_last_7_days
FROM services srv
LEFT JOIN appointments a ON srv.id = a.service_id
WHERE srv.is_active = true
GROUP BY srv.id, srv.name, srv.category, srv.base_price, srv.duration_minutes
ORDER BY total_bookings DESC;

-- Create revenue analytics view
CREATE OR REPLACE VIEW analytics_revenue_summary AS
SELECT 
  DATE(a.starts_at) as date,
  EXTRACT(year FROM a.starts_at) as year,
  EXTRACT(month FROM a.starts_at) as month,
  EXTRACT(week FROM a.starts_at) as week,
  COUNT(a.id) as total_appointments,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
  COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
  SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) as daily_revenue,
  AVG(CASE WHEN a.status = 'completed' THEN a.price END) as average_ticket,
  COUNT(DISTINCT a.customer_id) as unique_customers
FROM appointments a
WHERE a.starts_at >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY DATE(a.starts_at), EXTRACT(year FROM a.starts_at), EXTRACT(month FROM a.starts_at), EXTRACT(week FROM a.starts_at)
ORDER BY date DESC;

-- Function to get appointment metrics for a date range
CREATE OR REPLACE FUNCTION get_appointment_metrics(
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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_appointments,
    COUNT(CASE WHEN a.status = 'confirmed' THEN 1 END) as confirmed_appointments,
    COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN a.status = 'completed' THEN a.price END), 0) as average_ticket,
    COUNT(DISTINCT a.customer_id) as unique_customers,
    COALESCE(AVG(srv.duration_minutes), 0) as average_duration
  FROM appointments a
  JOIN services srv ON a.service_id = srv.id
  WHERE DATE(a.starts_at) BETWEEN start_date AND end_date
    AND (staff_filter IS NULL OR a.staff_id = staff_filter)
    AND (service_filter IS NULL OR a.service_id = service_filter);
END;
$$;

-- Function to get staff performance metrics
CREATE OR REPLACE FUNCTION get_staff_performance_metrics(
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
AS $$
BEGIN
  RETURN QUERY
  WITH staff_stats AS (
    SELECT 
      a.staff_id,
      s.full_name as staff_name,
      COUNT(a.id) as total_appointments,
      COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
      COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END), 0) as total_revenue,
      COALESCE(AVG(CASE WHEN a.status = 'completed' THEN a.price END), 0) as average_ticket
    FROM appointments a
    JOIN staff s ON a.staff_id = s.id
    WHERE DATE(a.starts_at) BETWEEN start_date AND end_date
    GROUP BY a.staff_id, s.full_name
  ),
  utilization_data AS (
    SELECT 
      staff_id,
      COALESCE(AVG(utilization_percentage), 0) as avg_utilization
    FROM analytics_staff_utilization
    WHERE week_start >= DATE_TRUNC('week', start_date::timestamp)
      AND week_start <= DATE_TRUNC('week', end_date::timestamp)
    GROUP BY staff_id
  )
  SELECT 
    ss.staff_id,
    ss.staff_name,
    ss.total_appointments,
    ss.completed_appointments,
    ss.total_revenue,
    ss.average_ticket,
    COALESCE(ud.avg_utilization, 0) as utilization_rate,
    0::numeric as customer_satisfaction -- Placeholder for future rating system
  FROM staff_stats ss
  LEFT JOIN utilization_data ud ON ss.staff_id = ud.staff_id
  ORDER BY ss.total_revenue DESC;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at_date ON appointments USING btree (DATE(starts_at));
CREATE INDEX IF NOT EXISTS idx_appointments_staff_date ON appointments USING btree (staff_id, DATE(starts_at));
CREATE INDEX IF NOT EXISTS idx_appointments_service_date ON appointments USING btree (service_id, DATE(starts_at));
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments USING btree (status, DATE(starts_at));
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments USING btree (created_at);

-- Grant permissions for analytics views to authenticated users with admin role
-- Note: RLS policies will be handled separately
GRANT SELECT ON analytics_appointment_summary TO authenticated;
GRANT SELECT ON analytics_staff_utilization TO authenticated;
GRANT SELECT ON analytics_service_popularity TO authenticated;
GRANT SELECT ON analytics_revenue_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_performance_metrics TO authenticated;