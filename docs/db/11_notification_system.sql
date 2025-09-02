-- Notification System Tables
-- Creates tables for managing email/SMS notifications

-- Create notification_settings table for admin configuration
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

-- Create notification_templates table for email/SMS templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  channel TEXT NOT NULL CHECK (channel IN ('reminder', 'cancellation', 'rescheduling', 'daily_schedule')),
  subject TEXT, -- Only for email templates
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- Available template variables
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  
  -- Ensure only one default template per type+channel combination
  CONSTRAINT unique_default_template UNIQUE (type, channel, is_default) 
  DEFERRABLE INITIALLY DEFERRED
);

-- Create notification_queue table for managing notification delivery
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  channel TEXT NOT NULL CHECK (channel IN ('reminder', 'cancellation', 'rescheduling', 'daily_schedule')),
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  subject TEXT, -- Only for email
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  
  -- Related entities
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  template_id UUID REFERENCES notification_templates(id),
  correlation_id TEXT, -- For tracking related notifications
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT notification_queue_recipient_check 
    CHECK (
      (type = 'email' AND recipient_email IS NOT NULL) OR 
      (type = 'sms' AND recipient_phone IS NOT NULL)
    )
);

-- Create notification_audit_log table for tracking delivery
CREATE TABLE notification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'sent', 'failed', 'cancelled', 'retried')),
  status_before TEXT,
  status_after TEXT NOT NULL,
  error_message TEXT,
  delivery_details JSONB,
  performed_by UUID REFERENCES profiles(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_notification_settings_key ON notification_settings(key);
CREATE INDEX idx_notification_settings_category ON notification_settings(category);
CREATE INDEX idx_notification_settings_active ON notification_settings(is_active);

CREATE INDEX idx_notification_templates_type_channel ON notification_templates(type, channel);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);
CREATE INDEX idx_notification_templates_default ON notification_templates(is_default);

CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_type_channel ON notification_queue(type, channel);
CREATE INDEX idx_notification_queue_appointment_id ON notification_queue(appointment_id);
CREATE INDEX idx_notification_queue_customer_id ON notification_queue(customer_id);
CREATE INDEX idx_notification_queue_staff_id ON notification_queue(staff_id);
CREATE INDEX idx_notification_queue_correlation_id ON notification_queue(correlation_id);

CREATE INDEX idx_notification_audit_log_notification_id ON notification_audit_log(notification_id);
CREATE INDEX idx_notification_audit_log_created_at ON notification_audit_log(created_at);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_settings_updated_at 
  BEFORE UPDATE ON notification_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at 
  BEFORE UPDATE ON notification_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_queue_updated_at 
  BEFORE UPDATE ON notification_queue 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification settings
INSERT INTO notification_settings (key, value, category, description) VALUES
('reminder_email_enabled', 'true', 'email', 'Enable email reminders for appointments'),
('reminder_sms_enabled', 'false', 'sms', 'Enable SMS reminders for appointments'),
('reminder_hours_before', '24', 'timing', 'Hours before appointment to send reminder'),
('cancellation_email_enabled', 'true', 'email', 'Enable email notifications for cancellations'),
('cancellation_sms_enabled', 'false', 'sms', 'Enable SMS notifications for cancellations'),
('daily_schedule_email_enabled', 'true', 'email', 'Enable daily schedule emails for staff'),
('daily_schedule_time', '"08:00"', 'timing', 'Time to send daily schedule (HH:MM format)'),
('max_retry_attempts', '3', 'delivery', 'Maximum retry attempts for failed notifications'),
('retry_delay_minutes', '15', 'delivery', 'Minutes to wait between retry attempts');

-- Insert default email templates
INSERT INTO notification_templates (name, type, channel, subject, content, variables, is_default) VALUES
('default_reminder_email', 'email', 'reminder', 
'Erinnerung an Ihren Termin bei {{business_name}}',
'Hallo {{customer_name}},

dies ist eine freundliche Erinnerung an Ihren Termin:

📅 Datum: {{appointment_date}}
🕐 Uhrzeit: {{appointment_time}}
💇 Service: {{service_name}}
👤 Friseur/in: {{staff_name}}

Wir freuen uns auf Ihren Besuch!

Bei Fragen oder Änderungen kontaktieren Sie uns unter:
📞 {{business_phone}}
📧 {{business_email}}

Mit freundlichen Grüßen
Ihr {{business_name}} Team

---
{{business_address}}',
'["customer_name", "appointment_date", "appointment_time", "service_name", "staff_name", "business_name", "business_phone", "business_email", "business_address"]',
true),

('default_cancellation_email', 'email', 'cancellation',
'Terminabsage - {{business_name}}',
'Hallo {{customer_name}},

Ihr Termin wurde erfolgreich storniert:

📅 Datum: {{appointment_date}}
🕐 Uhrzeit: {{appointment_time}}
💇 Service: {{service_name}}

{{#cancellation_reason}}
Grund: {{cancellation_reason}}
{{/cancellation_reason}}

Sie können jederzeit einen neuen Termin vereinbaren:
📞 {{business_phone}}
🌐 {{website_url}}

Mit freundlichen Grüßen
Ihr {{business_name}} Team',
'["customer_name", "appointment_date", "appointment_time", "service_name", "cancellation_reason", "business_name", "business_phone", "website_url"]',
true),

('default_daily_schedule_email', 'email', 'daily_schedule',
'Tagesplan für {{date}} - {{business_name}}',
'Hallo {{staff_name}},

hier ist Ihr Tagesplan für {{date}}:

{{#appointments}}
🕐 {{time}} - {{service_name}}
👤 Kunde: {{customer_name}}
{{#customer_phone}}📞 {{customer_phone}}{{/customer_phone}}
{{#notes}}💭 Notizen: {{notes}}{{/notes}}

{{/appointments}}

{{^appointments}}
Heute haben Sie keine Termine geplant.
{{/appointments}}

Einen schönen Tag wünscht
Ihr {{business_name}} Team',
'["staff_name", "date", "appointments", "business_name"]',
true);

-- Insert default SMS templates
INSERT INTO notification_templates (name, type, channel, content, variables, is_default) VALUES
('default_reminder_sms', 'sms', 'reminder',
'Erinnerung: Termin am {{appointment_date}} um {{appointment_time}} bei {{business_name}}. Service: {{service_name}}. Bei Fragen: {{business_phone}}',
'["appointment_date", "appointment_time", "business_name", "service_name", "business_phone"]',
true),

('default_cancellation_sms', 'sms', 'cancellation',
'Ihr Termin am {{appointment_date}} um {{appointment_time}} bei {{business_name}} wurde storniert. Neuen Termin vereinbaren: {{business_phone}}',
'["appointment_date", "appointment_time", "business_name", "business_phone"]',
true);

-- Grant permissions (will be handled by RLS policies)
-- Tables are ready for RLS policies in next migration file