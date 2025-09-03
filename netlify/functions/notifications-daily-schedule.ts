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
    .in('key', ['send_daily_schedule', 'email_enabled'])

  if (error) {
    throw new Error(`Failed to fetch notification settings: ${error.message}`)
  }

  const settings: Record<string, unknown> = {}
  data.forEach(item => {
    settings[item.key] = item.value
  })

  return {
    sendDailySchedule: settings.send_daily_schedule ?? true,
    emailEnabled: settings.email_enabled ?? true
  }
}

// Function to get business settings
async function getBusinessSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['business_name'])

  if (error) {
    throw new Error(`Failed to fetch business settings: ${error.message}`)
  }

  const settings: Record<string, unknown> = {}
  data.forEach(item => {
    settings[item.key] = item.value
  })

  return {
    name: settings.business_name || 'Schnittwerk Your Style'
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

    console.log('Starting daily schedule sending...')

    // Get settings
    const notificationSettings = await getNotificationSettings()
    const businessSettings = await getBusinessSettings()

    if (!notificationSettings.sendDailySchedule || !notificationSettings.emailEnabled) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            message: 'Daily schedule sending is disabled',
            timestamp: new Date().toISOString()
          }
        })
      }
    }

    // Get today's date
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Get all active staff with their profiles
    const { data: staff, error: staffError } = await supabase
      .from('staff_with_profiles')
      .select('*')
      .eq('is_active', true)

    if (staffError) {
      throw new Error(`Failed to fetch staff: ${staffError.message}`)
    }

    let schedulesScheduled = 0

    for (const staffMember of staff) {
      // Get today's appointments for this staff member
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments_with_details')
        .select(`
          id,
          customer_first_name,
          customer_last_name,
          service_name,
          service_duration_minutes,
          start_time,
          end_time,
          notes,
          status
        `)
        .eq('staff_id', staffMember.id)
        .gte('start_time', todayStart.toISOString())
        .lt('start_time', todayEnd.toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('start_time')

      if (appointmentsError) {
        console.error(`Failed to fetch appointments for staff ${staffMember.id}:`, appointmentsError)
        continue
      }

      // Prepare appointment data
      const appointmentData = appointments.map(apt => ({
        time: new Date(apt.start_time).toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        customerName: `${apt.customer_first_name || ''} ${apt.customer_last_name || ''}`.trim() || 'Unbekannt',
        serviceName: apt.service_name,
        duration: `${apt.service_duration_minutes} Min`,
        notes: apt.notes || undefined
      }))

      const firstAppointment = appointments.length > 0 
        ? new Date(appointments[0].start_time).toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : undefined

      const lastAppointment = appointments.length > 0 
        ? new Date(appointments[appointments.length - 1].end_time).toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : undefined

      const templateData = {
        staffName: `${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim() || 'Mitarbeiter',
        date: today.toLocaleDateString('de-DE'),
        appointments: appointmentData,
        totalAppointments: appointments.length,
        firstAppointment,
        lastAppointment,
        salonName: businessSettings.name
      }

      // Schedule daily schedule email if staff has email
      if (staffMember.email) {
        await NotificationQueueManager.scheduleNotification(
          'email',
          'staff_daily_schedule',
          staffMember.profile_id,
          templateData,
          new Date(), // Send immediately
          staffMember.email
        )
        schedulesScheduled++
      }
    }

    console.log(`Scheduled ${schedulesScheduled} daily schedule emails`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          staffCount: staff.length,
          schedulesScheduled,
          date: today.toLocaleDateString('de-DE'),
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Daily schedule sending error:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'DAILY_SCHEDULE_ERROR'
        }
      })
    }
  }
}