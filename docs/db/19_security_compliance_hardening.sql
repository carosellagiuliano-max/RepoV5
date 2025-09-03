-- Security & Compliance Hardening - Database Schema Enhancements
-- This migration adds unified idempotency, enhanced audit, and data retention systems

-- Unified operations idempotency table (extends payment_idempotency)
CREATE TABLE IF NOT EXISTS operations_idempotency (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  
  -- Request details
  request_hash TEXT NOT NULL, -- SHA-256 of request body
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  
  -- Response caching
  response_status INTEGER,
  response_body JSONB,
  
  -- Expiry (24 hours default, configurable)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Indexes for performance
);
-- Extend existing admin_audit table if it exists, otherwise create it
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS after_data JSONB;
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS diff_data JSONB;
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Add indexes for enhanced audit queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_correlation ON admin_audit(correlation_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action_resource ON admin_audit(action_type, resource_type);

-- Data retention configuration table
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  resource_type TEXT NOT NULL, -- appointments, payments, audit_logs, etc.
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  is_active BOOLEAN DEFAULT true,
  
  -- Retention rules
  deletion_criteria JSONB NOT NULL DEFAULT '{}', -- Additional criteria for deletion
  archive_before_delete BOOLEAN DEFAULT true,
  archive_table_name TEXT, -- Table name for archived data
  
  -- GDPR and compliance
  gdpr_category TEXT, -- personal_data, financial_data, operational_data
  legal_basis TEXT, -- legitimate_interest, contract, legal_obligation
  
  -- Audit
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique policies per resource type
  UNIQUE(resource_type)
);

-- Data retention execution log
CREATE TABLE IF NOT EXISTS data_retention_executions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  policy_id UUID REFERENCES data_retention_policies(id) ON DELETE CASCADE NOT NULL,
  
  -- Execution details
  execution_type TEXT NOT NULL, -- dry_run, execute, rollback
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
  
  -- Results
  records_identified INTEGER DEFAULT 0,
  records_archived INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  -- Execution details
  execution_summary JSONB DEFAULT '{}',
  dry_run_results JSONB, -- Detailed results for dry runs
  
  -- Audit
  executed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Performance tracking
  duration_seconds INTEGER,
  
  INDEX idx_retention_executions_policy (policy_id),
  INDEX idx_retention_executions_status (status),
  INDEX idx_retention_executions_started (started_at DESC)
);

-- Security metrics tracking table
CREATE TABLE IF NOT EXISTS security_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  metric_type TEXT NOT NULL, -- rate_limit_exceeded, idempotency_hit, audit_event
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  
  -- Context
  endpoint TEXT,
  user_role TEXT,
  ip_address INET,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Aggregation support
  date_bucket DATE GENERATED ALWAYS AS (DATE(recorded_at)) STORED,
  hour_bucket TIMESTAMPTZ GENERATED ALWAYS AS (DATE_TRUNC('hour', recorded_at)) STORED,
  
  -- Indexes for analytics
  INDEX idx_security_metrics_type_name (metric_type, metric_name),
  INDEX idx_security_metrics_endpoint (endpoint),
  INDEX idx_security_metrics_recorded (recorded_at DESC),
  INDEX idx_security_metrics_date_bucket (date_bucket),
  INDEX idx_security_metrics_hour_bucket (hour_bucket)
);

-- Insert default data retention policies
INSERT INTO data_retention_policies (
  resource_type, 
  retention_days, 
  gdpr_category, 
  legal_basis,
  deletion_criteria,
  archive_before_delete
) VALUES 
  ('appointments', 2555, 'personal_data', 'contract', '{"status": ["cancelled", "completed"]}', true), -- 7 years for completed appointments
  ('payments', 3650, 'financial_data', 'legal_obligation', '{}', true), -- 10 years for financial records
  ('admin_audit', 2555, 'operational_data', 'legitimate_interest', '{}', true), -- 7 years for audit logs
  ('operations_idempotency', 7, 'operational_data', 'legitimate_interest', '{}', false), -- 7 days for idempotency keys
  ('security_metrics', 365, 'operational_data', 'legitimate_interest', '{}', true), -- 1 year for security metrics
  ('notification_queue', 30, 'operational_data', 'legitimate_interest', '{"status": ["completed", "failed"]}', false), -- 30 days for notifications
  ('customer_data', 2555, 'personal_data', 'contract', '{"is_active": false}', true) -- 7 years for inactive customers
ON CONFLICT (resource_type) DO NOTHING;

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM operations_idempotency
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Log metrics
  INSERT INTO security_metrics (metric_type, metric_name, metric_value, metadata)
  VALUES ('cleanup', 'idempotency_keys_cleaned', v_deleted_count, 
          jsonb_build_object('timestamp', NOW()));
  
  RETURN v_deleted_count;
END;
$$;

-- Function to execute data retention policy (dry run mode)
CREATE OR REPLACE FUNCTION execute_data_retention_dry_run(
  p_policy_id UUID
)
RETURNS TABLE(
  resource_count INTEGER,
  oldest_record TIMESTAMPTZ,
  sample_records JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_policy data_retention_policies%ROWTYPE;
  v_cutoff_date TIMESTAMPTZ;
  v_execution_id UUID;
  v_query TEXT;
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_samples JSONB;
BEGIN
  -- Get policy details
  SELECT * INTO v_policy FROM data_retention_policies WHERE id = p_policy_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active retention policy not found: %', p_policy_id;
  END IF;
  
  -- Calculate cutoff date
  v_cutoff_date := NOW() - (v_policy.retention_days || ' days')::INTERVAL;
  
  -- Create execution record
  INSERT INTO data_retention_executions (
    policy_id, execution_type, status, executed_by
  ) VALUES (
    p_policy_id, 'dry_run', 'running', NULL
  ) RETURNING id INTO v_execution_id;
  
  -- Execute dry run query based on resource type
  CASE v_policy.resource_type
    WHEN 'appointments' THEN
      SELECT COUNT(*), MIN(created_at) INTO v_count, v_oldest
      FROM appointments 
      WHERE created_at < v_cutoff_date
      AND (v_policy.deletion_criteria->>'status' IS NULL 
           OR status = ANY(string_to_array(v_policy.deletion_criteria->>'status', ',')));
           
    WHEN 'admin_audit' THEN
      SELECT COUNT(*), MIN(created_at) INTO v_count, v_oldest
      FROM admin_audit 
      WHERE created_at < v_cutoff_date;
      
    WHEN 'operations_idempotency' THEN
      SELECT COUNT(*), MIN(created_at) INTO v_count, v_oldest
      FROM operations_idempotency 
      WHERE created_at < v_cutoff_date;
      
    WHEN 'security_metrics' THEN
      SELECT COUNT(*), MIN(recorded_at) INTO v_count, v_oldest
      FROM security_metrics 
      WHERE recorded_at < v_cutoff_date;
      
    ELSE
      RAISE EXCEPTION 'Unsupported resource type for retention: %', v_policy.resource_type;
  END CASE;
  
  -- Create sample data
  v_samples := jsonb_build_object(
    'policy_id', p_policy_id,
    'resource_type', v_policy.resource_type,
    'cutoff_date', v_cutoff_date,
    'retention_days', v_policy.retention_days
  );
  
  -- Update execution record
  UPDATE data_retention_executions 
  SET 
    status = 'completed',
    completed_at = NOW(),
    records_identified = v_count,
    dry_run_results = v_samples,
    duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE id = v_execution_id;
  
  RETURN QUERY SELECT v_count, v_oldest, v_samples;
END;
$$;

-- Function to record security metrics
CREATE OR REPLACE FUNCTION record_security_metric(
  p_metric_type TEXT,
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_endpoint TEXT DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_metrics (
    metric_type, metric_name, metric_value,
    endpoint, user_role, ip_address, metadata
  ) VALUES (
    p_metric_type, p_metric_name, p_metric_value,
    p_endpoint, p_user_role, p_ip_address, p_metadata
  );
END;
$$;

-- Add updated_at triggers for new tables
CREATE TRIGGER update_data_retention_policies_updated_at 
  BEFORE UPDATE ON data_retention_policies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;