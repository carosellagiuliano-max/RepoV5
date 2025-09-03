import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { z } from 'zod'
import { NotificationService } from '../../src/lib/notifications/notification-service'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const cronSecret = process.env.NETLIFY_CRON_SECRET!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

if (!cronSecret) {
  throw new Error('Missing NETLIFY_CRON_SECRET environment variable')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string
  queryStringParameters?: Record<string, string>
}

// Function to get settings from the database
async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 
      'smtp_from_email', 'smtp_from_name', 'smtp_use_tls',
      'email_enabled', 'sms_enabled', 'reminder_hours_before',
      'send_confirmations', 'send_cancellations', 'send_daily_schedule',
      'daily_schedule_time', 'retry_attempts', 'retry_delay_minutes',
      'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'
    ])

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`)
  }

  const settings: Record<string, unknown> = {}
  data.forEach(item => {
    settings[item.key] = item.value
  })

  return {
    emailSettings: {
      smtp_host: settings.smtp_host || process.env.SMTP_HOST || '',
      smtp_port: settings.smtp_port || parseInt(process.env.SMTP_PORT || '587'),
      smtp_username: settings.smtp_username || process.env.SMTP_USERNAME || '',
      smtp_password: settings.smtp_password || process.env.SMTP_PASSWORD || '',
      smtp_from_email: settings.smtp_from_email || process.env.SMTP_FROM_EMAIL || '',
      smtp_from_name: settings.smtp_from_name || process.env.SMTP_FROM_NAME || '',
      smtp_use_tls: settings.smtp_use_tls ?? (process.env.SMTP_USE_TLS === 'true')
    },
    notificationSettings: {
      email_enabled: settings.email_enabled ?? true,
      sms_enabled: settings.sms_enabled ?? false,
      reminder_hours_before: settings.reminder_hours_before ?? 24,
      send_confirmations: settings.send_confirmations ?? true,
      send_cancellations: settings.send_cancellations ?? true,
      send_daily_schedule: settings.send_daily_schedule ?? true,
      daily_schedule_time: settings.daily_schedule_time ?? '08:00',
      retry_attempts: settings.retry_attempts ?? 3,
      retry_delay_minutes: settings.retry_delay_minutes ?? 15
    },
    smsSettings: {
      twilio_account_sid: settings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '',
      twilio_auth_token: settings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '',
      twilio_phone_number: settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || '',
      enabled: settings.sms_enabled ?? false
    }
  }
}

export const handler = async (event: NetlifyEvent, context: Context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Verify cron secret for security
    const authHeader = event.headers.authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      }
    }

    console.log('Starting notification processing...')

    // Get settings
    const { emailSettings, notificationSettings, smsSettings } = await getSettings()

    // Initialize notification service
    const notificationService = new NotificationService()
    await notificationService.initialize(emailSettings, smsSettings, notificationSettings)

    // Process pending notifications
    const result = await notificationService.processPendingNotifications(100)

    console.log('Notification processing completed:', result)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Notification processing error:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'NOTIFICATION_PROCESSING_ERROR'
        }
      })
    }
  }
}