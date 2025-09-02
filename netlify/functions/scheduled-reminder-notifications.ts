/**
 * Scheduled Reminder Notifications
 * Cron job that runs every hour to send 24-hour appointment reminders
 * Schedule: 0 * * * * (every hour)
 */

import { Handler } from '@netlify/functions'
import { createAdminClient } from '../src/lib/auth/netlify-auth'
import { emailService } from '../src/lib/notifications/email-service'
import { smsService } from '../src/lib/notifications/sms-service'
import { templateRenderer } from '../src/lib/notifications/template-renderer'

interface AppointmentDetails {
  id: string
  starts_at: string
  customer_id: string
  staff_id: string
  service_id: string
  customer: {
    customer_number: string
    profiles: {
      full_name: string
      email: string
      phone: string
    }
  }
  staff: {
    profiles: {
      first_name: string
      last_name: string
    }
  }
  services: {
    name: string
  }
}

export const handler: Handler = async (event, context) => {
  console.log('🔔 Starting reminder notifications job at', new Date().toISOString())

  try {
    const supabase = createAdminClient()

    // Get notification settings
    const reminderHours = await getNotificationSetting(supabase, 'reminder_hours_before', '24')
    const emailEnabled = await getNotificationSetting(supabase, 'reminder_email_enabled', 'true')
    const smsEnabled = await getNotificationSetting(supabase, 'reminder_sms_enabled', 'false')

    if (emailEnabled !== 'true' && smsEnabled !== 'true') {
      console.log('⏭️ All reminder notifications are disabled')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Reminder notifications disabled' })
      }
    }

    // Calculate the time window for reminders
    const reminderWindow = calculateReminderWindow(parseInt(reminderHours))
    
    console.log(`🕐 Looking for appointments between ${reminderWindow.start} and ${reminderWindow.end}`)

    // Get appointments that need reminders
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        starts_at,
        customer_id,
        staff_id,
        service_id,
        customer:customer_id (
          customer_number,
          profiles!inner (
            full_name,
            email,
            phone
          )
        ),
        staff:staff_id (
          profiles!inner (
            first_name,
            last_name
          )
        ),
        services:service_id (
          name
        )
      `)
      .eq('status', 'confirmed')
      .gte('starts_at', reminderWindow.start)
      .lte('starts_at', reminderWindow.end)

    if (error) {
      console.error('❌ Failed to fetch appointments:', error)
      throw error
    }

    if (!appointments || appointments.length === 0) {
      console.log('✅ No appointments found for reminders')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No appointments found for reminders' })
      }
    }

    console.log(`📋 Found ${appointments.length} appointments for reminders`)

    // Process each appointment
    const results = {
      total: appointments.length,
      emailSent: 0,
      smsSent: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const appointment of appointments as AppointmentDetails[]) {
      try {
        // Check if reminder already sent
        const existingReminder = await checkExistingReminder(supabase, appointment.id)
        if (existingReminder) {
          console.log(`⏭️ Reminder already sent for appointment ${appointment.id}`)
          continue
        }

        const correlationId = `reminder_${appointment.id}_${Date.now()}`
        
        // Send email reminder
        if (emailEnabled === 'true' && appointment.customer.profiles.email) {
          await sendEmailReminder(supabase, appointment, correlationId)
          results.emailSent++
        }

        // Send SMS reminder
        if (smsEnabled === 'true' && appointment.customer.profiles.phone) {
          await sendSMSReminder(supabase, appointment, correlationId)
          results.smsSent++
        }

      } catch (error) {
        console.error(`❌ Failed to process reminder for appointment ${appointment.id}:`, error)
        results.failed++
        results.errors.push(`Appointment ${appointment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log('✅ Reminder notifications job completed:', results)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reminder notifications processed',
        results
      })
    }

  } catch (error) {
    console.error('💥 Reminder notifications job failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Reminder notifications job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

function calculateReminderWindow(hoursBeforeMinutes: number) {
  const now = new Date()
  const targetTime = new Date(now.getTime() + hoursBeforeMinutes * 60 * 60 * 1000)
  
  // Create a 30-minute window around the target time
  const start = new Date(targetTime.getTime() - 15 * 60 * 1000).toISOString()
  const end = new Date(targetTime.getTime() + 15 * 60 * 1000).toISOString()
  
  return { start, end }
}

async function getNotificationSetting(supabase: ReturnType<typeof createAdminClient>, key: string, defaultValue: string): Promise<string> {
  const { data } = await supabase
    .from('notification_settings')
    .select('value')
    .eq('key', key)
    .eq('is_active', true)
    .single()
  
  return data?.value || defaultValue
}

async function checkExistingReminder(supabase: ReturnType<typeof createAdminClient>, appointmentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('channel', 'reminder')
    .limit(1)
  
  return data && data.length > 0
}

async function sendEmailReminder(supabase: ReturnType<typeof createAdminClient>, appointment: AppointmentDetails, correlationId: string) {
  // Get email template
  const template = await getTemplate(supabase, 'email', 'reminder')
  if (!template) {
    throw new Error('No email reminder template found')
  }

  // Create template variables
  const appointmentDate = new Date(appointment.starts_at)
  const variables = templateRenderer.createReminderVariables({
    id: appointment.id,
    date: appointment.starts_at,
    time: appointmentDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    service_name: appointment.services.name,
    staff_name: `${appointment.staff.profiles.first_name} ${appointment.staff.profiles.last_name}`,
    customer_name: appointment.customer.profiles.full_name
  })

  const subject = templateRenderer.render(template.subject || '', variables)
  const content = templateRenderer.render(template.content, variables)

  // Queue notification
  await supabase.rpc('create_notification', {
    p_type: 'email',
    p_channel: 'reminder',
    p_recipient_email: appointment.customer.profiles.email,
    p_recipient_name: appointment.customer.profiles.full_name,
    p_subject: subject,
    p_content: content,
    p_appointment_id: appointment.id,
    p_customer_id: appointment.customer_id,
    p_template_id: template.id,
    p_correlation_id: correlationId,
    p_scheduled_for: new Date().toISOString()
  })

  console.log(`📧 Email reminder queued for ${appointment.customer.profiles.email}`)
}

async function sendSMSReminder(supabase: ReturnType<typeof createAdminClient>, appointment: AppointmentDetails, correlationId: string) {
  // Get SMS template
  const template = await getTemplate(supabase, 'sms', 'reminder')
  if (!template) {
    throw new Error('No SMS reminder template found')
  }

  // Create template variables
  const appointmentDate = new Date(appointment.starts_at)
  const variables = templateRenderer.createReminderVariables({
    id: appointment.id,
    date: appointment.starts_at,
    time: appointmentDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    service_name: appointment.services.name,
    staff_name: `${appointment.staff.profiles.first_name} ${appointment.staff.profiles.last_name}`,
    customer_name: appointment.customer.profiles.full_name
  })

  const content = templateRenderer.render(template.content, variables)

  // Queue notification
  await supabase.rpc('create_notification', {
    p_type: 'sms',
    p_channel: 'reminder',
    p_recipient_phone: appointment.customer.profiles.phone,
    p_recipient_name: appointment.customer.profiles.full_name,
    p_content: content,
    p_appointment_id: appointment.id,
    p_customer_id: appointment.customer_id,
    p_template_id: template.id,
    p_correlation_id: correlationId,
    p_scheduled_for: new Date().toISOString()
  })

  console.log(`📱 SMS reminder queued for ${appointment.customer.profiles.phone}`)
}

async function getTemplate(supabase: ReturnType<typeof createAdminClient>, type: string, channel: string) {
  const { data } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('type', type)
    .eq('channel', channel)
    .eq('is_active', true)
    .eq('is_default', true)
    .single()
  
  return data
}