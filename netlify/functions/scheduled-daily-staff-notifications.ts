/**
 * Scheduled Daily Staff Notifications
 * Cron job that runs daily to send staff their daily schedule
 * Schedule: 0 8 * * * (every day at 8:00 AM)
 */

import { Handler } from '@netlify/functions'
import { createAdminClient } from '../src/lib/auth/netlify-auth'
import { emailService } from '../src/lib/notifications/email-service'
import { templateRenderer } from '../src/lib/notifications/template-renderer'

interface StaffMember {
  id: string
  profiles: {
    email: string
    first_name: string
    last_name: string
  }
}

interface AppointmentDetails {
  id: string
  starts_at: string
  ends_at: string
  notes: string
  customer: {
    profiles: {
      full_name: string
      phone: string
    }
  }
  services: {
    name: string
  }
}

export const handler: Handler = async (event, context) => {
  console.log('📅 Starting daily staff notifications job at', new Date().toISOString())

  try {
    const supabase = createAdminClient()

    // Get notification settings
    const emailEnabled = await getNotificationSetting(supabase, 'daily_schedule_email_enabled', 'true')
    const scheduleTime = await getNotificationSetting(supabase, 'daily_schedule_time', '08:00')

    if (emailEnabled !== 'true') {
      console.log('⏭️ Daily schedule notifications are disabled')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Daily schedule notifications disabled' })
      }
    }

    // Check if it's the right time to send (with 30-minute tolerance)
    const currentTime = new Date()
    const [targetHour, targetMinute] = scheduleTime.replace(/"/g, '').split(':').map(Number)
    const targetTime = new Date()
    targetTime.setHours(targetHour, targetMinute, 0, 0)

    const timeDiff = Math.abs(currentTime.getTime() - targetTime.getTime())
    const thirtyMinutes = 30 * 60 * 1000

    if (timeDiff > thirtyMinutes) {
      console.log(`⏰ Not the right time for daily notifications. Current: ${currentTime.toTimeString()}, Target: ${scheduleTime}`)
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not the scheduled time for daily notifications' })
      }
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayStart = today.toISOString()
    const todayEnd = tomorrow.toISOString()

    console.log(`📋 Getting schedules for ${today.toDateString()}`)

    // Get all active staff members
    const { data: staffMembers, error: staffError } = await supabase
      .from('staff')
      .select(`
        id,
        profiles!inner (
          email,
          first_name,
          last_name
        )
      `)
      .eq('is_active', true)
      .eq('profiles.is_active', true)

    if (staffError) {
      console.error('❌ Failed to fetch staff members:', staffError)
      throw staffError
    }

    if (!staffMembers || staffMembers.length === 0) {
      console.log('✅ No active staff members found')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No active staff members found' })
      }
    }

    console.log(`👥 Found ${staffMembers.length} active staff members`)

    const results = {
      total: staffMembers.length,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each staff member
    for (const staff of staffMembers as StaffMember[]) {
      try {
        // Check if schedule already sent today
        const existingNotification = await checkExistingDailyNotification(supabase, staff.id, todayStart, todayEnd)
        if (existingNotification) {
          console.log(`⏭️ Daily schedule already sent for staff ${staff.id}`)
          continue
        }

        // Get staff's appointments for today
        const { data: appointments, error: apptError } = await supabase
          .from('appointments')
          .select(`
            id,
            starts_at,
            ends_at,
            notes,
            customer:customer_id (
              profiles!inner (
                full_name,
                phone
              )
            ),
            services:service_id (
              name
            )
          `)
          .eq('staff_id', staff.id)
          .in('status', ['confirmed', 'pending'])
          .gte('starts_at', todayStart)
          .lt('starts_at', todayEnd)
          .order('starts_at', { ascending: true })

        if (apptError) {
          console.error(`❌ Failed to fetch appointments for staff ${staff.id}:`, apptError)
          results.failed++
          results.errors.push(`Staff ${staff.id}: Failed to fetch appointments`)
          continue
        }

        await sendDailyScheduleEmail(supabase, staff, appointments as AppointmentDetails[], today)
        results.sent++

      } catch (error) {
        console.error(`❌ Failed to process daily schedule for staff ${staff.id}:`, error)
        results.failed++
        results.errors.push(`Staff ${staff.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log('✅ Daily staff notifications job completed:', results)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily staff notifications processed',
        results
      })
    }

  } catch (error) {
    console.error('💥 Daily staff notifications job failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Daily staff notifications job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function getNotificationSetting(supabase: any, key: string, defaultValue: string): Promise<string> {
  const { data } = await supabase
    .from('notification_settings')
    .select('value')
    .eq('key', key)
    .eq('is_active', true)
    .single()
  
  return data?.value || defaultValue
}

async function checkExistingDailyNotification(supabase: any, staffId: string, dayStart: string, dayEnd: string): Promise<boolean> {
  const { data } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('staff_id', staffId)
    .eq('channel', 'daily_schedule')
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd)
    .limit(1)
  
  return data && data.length > 0
}

async function sendDailyScheduleEmail(
  supabase: any, 
  staff: StaffMember, 
  appointments: AppointmentDetails[], 
  date: Date
) {
  // Get email template
  const template = await getTemplate(supabase, 'email', 'daily_schedule')
  if (!template) {
    throw new Error('No email daily schedule template found')
  }

  // Create template variables
  const variables = templateRenderer.createDailyScheduleVariables({
    staff_name: `${staff.profiles.first_name} ${staff.profiles.last_name}`,
    date: date.toISOString(),
    appointments: appointments.map(apt => {
      const startTime = new Date(apt.starts_at)
      return {
        id: apt.id,
        date: apt.starts_at,
        time: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        service_name: apt.services.name,
        staff_name: '', // Not needed for this context
        customer_name: apt.customer.profiles.full_name,
        customer_phone: apt.customer.profiles.phone,
        notes: apt.notes
      }
    })
  })

  const subject = templateRenderer.render(template.subject || '', variables)
  const content = templateRenderer.render(template.content, variables)

  // Queue notification
  await supabase.rpc('create_notification', {
    p_type: 'email',
    p_channel: 'daily_schedule',
    p_recipient_email: staff.profiles.email,
    p_recipient_name: `${staff.profiles.first_name} ${staff.profiles.last_name}`,
    p_subject: subject,
    p_content: content,
    p_staff_id: staff.id,
    p_template_id: template.id,
    p_correlation_id: `daily_${staff.id}_${date.toISOString().split('T')[0]}`,
    p_scheduled_for: new Date().toISOString(),
    p_metadata: JSON.stringify({
      appointment_count: appointments.length,
      schedule_date: date.toISOString().split('T')[0]
    })
  })

  console.log(`📧 Daily schedule email queued for ${staff.profiles.email} (${appointments.length} appointments)`)
}

async function getTemplate(supabase: any, type: string, channel: string) {
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