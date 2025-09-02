-- Security Hardening Database Schema
-- Audit logging, idempotency tracking, and data retention tables

-- ================================================
-- AUDIT LOG SYSTEM
-- ================================================

-- Audit log table for tracking all admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'staff', 'customer')),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON audit_logs(user_role);

-- ================================================
-- IDEMPOTENCY SYSTEM
-- ================================================

-- Idempotency keys for preventing duplicate operations
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id ON idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ================================================
-- RATE LIMITING SYSTEM
-- ================================================

-- Rate limiting records
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_end TIMESTAMPTZ NOT NULL,
    endpoint TEXT NOT NULL,
    user_role TEXT CHECK (user_role IN ('admin', 'staff', 'customer', 'anonymous')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient rate limit checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key_window ON rate_limits(key, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);

-- ================================================
-- DATA RETENTION SETTINGS
-- ================================================

-- Settings for GDPR data retention
CREATE TABLE IF NOT EXISTS data_retention_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resource_type TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL,
    auto_delete BOOLEAN NOT NULL DEFAULT FALSE,
    last_cleanup TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default retention settings
INSERT INTO data_retention_settings (resource_type, retention_days, auto_delete) VALUES
    ('audit_logs', 3650, TRUE),        -- 10 years for audit logs
    ('customer_data', 2555, FALSE),    -- 7 years for customer data (manual review)
    ('appointments', 2555, FALSE),     -- 7 years for appointments
    ('idempotency_keys', 30, TRUE),    -- 30 days for idempotency keys
    ('rate_limits', 7, TRUE)           -- 7 days for rate limit records
ON CONFLICT (resource_type) DO NOTHING;

-- ================================================
-- DATA RETENTION TRACKING
-- ================================================

-- Track data retention job executions
CREATE TABLE IF NOT EXISTS data_retention_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resource_type TEXT NOT NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_deleted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for tracking job history
CREATE INDEX IF NOT EXISTS idx_data_retention_jobs_resource_type ON data_retention_jobs(resource_type);
CREATE INDEX IF NOT EXISTS idx_data_retention_jobs_started_at ON data_retention_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_data_retention_jobs_status ON data_retention_jobs(status);

-- ================================================
-- RLS POLICIES FOR SECURITY TABLES
-- ================================================

-- Enable RLS on all security tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_jobs ENABLE ROW LEVEL SECURITY;

-- Audit logs: Only admins can read, system can insert
CREATE POLICY "audit_logs_read_admin" ON audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
        AND profiles.is_active = TRUE
    )
);

CREATE POLICY "audit_logs_insert_system" ON audit_logs FOR INSERT WITH CHECK (TRUE);

-- Idempotency keys: Users can only see their own keys
CREATE POLICY "idempotency_keys_read_own" ON idempotency_keys FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "idempotency_keys_insert_own" ON idempotency_keys FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Rate limits: Only system access (no direct user access needed)
CREATE POLICY "rate_limits_system_only" ON rate_limits FOR ALL USING (FALSE);

-- Data retention settings: Only admins
CREATE POLICY "data_retention_settings_admin" ON data_retention_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
        AND profiles.is_active = TRUE
    )
);

-- Data retention jobs: Only admins can read
CREATE POLICY "data_retention_jobs_admin" ON data_retention_jobs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
        AND profiles.is_active = TRUE
    )
);

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create rate limit record
CREATE OR REPLACE FUNCTION get_or_create_rate_limit(
    p_key TEXT,
    p_endpoint TEXT,
    p_user_role TEXT,
    p_window_seconds INTEGER DEFAULT 60
) RETURNS TABLE(
    current_count INTEGER,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ
) AS $$
DECLARE
    current_window_start TIMESTAMPTZ;
    current_window_end TIMESTAMPTZ;
    existing_record RECORD;
BEGIN
    -- Calculate current window
    current_window_start := date_trunc('minute', NOW());
    current_window_end := current_window_start + (p_window_seconds || ' seconds')::INTERVAL;
    
    -- Try to get existing record for current window
    SELECT * INTO existing_record
    FROM rate_limits 
    WHERE key = p_key 
    AND window_start = current_window_start;
    
    IF existing_record IS NOT NULL THEN
        -- Update existing record
        UPDATE rate_limits 
        SET count = count + 1
        WHERE id = existing_record.id;
        
        RETURN QUERY SELECT existing_record.count + 1, existing_record.window_start, existing_record.window_end;
    ELSE
        -- Create new record
        INSERT INTO rate_limits (key, count, window_start, window_end, endpoint, user_role)
        VALUES (p_key, 1, current_window_start, current_window_end, p_endpoint, p_user_role);
        
        RETURN QUERY SELECT 1, current_window_start, current_window_end;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_correlation_id TEXT,
    p_user_id UUID,
    p_user_role TEXT,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        correlation_id, user_id, user_role, action, resource_type, 
        resource_id, old_values, new_values, metadata, ip_address, user_agent
    ) VALUES (
        p_correlation_id, p_user_id, p_user_role, p_action, p_resource_type,
        p_resource_id, p_old_values, p_new_values, p_metadata, p_ip_address, p_user_agent
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================

COMMENT ON TABLE audit_logs IS 'Complete audit trail for all admin and critical user actions';
COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate processing of critical operations';
COMMENT ON TABLE rate_limits IS 'Tracks API rate limiting by endpoint and user role';
COMMENT ON TABLE data_retention_settings IS 'GDPR compliance settings for data retention periods';
COMMENT ON TABLE data_retention_jobs IS 'Tracks execution of automated data cleanup jobs';

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 'Removes expired idempotency keys (run via scheduled job)';
COMMENT ON FUNCTION cleanup_old_rate_limits() IS 'Removes old rate limit records (run via scheduled job)';
COMMENT ON FUNCTION get_or_create_rate_limit(TEXT, TEXT, TEXT, INTEGER) IS 'Atomic rate limit checking and updating';
COMMENT ON FUNCTION log_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INET, TEXT) IS 'Creates standardized audit log entries';