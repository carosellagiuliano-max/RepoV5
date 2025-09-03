import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { NotificationQueueManager } from '../../src/lib/notifications/notification-queue'

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

// Function to get notification settings
async function getNotificationSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['reminder_hours_before', 'email_enabled', 'sms_enabled'])

  if (error) {
    throw new Error(`Failed to fetch notification settings: ${error.message}`)
  }

  const settings: Record<string, unknown> = {}
  data.forEach(item => {
    settings[item.key] = item.value
  })

  return {
    reminderHoursBefore: settings.reminder_hours_before ?? 24,
    emailEnabled: settings.email_enabled ?? true,
    smsEnabled: settings.sms_enabled ?? false
  }
}

// Function to get business settings
async function getBusinessSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['business_name', 'business_address', 'business_phone'])

  if (error) {
    throw new Error(`Failed to fetch business settings: ${error.message}`)
  }

  const settings: Record<string, unknown> = {}
  data.forEach(item => {
    settings[item.key] = item.value
  })

  return {
    name: settings.business_name || 'Schnittwerk Your Style',
    address: settings.business_address || '',
    phone: settings.business_phone || ''
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

    console.log('Starting appointment reminder scheduling...')

    // Get settings
    const notificationSettings = await getNotificationSettings()
    const businessSettings = await getBusinessSettings()

    // Calculate reminder window
    const now = new Date()
    const reminderWindowStart = new Date(now.getTime() + notificationSettings.reminderHoursBefore * 60 * 60 * 1000)
    const reminderWindowEnd = new Date(reminderWindowStart.getTime() + 60 * 60 * 1000) // 1 hour window

    // Get appointments that need reminders
    const { data: appointments, error } = await supabase
      .from('appointments_with_details')
      .select(`
        id,
        customer_id,
        customer_email,
        customer_first_name,
        customer_last_name,
        staff_first_name,
        staff_last_name,
        service_name,
        service_duration_minutes,
        service_price_cents,
        start_time,
        end_time,
        status
      `)
      .eq('status', 'confirmed')
      .gte('start_time', reminderWindowStart.toISOString())
      .lt('start_time', reminderWindowEnd.toISOString())

    if (error) {
      throw new Error(`Failed to fetch appointments: ${error.message}`)
    }

    let emailReminders = 0
    const smsReminders = 0

    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.start_time).toLocaleDateString('de-DE')
      const appointmentTime = new Date(appointment.start_time).toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })

      const templateData = {
        customerName: `${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}`.trim(),
        appointmentDate,
        appointmentTime,
        serviceName: appointment.service_name,
        staffName: `${appointment.staff_first_name || ''} ${appointment.staff_last_name || ''}`.trim(),
        salonName: businessSettings.name,
        salonPhone: businessSettings.phone,
        salonAddress: businessSettings.address,
        appointmentId: appointment.id
      }

      // Schedule email reminder
      if (notificationSettings.emailEnabled && appointment.customer_email) {
        await NotificationQueueManager.scheduleNotification(
          'email',
          'appointment_reminder',
          appointment.customer_id,
          templateData,
          now, // Send immediately
          appointment.customer_email
        )
        emailReminders++
      }

      // Note: SMS reminders would need customer phone data from profiles table
      // For now, we'll skip SMS reminders as the appointments view doesn't include phone
    }

    console.log(`Scheduled ${emailReminders} email reminders and ${smsReminders} SMS reminders`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          appointmentsFound: appointments.length,
          emailReminders,
          smsReminders,
          reminderWindow: {
            start: reminderWindowStart.toISOString(),
            end: reminderWindowEnd.toISOString()
          },
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Appointment reminder scheduling error:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'REMINDER_SCHEDULING_ERROR'
        }
      })
    }
  }
}