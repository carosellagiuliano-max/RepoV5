# Notifications System Implementation

## Overview

The notification system provides automated email and SMS notifications for the hair salon booking system. It includes appointment reminders, confirmations, cancellations, and daily staff schedules.

## Architecture

### Core Components

1. **NotificationService** - Main service for sending emails and SMS
2. **NotificationQueueManager** - Manages notification queue and delivery tracking
3. **NotificationTemplateManager** - Handles template rendering and management
4. **Scheduled Functions** - Netlify Functions triggered by cron for automated notifications

### Database Schema

The system adds three new tables to the existing database:

#### notification_queue
- `id` - Unique notification ID
- `type` - 'email' or 'sms'
- `channel` - Type of notification (reminder, confirmation, etc.)
- `recipient_id` - Reference to user
- `recipient_email` - Email address (for email notifications)
- `recipient_phone` - Phone number (for SMS notifications)
- `template_name` - Template identifier
- `template_data` - JSON data for template rendering
- `scheduled_for` - When to send the notification
- `status` - Current status (pending, sending, sent, failed, cancelled)
- `attempts` - Number of send attempts
- `max_attempts` - Maximum retry attempts
- `error_message` - Last error message
- Timestamps for tracking

#### notification_audit
- `id` - Audit entry ID
- `notification_id` - Reference to notification
- `event_type` - Type of event (queued, sent, failed, etc.)
- `details` - Additional event details
- `created_at` - Timestamp

#### notification_templates
- `id` - Template ID
- `name` - Template name
- `type` - 'email' or 'sms'
- `channel` - Notification channel
- `subject_template` - Email subject template
- `body_template` - Message body template
- `variables` - Required template variables
- `is_active` - Template status
- `is_default` - Whether this is the default template

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Email Configuration (existing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@salon.de
SMTP_FROM_NAME=Schnittwerk Your Style
SMTP_USE_TLS=true

# SMS Configuration (optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Notification Settings
VITE_NOTIFICATIONS_EMAIL_ENABLED=true
VITE_NOTIFICATIONS_SMS_ENABLED=false
VITE_NOTIFICATIONS_REMINDER_HOURS=24
VITE_NOTIFICATIONS_SEND_CONFIRMATIONS=true
VITE_NOTIFICATIONS_SEND_CANCELLATIONS=true
VITE_NOTIFICATIONS_SEND_DAILY_SCHEDULE=true
VITE_NOTIFICATIONS_DAILY_SCHEDULE_TIME=08:00
VITE_NOTIFICATIONS_RETRY_ATTEMPTS=3
VITE_NOTIFICATIONS_RETRY_DELAY_MINUTES=15

# Cron Security
NETLIFY_CRON_SECRET=your_secret_key_for_cron_functions_here_min_32_chars
```

### Database Setup

Run these SQL commands to create the required tables:

```sql
-- Create notification_queue table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  channel TEXT NOT NULL CHECK (channel IN (
    'appointment_reminder', 
    'appointment_confirmation', 
    'appointment_cancellation', 
    'appointment_reschedule', 
    'staff_daily_schedule'
  )),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  template_name TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sending', 'sent', 'failed', 'cancelled'
  )),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_audit table
CREATE TABLE notification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'queued', 'sent', 'failed', 'cancelled', 'retry'
  )),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_templates table
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  channel TEXT NOT NULL CHECK (channel IN (
    'appointment_reminder', 
    'appointment_confirmation', 
    'appointment_cancellation', 
    'appointment_reschedule', 
    'staff_daily_schedule'
  )),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_id);
CREATE INDEX idx_notification_audit_notification_id ON notification_audit(notification_id);
CREATE INDEX idx_notification_templates_channel_type ON notification_templates(channel, type);

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin and staff can manage notifications)
CREATE POLICY "Admin can manage all notifications" ON notification_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin can view audit logs" ON notification_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin can manage templates" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );
```

## Scheduled Functions Setup

### Netlify Functions

The system includes three scheduled functions:

1. **notifications-process** - Processes pending notifications
2. **notifications-schedule-reminders** - Schedules appointment reminders
3. **notifications-daily-schedule** - Sends daily schedules to staff

### Cron Configuration

Add these cron triggers to your `netlify.toml`:

```toml
[functions]
  # Directory for functions
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-functions"

[build.environment]
  # Notification settings
  NOTIFICATIONS_ENABLED = "true"

# Scheduled functions
[[functions."notifications-process"]]
  schedule = "*/5 * * * *"  # Every 5 minutes
  
[[functions."notifications-schedule-reminders"]]
  schedule = "0 */1 * * *"  # Every hour
  
[[functions."notifications-daily-schedule"]]
  schedule = "0 8 * * *"    # Every day at 8 AM
```

To trigger functions manually during development:

```bash
# Process pending notifications
curl -X POST https://your-site.netlify.app/.netlify/functions/notifications-process \
  -H "Authorization: Bearer your_cron_secret"

# Schedule reminders
curl -X POST https://your-site.netlify.app/.netlify/functions/notifications-schedule-reminders \
  -H "Authorization: Bearer your_cron_secret"

# Send daily schedules
curl -X POST https://your-site.netlify.app/.netlify/functions/notifications-daily-schedule \
  -H "Authorization: Bearer your_cron_secret"
```

## Usage

### Admin Interface

Navigate to `/admin/notifications` to configure:

- Email SMTP settings
- SMS Twilio settings  
- Notification preferences
- Template management
- Send test emails

### Automatic Notifications

The system automatically handles:

1. **Appointment Confirmations** - Sent immediately when booking is created
2. **Appointment Reminders** - Sent 24 hours before appointment (configurable)
3. **Cancellation Notifications** - Sent when appointments are cancelled
4. **Reschedule Notifications** - Sent when appointments are moved
5. **Daily Staff Schedules** - Sent to staff every morning with their daily appointments

### Programmatic Usage

```typescript
import { NotificationService } from '../lib/notifications'

// Initialize service
const notificationService = new NotificationService()
await notificationService.initialize(emailSettings, smsSettings, notificationSettings)

// Schedule appointment reminder
await notificationService.scheduleAppointmentReminder(
  appointmentId,
  customerId,
  customerEmail,
  customerPhone,
  appointmentData,
  reminderTime
)

// Send confirmation
await notificationService.sendAppointmentConfirmation(
  appointmentId,
  customerId,
  customerEmail,
  customerPhone,
  appointmentData
)
```

## Templates

### Template Variables

Templates support these variables based on notification type:

#### Appointment Notifications
- `customerName` - Customer's full name
- `appointmentDate` - Formatted appointment date
- `appointmentTime` - Formatted appointment time
- `serviceName` - Name of the service
- `staffName` - Staff member's name
- `salonName` - Business name
- `salonPhone` - Business phone
- `salonAddress` - Business address
- `appointmentId` - Unique appointment ID
- `totalPrice` - Price (confirmations only)
- `cancellationReason` - Reason (cancellations only)

#### Staff Daily Schedule
- `staffName` - Staff member's name
- `date` - Date for the schedule
- `appointments` - Array of appointments
- `totalAppointments` - Count of appointments
- `firstAppointment` - Time of first appointment
- `lastAppointment` - Time of last appointment
- `salonName` - Business name

### Template Syntax

Templates use a simple syntax:

```
{{variable}} - Simple variable replacement
{{#if variable}}content{{/if}} - Conditional content
{{#each array}}{{property}}{{/each}} - Loop through arrays
```

Example:
```html
<h2>Hello {{customerName}},</h2>
<p>Your {{serviceName}} appointment is scheduled for {{appointmentDate}} at {{appointmentTime}}.</p>
{{#if notes}}<p>Notes: {{notes}}</p>{{/if}}
```

## Testing

Run the notification system tests:

```bash
# Template engine tests
npm test src/test/notification-templates.test.ts

# Queue management tests
npm test src/test/notification-queue.test.ts
```

## Monitoring

### Admin Dashboard

The admin interface provides:
- Notification statistics
- Failed notification reports
- Queue status monitoring
- Template management

### Audit Trail

All notification events are logged in the `notification_audit` table for tracking and debugging.

### Error Handling

The system includes:
- Automatic retry logic for failed notifications
- Exponential backoff for rate limiting
- Comprehensive error logging
- Dead letter queue for permanently failed notifications

## Security

- All scheduled functions require authentication via `NETLIFY_CRON_SECRET`
- Database access controlled by RLS policies
- Email credentials encrypted in environment variables
- SMS tokens stored securely

## Performance

- Batch processing of notifications
- Queue-based delivery system
- Automatic cleanup of old notifications
- Indexed database queries for fast lookups