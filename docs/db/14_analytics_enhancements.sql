-- Analytics Enhancement Migration
-- Add tables for scheduled reports and enhanced analytics features

-- Scheduled Reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(20) CHECK (frequency IN ('weekly', 'monthly')) NOT NULL,
  format VARCHAR(10) CHECK (format IN ('csv', 'pdf')) NOT NULL,
  recipients JSONB NOT NULL, -- Array of email addresses
  filters JSONB, -- Analytics filters
  is_active BOOLEAN DEFAULT true,
  next_run TIMESTAMPTZ NOT NULL,
  last_run TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Deliveries table
CREATE TABLE IF NOT EXISTS report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('pending', 'generating', 'sent', 'failed')) DEFAULT 'pending',
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  file_url TEXT,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_report_id ON report_deliveries(report_id);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_status ON report_deliveries(status);

-- Enhanced appointments view for analytics
CREATE OR REPLACE VIEW appointments_with_details AS
SELECT 
  a.id,
  a.customer_id,
  a.staff_id,
  a.service_id,
  a.starts_at as start_time,
  a.ends_at as end_time,
  a.status,
  a.price,
  a.notes,
  a.internal_notes,
  a.created_at,
  a.updated_at,
  
  -- Customer details
  cp.email as customer_email,
  COALESCE(cp.full_name, CONCAT(TRIM(BOTH FROM COALESCE(cp.first_name, '')), ' ', TRIM(BOTH FROM COALESCE(cp.last_name, '')))) as customer_name,
  TRIM(BOTH FROM SPLIT_PART(COALESCE(cp.full_name, CONCAT(COALESCE(cp.first_name, ''), ' ', COALESCE(cp.last_name, ''))), ' ', 1)) as customer_first_name,
  TRIM(BOTH FROM SPLIT_PART(COALESCE(cp.full_name, CONCAT(COALESCE(cp.first_name, ''), ' ', COALESCE(cp.last_name, ''))), ' ', 2)) as customer_last_name,
  cp.phone as customer_phone,
  
  -- Staff details  
  sp.email as staff_email,
  COALESCE(sp.full_name, CONCAT(TRIM(BOTH FROM COALESCE(sp.first_name, '')), ' ', TRIM(BOTH FROM COALESCE(sp.last_name, '')))) as staff_name,
  TRIM(BOTH FROM SPLIT_PART(COALESCE(sp.full_name, CONCAT(COALESCE(sp.first_name, ''), ' ', COALESCE(sp.last_name, ''))), ' ', 1)) as staff_first_name,
  TRIM(BOTH FROM SPLIT_PART(COALESCE(sp.full_name, CONCAT(COALESCE(sp.first_name, ''), ' ', COALESCE(sp.last_name, ''))), ' ', 2)) as staff_last_name,
  
  -- Service details
  s.name as service_name,
  s.description as service_description,
  s.category as service_category,
  s.duration_minutes as service_duration_minutes,
  s.base_price as service_base_price,
  
  -- Calculate price in cents for consistency
  (a.price * 100)::INTEGER as service_price_cents
  
FROM appointments a
LEFT JOIN customers c ON a.customer_id = c.id
LEFT JOIN profiles cp ON c.profile_id = cp.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN profiles sp ON st.profile_id = sp.id
LEFT JOIN services s ON a.service_id = s.id;

-- Add RLS policies for scheduled reports (admin only)
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_deliveries ENABLE ROW LEVEL SECURITY;

-- Admin full access to scheduled reports
CREATE POLICY "Admins can manage scheduled reports" ON scheduled_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Admin full access to report deliveries
CREATE POLICY "Admins can view report deliveries" ON report_deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Grant access to the new tables
GRANT ALL ON scheduled_reports TO authenticated;
GRANT ALL ON report_deliveries TO authenticated;
GRANT SELECT ON appointments_with_details TO authenticated;

-- Add helpful functions for analytics
CREATE OR REPLACE FUNCTION get_date_range_stats(
  start_date DATE,
  end_date DATE,
  staff_id_filter UUID DEFAULT NULL,
  service_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  total_appointments BIGINT,
  completed_appointments BIGINT,
  cancelled_appointments BIGINT,
  total_revenue NUMERIC,
  avg_service_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN status = 'completed' THEN EXTRACT(epoch FROM (end_time - start_time))/60 END), 0) as avg_service_time
  FROM appointments_with_details
  WHERE start_time::DATE BETWEEN start_date AND end_date
    AND (staff_id_filter IS NULL OR staff_id = staff_id_filter)
    AND (service_id_filter IS NULL OR service_id = service_id_filter);
END;
$$ LANGUAGE plpgsql;

-- Update timestamps function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE scheduled_reports IS 'Stores configuration for automated report generation and delivery';
COMMENT ON TABLE report_deliveries IS 'Tracks individual report generation and delivery attempts';
COMMENT ON VIEW appointments_with_details IS 'Enhanced view with all appointment, customer, staff, and service details for analytics';
COMMENT ON FUNCTION get_date_range_stats IS 'Helper function to calculate basic statistics for a date range with optional filters';