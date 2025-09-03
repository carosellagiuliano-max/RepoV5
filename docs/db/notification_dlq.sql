-- Dead Letter Queue for permanently failed notifications
CREATE TABLE notification_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_notification_id UUID REFERENCES notification_queue(id) ON DELETE CASCADE,
  
  -- Original notification data
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms')),
  notification_channel TEXT NOT NULL,
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  recipient_email TEXT,
  recipient_phone TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  
  -- Failure information
  failure_reason TEXT NOT NULL,
  failure_details JSONB,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  
  -- Classification
  failure_type TEXT NOT NULL CHECK (failure_type IN (
    'hard_bounce', 'soft_bounce', 'invalid_email', 'invalid_phone',
    'spam_complaint', 'unsubscribed', 'quota_exceeded', 'provider_error',
    'timeout', 'content_rejected', 'rate_limited', 'unknown'
  )),
  is_permanent BOOLEAN DEFAULT true,
  retry_eligible BOOLEAN DEFAULT false,
  
  -- Resolution
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id),
  resolution_action TEXT CHECK (resolution_action IN (
    'manual_retry', 'address_updated', 'suppressed', 'ignored'
  )),
  resolution_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provider webhook events table
CREATE TABLE notification_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  provider TEXT NOT NULL CHECK (provider IN ('twilio', 'smtp', 'mailgun', 'sendgrid')),
  provider_event_id TEXT,
  event_type TEXT NOT NULL,
  
  -- Notification reference
  notification_id UUID REFERENCES notification_queue(id),
  provider_message_id TEXT,
  
  -- Event data
  event_data JSONB NOT NULL DEFAULT '{}',
  status TEXT,
  error_code TEXT,
  error_message TEXT,
  
  -- Delivery information
  delivered_at TIMESTAMP WITH TIME ZONE,
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'undetermined')),
  complaint_type TEXT CHECK (complaint_type IN ('abuse', 'auth-failure', 'fraud', 'not-spam', 'other', 'virus')),
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  
  -- Webhook metadata
  webhook_signature TEXT,
  webhook_verified BOOLEAN DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification retry configuration
CREATE TABLE notification_retry_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuration scope
  scope TEXT NOT NULL CHECK (scope IN ('global', 'channel', 'provider')),
  scope_value TEXT, -- channel name or provider name
  
  -- Retry settings
  max_attempts INTEGER DEFAULT 3,
  initial_delay_minutes INTEGER DEFAULT 15,
  backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
  max_delay_minutes INTEGER DEFAULT 1440, -- 24 hours
  
  -- Failure type specific settings
  hard_bounce_retries INTEGER DEFAULT 0,
  soft_bounce_retries INTEGER DEFAULT 3,
  timeout_retries INTEGER DEFAULT 2,
  rate_limit_retries INTEGER DEFAULT 5,
  
  -- Time limits
  max_age_hours INTEGER DEFAULT 48,
  dlq_after_hours INTEGER DEFAULT 72,
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_burst INTEGER DEFAULT 10,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bounce suppression patterns
CREATE TABLE notification_bounce_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pattern matching
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('email_domain', 'email_regex', 'error_code', 'error_message')),
  pattern_value TEXT NOT NULL,
  
  -- Action to take
  action TEXT NOT NULL CHECK (action IN ('suppress', 'retry', 'dlq', 'alert')),
  suppression_duration_days INTEGER,
  
  -- Pattern metadata
  provider TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dlq_notification_id ON notification_dead_letter_queue(original_notification_id);
CREATE INDEX idx_dlq_failure_type ON notification_dead_letter_queue(failure_type);
CREATE INDEX idx_dlq_created_at ON notification_dead_letter_queue(created_at);
CREATE INDEX idx_dlq_resolved ON notification_dead_letter_queue(resolved_at) WHERE resolved_at IS NOT NULL;

CREATE INDEX idx_webhook_events_notification_id ON notification_webhook_events(notification_id);
CREATE INDEX idx_webhook_events_provider ON notification_webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_processed ON notification_webhook_events(processed, received_at);

CREATE INDEX idx_retry_config_scope ON notification_retry_config(scope, scope_value);
CREATE INDEX idx_bounce_patterns_type ON notification_bounce_patterns(pattern_type, is_active);

-- Enable RLS
ALTER TABLE notification_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_retry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_bounce_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin can manage DLQ" ON notification_dead_letter_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin can view webhook events" ON notification_webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "System can insert webhook events" ON notification_webhook_events
  FOR INSERT WITH CHECK (true); -- Allow system to insert webhook events

CREATE POLICY "Admin can manage retry config" ON notification_retry_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage bounce patterns" ON notification_bounce_patterns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Helper functions

CREATE OR REPLACE FUNCTION move_to_dlq(
  p_notification_id UUID,
  p_failure_reason TEXT,
  p_failure_type TEXT DEFAULT 'unknown',
  p_failure_details JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  dlq_id UUID;
BEGIN
  -- Get the notification record
  SELECT * INTO notification_record
  FROM notification_queue
  WHERE id = p_notification_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found: %', p_notification_id;
  END IF;
  
  -- Insert into DLQ
  INSERT INTO notification_dead_letter_queue (
    original_notification_id,
    notification_type,
    notification_channel,
    recipient_id,
    recipient_email,
    recipient_phone,
    template_data,
    failure_reason,
    failure_details,
    failure_type,
    total_attempts,
    last_error_message,
    last_attempt_at
  ) VALUES (
    p_notification_id,
    notification_record.type,
    notification_record.channel,
    notification_record.recipient_id,
    notification_record.recipient_email,
    notification_record.recipient_phone,
    notification_record.template_data,
    p_failure_reason,
    p_failure_details,
    p_failure_type,
    notification_record.attempts,
    notification_record.error_message,
    notification_record.last_attempt_at
  ) RETURNING id INTO dlq_id;
  
  -- Update original notification
  UPDATE notification_queue SET
    status = 'failed',
    error_message = p_failure_reason,
    updated_at = NOW()
  WHERE id = p_notification_id;
  
  -- Add audit entry
  INSERT INTO notification_audit (
    notification_id,
    event_type,
    details
  ) VALUES (
    p_notification_id,
    'moved_to_dlq',
    jsonb_build_object(
      'dlq_id', dlq_id,
      'failure_reason', p_failure_reason,
      'failure_type', p_failure_type
    )
  );
  
  RETURN dlq_id;
END;
$$;

CREATE OR REPLACE FUNCTION process_webhook_event(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_provider_message_id TEXT,
  p_event_data JSONB,
  p_status TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_id UUID;
  notification_id UUID;
  should_suppress BOOLEAN := false;
  bounce_type TEXT;
BEGIN
  -- Insert webhook event
  INSERT INTO notification_webhook_events (
    provider,
    provider_event_id,
    event_type,
    provider_message_id,
    event_data,
    status,
    error_code,
    error_message,
    webhook_verified
  ) VALUES (
    p_provider,
    p_provider_event_id,
    p_event_type,
    p_provider_message_id,
    p_event_data,
    p_status,
    p_error_code,
    p_error_message,
    true -- Assume verified for now
  ) RETURNING id INTO webhook_id;
  
  -- Find related notification
  SELECT nq.id INTO notification_id
  FROM notification_queue nq
  JOIN notification_audit na ON na.notification_id = nq.id
  WHERE na.details->>'provider_message_id' = p_provider_message_id
     OR na.details->>'messageId' = p_provider_message_id
  LIMIT 1;
  
  -- Update webhook event with notification_id
  UPDATE notification_webhook_events 
  SET notification_id = notification_id
  WHERE id = webhook_id;
  
  -- Process the event based on type
  CASE p_event_type
    WHEN 'delivered', 'sent' THEN
      -- Mark as delivered
      UPDATE notification_webhook_events 
      SET delivered_at = NOW(), processed = true, processed_at = NOW()
      WHERE id = webhook_id;
      
    WHEN 'bounce', 'failed' THEN
      -- Determine bounce type
      bounce_type := CASE 
        WHEN p_error_code ~ '^5\d\d' THEN 'hard'
        WHEN p_error_code ~ '^4\d\d' THEN 'soft'
        ELSE 'undetermined'
      END;
      
      UPDATE notification_webhook_events 
      SET bounce_type = bounce_type, processed = true, processed_at = NOW()
      WHERE id = webhook_id;
      
      -- Check if we should suppress this contact
      should_suppress := (bounce_type = 'hard' OR p_event_type = 'complaint');
      
      IF should_suppress AND notification_id IS NOT NULL THEN
        -- Get recipient info and add to suppression list
        INSERT INTO notification_suppression (
          email, phone, suppression_type, suppression_reason, suppression_source
        )
        SELECT 
          nq.recipient_email,
          nq.recipient_phone,
          CASE WHEN p_event_type = 'complaint' THEN 'spam' ELSE 'bounce' END,
          COALESCE(p_error_message, 'Provider feedback'),
          'provider_feedback'
        FROM notification_queue nq
        WHERE nq.id = notification_id
        ON CONFLICT DO NOTHING;
      END IF;
      
    WHEN 'complaint', 'spam' THEN
      -- Handle spam complaints
      UPDATE notification_webhook_events 
      SET complaint_type = 'abuse', processed = true, processed_at = NOW()
      WHERE id = webhook_id;
      
      -- Add to suppression list
      IF notification_id IS NOT NULL THEN
        INSERT INTO notification_suppression (
          email, phone, suppression_type, suppression_reason, suppression_source
        )
        SELECT 
          nq.recipient_email,
          nq.recipient_phone,
          'spam',
          'Spam complaint from provider',
          'provider_feedback'
        FROM notification_queue nq
        WHERE nq.id = notification_id
        ON CONFLICT DO NOTHING;
      END IF;
      
    ELSE
      -- Unknown event type, just mark as processed
      UPDATE notification_webhook_events 
      SET processed = true, processed_at = NOW()
      WHERE id = webhook_id;
  END CASE;
  
  RETURN webhook_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_retry_config(
  p_channel TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL
) RETURNS TABLE(
  max_attempts INTEGER,
  initial_delay_minutes INTEGER,
  backoff_multiplier DECIMAL,
  max_delay_minutes INTEGER,
  max_age_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(rc.max_attempts, 3),
    COALESCE(rc.initial_delay_minutes, 15),
    COALESCE(rc.backoff_multiplier, 2.0),
    COALESCE(rc.max_delay_minutes, 1440),
    COALESCE(rc.max_age_hours, 48)
  FROM notification_retry_config rc
  WHERE (rc.scope = 'channel' AND rc.scope_value = p_channel)
     OR (rc.scope = 'provider' AND rc.scope_value = p_provider)
     OR rc.scope = 'global'
  ORDER BY 
    CASE rc.scope 
      WHEN 'channel' THEN 1
      WHEN 'provider' THEN 2
      WHEN 'global' THEN 3
    END
  LIMIT 1;
  
  -- If no config found, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 3, 15, 2.0::DECIMAL, 1440, 48;
  END IF;
END;
$$;

-- Trigger to automatically move old failed notifications to DLQ
CREATE OR REPLACE FUNCTION trigger_auto_dlq()
RETURNS TRIGGER AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Only trigger for failed notifications that have reached max attempts
  IF NEW.status = 'failed' AND NEW.attempts >= NEW.max_attempts THEN
    
    -- Get retry config
    SELECT * INTO config_record
    FROM get_retry_config(NEW.channel, 
      CASE WHEN NEW.type = 'email' THEN 'smtp' ELSE 'twilio' END
    ) LIMIT 1;
    
    -- Check if notification is too old
    IF NEW.created_at < NOW() - INTERVAL '1 hour' * COALESCE(config_record.max_age_hours, 48) THEN
      -- Move to DLQ
      PERFORM move_to_dlq(
        NEW.id,
        'Maximum age exceeded',
        'timeout',
        jsonb_build_object(
          'max_age_hours', config_record.max_age_hours,
          'age_hours', EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 3600
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_auto_dlq
  AFTER UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_dlq();