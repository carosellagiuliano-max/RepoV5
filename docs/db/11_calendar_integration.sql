-- Calendar Integration Schema
-- Adds support for iCal feeds and Google Calendar sync

-- Calendar tokens table for secure feed access
CREATE TABLE calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  feed_type VARCHAR(20) NOT NULL CHECK (feed_type IN ('ical', 'google')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for calendar_tokens
CREATE INDEX idx_calendar_tokens_staff_id ON calendar_tokens(staff_id);
CREATE INDEX idx_calendar_tokens_token_hash ON calendar_tokens(token_hash);
CREATE INDEX idx_calendar_tokens_feed_type ON calendar_tokens(feed_type);
CREATE INDEX idx_calendar_tokens_active ON calendar_tokens(is_active);

-- Google Calendar mappings table (optional, for Google sync)
CREATE TABLE google_calendar_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  google_calendar_id VARCHAR(255) NOT NULL,
  google_access_token TEXT NOT NULL, -- Encrypted
  google_refresh_token TEXT, -- Encrypted  
  token_expires_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for google_calendar_mappings
CREATE INDEX idx_google_calendar_mappings_staff_id ON google_calendar_mappings(staff_id);
CREATE INDEX idx_google_calendar_mappings_calendar_id ON google_calendar_mappings(google_calendar_id);
CREATE INDEX idx_google_calendar_mappings_sync_enabled ON google_calendar_mappings(sync_enabled);

-- Audit table for calendar access logs
CREATE TABLE calendar_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES calendar_tokens(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('feed_access', 'sync', 'token_created', 'token_deleted')),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for calendar_access_logs
CREATE INDEX idx_calendar_access_logs_staff_id ON calendar_access_logs(staff_id);
CREATE INDEX idx_calendar_access_logs_token_id ON calendar_access_logs(token_id);
CREATE INDEX idx_calendar_access_logs_accessed_at ON calendar_access_logs(accessed_at);

-- Update trigger for calendar_tokens
CREATE OR REPLACE FUNCTION update_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_tokens_updated_at
  BEFORE UPDATE ON calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_tokens_updated_at();

-- Update trigger for google_calendar_mappings
CREATE OR REPLACE FUNCTION update_google_calendar_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_calendar_mappings_updated_at
  BEFORE UPDATE ON google_calendar_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_mappings_updated_at();

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_calendar_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Deactivate expired tokens
  UPDATE calendar_tokens 
  SET is_active = false, updated_at = now()
  WHERE expires_at IS NOT NULL 
    AND expires_at < now() 
    AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up old access logs (keep 90 days)
  DELETE FROM calendar_access_logs 
  WHERE accessed_at < now() - INTERVAL '90 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for calendar tokens with staff information
CREATE OR REPLACE VIEW calendar_tokens_with_staff AS
SELECT 
  ct.*,
  s.profile_id,
  p.first_name,
  p.last_name,
  p.email,
  p.is_active as staff_is_active
FROM calendar_tokens ct
JOIN staff s ON ct.staff_id = s.id
JOIN profiles p ON s.profile_id = p.id;

-- Comments for documentation
COMMENT ON TABLE calendar_tokens IS 'Secure tokens for accessing staff calendar feeds';
COMMENT ON TABLE google_calendar_mappings IS 'Google Calendar integration mappings for staff members';
COMMENT ON TABLE calendar_access_logs IS 'Audit log for calendar access and operations';
COMMENT ON COLUMN calendar_tokens.token_hash IS 'SHA-256 hash of the calendar access token';
COMMENT ON COLUMN google_calendar_mappings.google_access_token IS 'Encrypted Google OAuth access token';
COMMENT ON COLUMN google_calendar_mappings.google_refresh_token IS 'Encrypted Google OAuth refresh token';