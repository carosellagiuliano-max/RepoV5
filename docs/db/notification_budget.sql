-- Enhanced notification settings table with granular controls
-- This supports global, location, and user-specific settings

CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'location', 'user')),
  scope_id UUID, -- NULL for global, location_id for location, user_id for user
  
  -- Channel settings
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  
  -- Timing settings
  reminder_hours_before INTEGER DEFAULT 24,
  send_confirmations BOOLEAN DEFAULT true,
  send_cancellations BOOLEAN DEFAULT true,
  send_daily_schedule BOOLEAN DEFAULT true,
  daily_schedule_time TIME DEFAULT '08:00',
  
  -- Quiet hours settings  
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '21:00',
  quiet_hours_end TIME DEFAULT '08:00',
  timezone TEXT DEFAULT 'Europe/Zurich',
  
  -- Budget controls
  monthly_email_limit INTEGER,
  monthly_sms_limit INTEGER,
  budget_warning_threshold DECIMAL(3,2) DEFAULT 0.80, -- 80%
  budget_hard_cap BOOLEAN DEFAULT true,
  cost_per_email_cents INTEGER DEFAULT 0, -- Track costs in cents
  cost_per_sms_cents INTEGER DEFAULT 5,   -- ~5 cents per SMS
  
  -- Retry and failure handling
  retry_attempts INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 15,
  max_queue_age_hours INTEGER DEFAULT 48,
  
  -- Fallback settings
  sms_fallback_to_email BOOLEAN DEFAULT false,
  email_fallback_to_sms BOOLEAN DEFAULT false,
  
  -- Short window policy
  short_window_policy TEXT DEFAULT 'send' CHECK (short_window_policy IN ('send', 'skip')),
  short_window_threshold_hours INTEGER DEFAULT 6,
  
  -- Advanced settings
  rate_limit_per_minute INTEGER DEFAULT 60,
  batch_size INTEGER DEFAULT 50,
  
  -- Audit fields
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly budget tracking table
CREATE TABLE notification_budget_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'location', 'user')),
  scope_id UUID, -- NULL for global, location_id for location, user_id for user
  
  -- Usage counters
  email_count INTEGER DEFAULT 0,
  sms_count INTEGER DEFAULT 0,
  email_cost_cents INTEGER DEFAULT 0,
  sms_cost_cents INTEGER DEFAULT 0,
  
  -- Budget status
  email_budget_limit INTEGER,
  sms_budget_limit INTEGER,
  email_budget_used_pct DECIMAL(5,2) DEFAULT 0,
  sms_budget_used_pct DECIMAL(5,2) DEFAULT 0,
  
  -- Warnings and alerts
  warning_sent_at TIMESTAMP WITH TIME ZONE,
  hard_cap_reached_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per scope per month
  UNIQUE(year, month, scope, scope_id)
);

-- Cost tracking for individual notifications
CREATE TABLE notification_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notification_queue(id) ON DELETE CASCADE,
  
  -- Cost details
  provider TEXT, -- 'smtp', 'twilio', etc.
  cost_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  provider_message_id TEXT,
  provider_cost_details JSONB,
  
  -- Billing period
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notification_settings_scope ON notification_settings(scope, scope_id);
CREATE INDEX idx_budget_tracking_period ON notification_budget_tracking(year, month, scope, scope_id);
CREATE INDEX idx_cost_tracking_notification ON notification_cost_tracking(notification_id);
CREATE INDEX idx_cost_tracking_period ON notification_cost_tracking(billing_year, billing_month);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_cost_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_settings
CREATE POLICY "Admin can manage all settings" ON notification_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff can view settings" ON notification_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can view their own settings" ON notification_settings
  FOR SELECT USING (
    scope = 'user' AND scope_id = auth.uid()
  );

-- RLS Policies for budget tracking  
CREATE POLICY "Admin can view all budget tracking" ON notification_budget_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- RLS Policies for cost tracking
CREATE POLICY "Admin can view cost tracking" ON notification_cost_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Helper functions
CREATE OR REPLACE FUNCTION get_notification_settings(
  p_scope TEXT DEFAULT 'global',
  p_scope_id UUID DEFAULT NULL
) RETURNS TABLE(
  setting_key TEXT,
  setting_value TEXT,
  setting_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return settings with fallback hierarchy: user -> location -> global
  RETURN QUERY
  WITH setting_hierarchy AS (
    -- User settings (highest priority)
    SELECT 
      'email_enabled' as key, email_enabled::TEXT as value, 'boolean' as type, 1 as priority
    FROM notification_settings 
    WHERE scope = 'user' AND scope_id = p_scope_id AND p_scope = 'user'
    
    UNION ALL
    
    SELECT 'sms_enabled', sms_enabled::TEXT, 'boolean', 1
    FROM notification_settings 
    WHERE scope = 'user' AND scope_id = p_scope_id AND p_scope = 'user'
    
    UNION ALL
    
    -- Location settings (medium priority) 
    SELECT 'email_enabled', email_enabled::TEXT, 'boolean', 2
    FROM notification_settings 
    WHERE scope = 'location' AND scope_id = p_scope_id AND p_scope = 'location'
    
    UNION ALL
    
    SELECT 'sms_enabled', sms_enabled::TEXT, 'boolean', 2
    FROM notification_settings 
    WHERE scope = 'location' AND scope_id = p_scope_id AND p_scope = 'location'
    
    UNION ALL
    
    -- Global settings (lowest priority, always present)
    SELECT 'email_enabled', COALESCE(email_enabled, true)::TEXT, 'boolean', 3
    FROM notification_settings 
    WHERE scope = 'global'
    ORDER BY created_at DESC
    LIMIT 1
    
    UNION ALL
    
    SELECT 'sms_enabled', COALESCE(sms_enabled, false)::TEXT, 'boolean', 3
    FROM notification_settings 
    WHERE scope = 'global'
    ORDER BY created_at DESC
    LIMIT 1
  )
  SELECT DISTINCT ON (sh.key)
    sh.key as setting_key,
    sh.value as setting_value, 
    sh.type as setting_type
  FROM setting_hierarchy sh
  ORDER BY sh.key, sh.priority;
END;
$$;

CREATE OR REPLACE FUNCTION update_budget_tracking(
  p_notification_type TEXT,
  p_cost_cents INTEGER DEFAULT 0,
  p_scope TEXT DEFAULT 'global',
  p_scope_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  budget_limit INTEGER;
  current_count INTEGER;
  usage_pct DECIMAL(5,2);
BEGIN
  -- Insert or update budget tracking record
  INSERT INTO notification_budget_tracking (
    year, month, scope, scope_id,
    email_count, sms_count, email_cost_cents, sms_cost_cents
  ) VALUES (
    current_year, current_month, p_scope, p_scope_id,
    CASE WHEN p_notification_type = 'email' THEN 1 ELSE 0 END,
    CASE WHEN p_notification_type = 'sms' THEN 1 ELSE 0 END,
    CASE WHEN p_notification_type = 'email' THEN p_cost_cents ELSE 0 END,
    CASE WHEN p_notification_type = 'sms' THEN p_cost_cents ELSE 0 END
  )
  ON CONFLICT (year, month, scope, scope_id) DO UPDATE SET
    email_count = notification_budget_tracking.email_count + 
      CASE WHEN p_notification_type = 'email' THEN 1 ELSE 0 END,
    sms_count = notification_budget_tracking.sms_count + 
      CASE WHEN p_notification_type = 'sms' THEN 1 ELSE 0 END,
    email_cost_cents = notification_budget_tracking.email_cost_cents + 
      CASE WHEN p_notification_type = 'email' THEN p_cost_cents ELSE 0 END,
    sms_cost_cents = notification_budget_tracking.sms_cost_cents + 
      CASE WHEN p_notification_type = 'sms' THEN p_cost_cents ELSE 0 END,
    updated_at = NOW();
    
  -- Update usage percentage
  SELECT 
    CASE WHEN p_notification_type = 'email' THEN monthly_email_limit ELSE monthly_sms_limit END,
    CASE WHEN p_notification_type = 'email' THEN email_count ELSE sms_count END
  INTO budget_limit, current_count
  FROM notification_budget_tracking nbt
  JOIN notification_settings ns ON (
    (ns.scope = nbt.scope AND ns.scope_id = nbt.scope_id) OR
    (ns.scope = 'global' AND nbt.scope != 'global' AND NOT EXISTS(
      SELECT 1 FROM notification_settings ns2 
      WHERE ns2.scope = nbt.scope AND ns2.scope_id = nbt.scope_id
    ))
  )
  WHERE nbt.year = current_year AND nbt.month = current_month 
    AND nbt.scope = p_scope AND nbt.scope_id = p_scope_id
  ORDER BY ns.scope DESC
  LIMIT 1;
  
  IF budget_limit IS NOT NULL AND budget_limit > 0 THEN
    usage_pct := (current_count::DECIMAL / budget_limit::DECIMAL) * 100;
    
    UPDATE notification_budget_tracking SET
      email_budget_used_pct = CASE WHEN p_notification_type = 'email' THEN usage_pct ELSE email_budget_used_pct END,
      sms_budget_used_pct = CASE WHEN p_notification_type = 'sms' THEN usage_pct ELSE sms_budget_used_pct END
    WHERE year = current_year AND month = current_month 
      AND scope = p_scope AND scope_id = p_scope_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION check_budget_limit(
  p_notification_type TEXT,
  p_scope TEXT DEFAULT 'global',
  p_scope_id UUID DEFAULT NULL
) RETURNS TABLE(
  can_send BOOLEAN,
  reason TEXT,
  usage_pct DECIMAL(5,2),
  limit_reached BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  budget_limit INTEGER;
  current_count INTEGER;
  hard_cap BOOLEAN;
  warning_threshold DECIMAL(3,2);
BEGIN
  -- Get current usage and limits
  SELECT 
    CASE WHEN p_notification_type = 'email' THEN ns.monthly_email_limit ELSE ns.monthly_sms_limit END,
    COALESCE(CASE WHEN p_notification_type = 'email' THEN nbt.email_count ELSE nbt.sms_count END, 0),
    COALESCE(ns.budget_hard_cap, true),
    COALESCE(ns.budget_warning_threshold, 0.80)
  INTO budget_limit, current_count, hard_cap, warning_threshold
  FROM notification_settings ns
  LEFT JOIN notification_budget_tracking nbt ON (
    nbt.year = current_year AND nbt.month = current_month 
    AND nbt.scope = p_scope AND nbt.scope_id = p_scope_id
  )
  WHERE ns.scope = p_scope AND ns.scope_id = p_scope_id
  ORDER BY ns.created_at DESC
  LIMIT 1;
  
  -- Fallback to global settings if no specific settings found
  IF budget_limit IS NULL THEN
    SELECT 
      CASE WHEN p_notification_type = 'email' THEN ns.monthly_email_limit ELSE ns.monthly_sms_limit END,
      COALESCE(ns.budget_hard_cap, true),
      COALESCE(ns.budget_warning_threshold, 0.80)
    INTO budget_limit, hard_cap, warning_threshold
    FROM notification_settings ns
    WHERE ns.scope = 'global'
    ORDER BY ns.created_at DESC
    LIMIT 1;
  END IF;
  
  -- If no limit set, allow sending
  IF budget_limit IS NULL OR budget_limit <= 0 THEN
    RETURN QUERY SELECT true, NULL::TEXT, 0::DECIMAL(5,2), false;
    RETURN;
  END IF;
  
  -- Calculate usage percentage
  DECLARE
    usage_percentage DECIMAL(5,2) := (current_count::DECIMAL / budget_limit::DECIMAL) * 100;
  BEGIN
    -- Check if hard cap reached
    IF hard_cap AND current_count >= budget_limit THEN
      RETURN QUERY SELECT false, 'Budget limit reached', usage_percentage, true;
      RETURN;
    END IF;
    
    -- Check if warning threshold reached
    IF usage_percentage >= (warning_threshold * 100) THEN
      RETURN QUERY SELECT true, 'Budget warning threshold reached', usage_percentage, false;
      RETURN;
    END IF;
    
    -- All good
    RETURN QUERY SELECT true, NULL::TEXT, usage_percentage, false;
  END;
END;
$$;

-- Trigger to update budget tracking when notifications are sent
CREATE OR REPLACE FUNCTION trigger_update_budget_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track when status changes to 'sent'
  IF NEW.status = 'sent' AND (OLD.status != 'sent' OR OLD.status IS NULL) THEN
    -- Update budget tracking
    PERFORM update_budget_tracking(
      NEW.type,
      CASE 
        WHEN NEW.type = 'email' THEN 0  -- Email cost (usually free)
        WHEN NEW.type = 'sms' THEN 5    -- SMS cost (5 cents)
        ELSE 0
      END,
      'global',  -- For now, track globally
      NULL
    );
    
    -- Insert cost tracking record
    INSERT INTO notification_cost_tracking (
      notification_id,
      provider,
      cost_cents,
      currency,
      billing_year,
      billing_month
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.type = 'email' THEN 'smtp' ELSE 'twilio' END,
      CASE WHEN NEW.type = 'email' THEN 0 ELSE 5 END,
      'EUR',
      EXTRACT(YEAR FROM NOW()),
      EXTRACT(MONTH FROM NOW())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_budget_tracking
  AFTER UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION trigger_update_budget_tracking();