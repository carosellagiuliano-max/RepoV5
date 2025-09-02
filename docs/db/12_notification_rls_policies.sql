-- Notification System RLS Policies
-- Controls access to notification tables

-- Enable RLS on all notification tables
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_audit_log ENABLE ROW LEVEL SECURITY;

-- NOTIFICATION_SETTINGS Policies
-- Only admins can manage notification settings
CREATE POLICY "Admins can manage notification settings"
ON notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- NOTIFICATION_TEMPLATES Policies
-- Only admins can manage notification templates
CREATE POLICY "Admins can manage notification templates"
ON notification_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- NOTIFICATION_QUEUE Policies
-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON notification_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications"
ON notification_queue
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- System can insert notifications (for scheduled functions)
-- This policy allows the service role to insert notifications
CREATE POLICY "System can create notifications"
ON notification_queue
FOR INSERT
TO service_role
WITH CHECK (true);

-- System can update notification status (for scheduled functions)
CREATE POLICY "System can update notification status"
ON notification_queue
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Staff can view notifications related to them
CREATE POLICY "Staff can view their notifications"
ON notification_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN staff s ON s.profile_id = p.id
    WHERE p.id = auth.uid() 
    AND p.role = 'staff'
    AND p.is_active = true
    AND s.id = notification_queue.staff_id
  )
);

-- Customers can view notifications sent to them
CREATE POLICY "Customers can view their notifications"
ON notification_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN customers c ON c.profile_id = p.id
    WHERE p.id = auth.uid() 
    AND p.role = 'customer'
    AND c.id = notification_queue.customer_id
  )
);

-- NOTIFICATION_AUDIT_LOG Policies
-- Admins can view all audit logs
CREATE POLICY "Admins can view notification audit logs"
ON notification_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- System can insert audit log entries
CREATE POLICY "System can create audit log entries"
ON notification_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Admins can insert audit log entries (for manual actions)
CREATE POLICY "Admins can create audit log entries"
ON notification_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.is_active = true
  )
);

-- Staff can view audit logs for their notifications
CREATE POLICY "Staff can view their notification audit logs"
ON notification_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN staff s ON s.profile_id = p.id
    JOIN notification_queue nq ON nq.id = notification_audit_log.notification_id
    WHERE p.id = auth.uid() 
    AND p.role = 'staff'
    AND p.is_active = true
    AND s.id = nq.staff_id
  )
);

-- Customers can view audit logs for their notifications
CREATE POLICY "Customers can view their notification audit logs"
ON notification_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN customers c ON c.profile_id = p.id
    JOIN notification_queue nq ON nq.id = notification_audit_log.notification_id
    WHERE p.id = auth.uid() 
    AND p.role = 'customer'
    AND c.id = nq.customer_id
  )
);

-- Create notification helper functions
CREATE OR REPLACE FUNCTION get_notification_setting(setting_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value::text INTO setting_value
  FROM notification_settings
  WHERE key = setting_key AND is_active = true;
  
  RETURN setting_value;
END;
$$;

CREATE OR REPLACE FUNCTION get_active_template(template_type TEXT, template_channel TEXT)
RETURNS notification_templates
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template notification_templates;
BEGIN
  -- Try to get default template first
  SELECT * INTO template
  FROM notification_templates
  WHERE type = template_type 
  AND channel = template_channel 
  AND is_default = true 
  AND is_active = true
  LIMIT 1;
  
  -- If no default template, get any active template
  IF template IS NULL THEN
    SELECT * INTO template
    FROM notification_templates
    WHERE type = template_type 
    AND channel = template_channel 
    AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN template;
END;
$$;

-- Function to create notification queue entry
CREATE OR REPLACE FUNCTION create_notification(
  p_type TEXT,
  p_channel TEXT,
  p_recipient_email TEXT DEFAULT NULL,
  p_recipient_phone TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  p_template_id UUID DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
  template notification_templates;
BEGIN
  -- Get template if not provided content
  IF p_content IS NULL AND p_template_id IS NOT NULL THEN
    SELECT * INTO template FROM notification_templates WHERE id = p_template_id;
  ELSIF p_content IS NULL THEN
    SELECT * INTO template FROM get_active_template(p_type, p_channel);
  END IF;
  
  -- Insert notification
  INSERT INTO notification_queue (
    type, channel, recipient_email, recipient_phone, recipient_name,
    subject, content, appointment_id, customer_id, staff_id,
    scheduled_for, template_id, correlation_id, metadata
  ) VALUES (
    p_type, p_channel, p_recipient_email, p_recipient_phone, p_recipient_name,
    COALESCE(p_subject, template.subject), COALESCE(p_content, template.content),
    p_appointment_id, p_customer_id, p_staff_id,
    p_scheduled_for, COALESCE(p_template_id, template.id), p_correlation_id, p_metadata
  )
  RETURNING id INTO notification_id;
  
  -- Log creation
  INSERT INTO notification_audit_log (
    notification_id, action, status_after, performed_by
  ) VALUES (
    notification_id, 'created', 'pending', auth.uid()
  );
  
  RETURN notification_id;
END;
$$;

-- Function to update notification status
CREATE OR REPLACE FUNCTION update_notification_status(
  p_notification_id UUID,
  p_new_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_delivery_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_status TEXT;
  success BOOLEAN := FALSE;
BEGIN
  -- Get current status
  SELECT status INTO old_status FROM notification_queue WHERE id = p_notification_id;
  
  IF old_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update notification
  UPDATE notification_queue 
  SET 
    status = p_new_status,
    error_message = p_error_message,
    error_details = p_error_details,
    sent_at = CASE WHEN p_new_status = 'sent' THEN NOW() ELSE sent_at END,
    retry_count = CASE WHEN p_new_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
    updated_at = NOW()
  WHERE id = p_notification_id;
  
  -- Log status change
  INSERT INTO notification_audit_log (
    notification_id, action, status_before, status_after, 
    error_message, delivery_details, performed_by
  ) VALUES (
    p_notification_id, 
    CASE 
      WHEN p_new_status = 'sent' THEN 'sent'
      WHEN p_new_status = 'failed' THEN 'failed'
      WHEN p_new_status = 'cancelled' THEN 'cancelled'
      ELSE 'retried'
    END,
    old_status, p_new_status, p_error_message, p_delivery_details, auth.uid()
  );
  
  success := TRUE;
  RETURN success;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_notification_setting(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_active_template(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, TIMESTAMPTZ, UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_notification_status(UUID, TEXT, TEXT, JSONB, JSONB) TO authenticated, service_role;