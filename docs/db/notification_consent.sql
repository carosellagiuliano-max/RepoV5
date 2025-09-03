-- Customer notification consent tracking table
-- This table tracks customer consent for various notification channels
-- Required for GDPR compliance

CREATE TABLE notification_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'appointment_reminders',
    'appointment_confirmations', 
    'appointment_changes',
    'marketing',
    'daily_schedules'
  )),
  consented BOOLEAN NOT NULL DEFAULT false,
  consent_source TEXT NOT NULL CHECK (consent_source IN (
    'registration', 'booking_form', 'admin_update', 'unsubscribe_page', 'preference_update'
  )),
  consent_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  consent_ip_address INET,
  consent_user_agent TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppression list for bounced, unsubscribed, or spam-marked contacts
CREATE TABLE notification_suppression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  suppression_type TEXT NOT NULL CHECK (suppression_type IN (
    'unsubscribe', 'bounce', 'spam', 'invalid', 'admin_block'
  )),
  suppression_reason TEXT,
  suppression_source TEXT NOT NULL CHECK (suppression_source IN (
    'user_unsubscribe', 'bounce_handler', 'spam_report', 'admin_action', 'provider_feedback'
  )),
  suppressed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  suppressed_by UUID REFERENCES profiles(id),
  reactivation_token TEXT UNIQUE,
  reactivated_at TIMESTAMP WITH TIME ZONE,
  reactivated_by UUID REFERENCES profiles(id),
  reactivation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure at least one contact method is provided
  CONSTRAINT suppression_contact_check CHECK (
    (email IS NOT NULL AND email != '') OR 
    (phone IS NOT NULL AND phone != '')
  )
);

-- Unsubscribe tokens for one-click unsubscribe links
CREATE TABLE notification_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  channel TEXT CHECK (channel IN ('email', 'sms')),
  notification_types TEXT[] DEFAULT '{}', -- Empty means all types
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_from_ip INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Token should expire in reasonable time (default 30 days)
  CONSTRAINT token_expiry_check CHECK (expires_at > created_at)
);

-- Add dedupe_key to notification_queue for idempotency
ALTER TABLE notification_queue 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
ADD COLUMN IF NOT EXISTS time_window_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_window_end TIMESTAMP WITH TIME ZONE;

-- Create unique index on dedupe_key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_dedupe 
ON notification_queue(dedupe_key) 
WHERE dedupe_key IS NOT NULL AND status != 'cancelled';

-- Add suppression check constraint to notification_queue
ALTER TABLE notification_queue 
ADD COLUMN IF NOT EXISTS suppression_checked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suppression_reason TEXT;

-- Create indexes for performance
CREATE INDEX idx_notification_consent_customer ON notification_consent(customer_id);
CREATE INDEX idx_notification_consent_channel_type ON notification_consent(channel, consent_type);
CREATE INDEX idx_notification_suppression_email ON notification_suppression(email) WHERE email IS NOT NULL;
CREATE INDEX idx_notification_suppression_phone ON notification_suppression(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_notification_suppression_type ON notification_suppression(suppression_type);
CREATE INDEX idx_unsubscribe_tokens_token ON notification_unsubscribe_tokens(token);
CREATE INDEX idx_unsubscribe_tokens_customer ON notification_unsubscribe_tokens(customer_id);
CREATE INDEX idx_unsubscribe_tokens_expires ON notification_unsubscribe_tokens(expires_at);

-- Enable RLS
ALTER TABLE notification_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_consent
CREATE POLICY "Users can view their own consent" ON notification_consent
  FOR SELECT USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can update their own consent" ON notification_consent
  FOR UPDATE USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can insert their own consent" ON notification_consent
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin can manage all consent" ON notification_consent
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for notification_suppression  
CREATE POLICY "Admin can view suppression list" ON notification_suppression
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin can manage suppression list" ON notification_suppression
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for unsubscribe tokens
CREATE POLICY "Users can view their own tokens" ON notification_unsubscribe_tokens
  FOR SELECT USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "System can manage unsubscribe tokens" ON notification_unsubscribe_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Add helper functions
CREATE OR REPLACE FUNCTION check_notification_consent(
  p_customer_id UUID,
  p_channel TEXT,
  p_consent_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  consent_exists BOOLEAN := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM notification_consent
    WHERE customer_id = p_customer_id
      AND channel = p_channel
      AND consent_type = p_consent_type
      AND consented = true
  ) INTO consent_exists;
  
  RETURN consent_exists;
END;
$$;

CREATE OR REPLACE FUNCTION check_suppression_status(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS TABLE(
  is_suppressed BOOLEAN,
  suppression_type TEXT,
  suppression_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_suppressed,
    s.suppression_type,
    s.suppression_reason
  FROM notification_suppression s
  WHERE (p_email IS NOT NULL AND s.email = p_email)
     OR (p_phone IS NOT NULL AND s.phone = p_phone)
  ORDER BY s.suppressed_at DESC
  LIMIT 1;
  
  -- If no suppression found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_unsubscribe_token(
  p_customer_id UUID,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_notification_types TEXT[] DEFAULT '{}'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token TEXT;
  expires TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate secure random token
  token := encode(gen_random_bytes(32), 'base64url');
  expires := NOW() + INTERVAL '30 days';
  
  -- Insert token
  INSERT INTO notification_unsubscribe_tokens (
    token, customer_id, email, phone, channel, notification_types, expires_at
  ) VALUES (
    token, p_customer_id, p_email, p_phone, p_channel, p_notification_types, expires
  );
  
  RETURN token;
END;
$$;

-- Function to process unsubscribe
CREATE OR REPLACE FUNCTION process_unsubscribe(
  p_token TEXT,
  p_ip_address INET DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  customer_id UUID,
  affected_channels TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
  affected TEXT[] := '{}';
BEGIN
  -- Find and validate token
  SELECT * INTO token_record
  FROM notification_unsubscribe_tokens
  WHERE token = p_token
    AND expires_at > NOW()
    AND used_at IS NULL;
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired unsubscribe token'::TEXT, NULL::UUID, '{}'::TEXT[];
    RETURN;
  END IF;
  
  -- Mark token as used
  UPDATE notification_unsubscribe_tokens
  SET used_at = NOW(), used_from_ip = p_ip_address
  WHERE token = p_token;
  
  -- Add to suppression list
  IF token_record.email IS NOT NULL THEN
    INSERT INTO notification_suppression (
      email, suppression_type, suppression_reason, suppression_source
    ) VALUES (
      token_record.email, 'unsubscribe', 'User unsubscribed via email link', 'user_unsubscribe'
    ) ON CONFLICT (email) WHERE suppression_type = 'unsubscribe' DO NOTHING;
    
    affected := array_append(affected, 'email');
  END IF;
  
  IF token_record.phone IS NOT NULL THEN
    INSERT INTO notification_suppression (
      phone, suppression_type, suppression_reason, suppression_source
    ) VALUES (
      token_record.phone, 'unsubscribe', 'User unsubscribed via SMS link', 'user_unsubscribe'
    ) ON CONFLICT (phone) WHERE suppression_type = 'unsubscribe' DO NOTHING;
    
    affected := array_append(affected, 'sms');
  END IF;
  
  -- Update consent records
  UPDATE notification_consent
  SET consented = false, 
      updated_at = NOW(),
      consent_source = 'unsubscribe_page'
  WHERE customer_id = token_record.customer_id
    AND (
      (token_record.channel IS NULL) OR 
      (channel = token_record.channel)
    )
    AND (
      array_length(token_record.notification_types, 1) IS NULL OR
      consent_type = ANY(token_record.notification_types)
    );
  
  RETURN QUERY SELECT 
    true, 
    'Successfully unsubscribed'::TEXT, 
    token_record.customer_id, 
    affected;
END;
$$;

-- Add audit trigger for consent changes
CREATE OR REPLACE FUNCTION audit_consent_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_audit (
    notification_id,
    event_type,
    details
  ) VALUES (
    NULL, -- No specific notification
    'consent_change',
    jsonb_build_object(
      'customer_id', COALESCE(NEW.customer_id, OLD.customer_id),
      'channel', COALESCE(NEW.channel, OLD.channel),
      'consent_type', COALESCE(NEW.consent_type, OLD.consent_type),
      'old_consented', CASE WHEN TG_OP = 'UPDATE' THEN OLD.consented ELSE NULL END,
      'new_consented', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.consented END,
      'action', TG_OP,
      'updated_by', COALESCE(NEW.updated_by, OLD.updated_by)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_consent_change
  AFTER INSERT OR UPDATE OR DELETE ON notification_consent
  FOR EACH ROW EXECUTE FUNCTION audit_consent_change();