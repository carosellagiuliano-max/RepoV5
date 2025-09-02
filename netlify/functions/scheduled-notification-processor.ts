/**
 * Notification Processor
 * Processes queued notifications and sends them via email/SMS
 * Schedule: */5 * * * * (every 5 minutes)
 */

import { Handler } from '@netlify/functions'
import { createAdminClient } from '../src/lib/auth/netlify-auth'
import { emailService } from '../src/lib/notifications/email-service'
import { smsService } from '../src/lib/notifications/sms-service'

interface QueuedNotification {
  id: string
  type: 'email' | 'sms'
  channel: string
  recipient_email?: string
  recipient_phone?: string
  recipient_name?: string
  subject?: string
  content: string
  retry_count: number
  max_retries: number
  correlation_id?: string
}

export const handler: Handler = async (event, context) => {
  console.log('🚀 Starting notification processor at', new Date().toISOString())

  try {
    const supabase = createAdminClient()

    // Get pending notifications that are ready to be sent
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50) // Process in batches

    if (error) {
      console.error('❌ Failed to fetch pending notifications:', error)
      throw error
    }

    if (!notifications || notifications.length === 0) {
      console.log('✅ No pending notifications to process')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending notifications' })
      }
    }

    console.log(`📋 Found ${notifications.length} pending notifications`)

    const results = {
      total: notifications.length,
      emailSent: 0,
      smsSent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each notification
    for (const notification of notifications as QueuedNotification[]) {
      try {
        // Mark as processing
        await updateNotificationStatus(supabase, notification.id, 'processing')

        if (notification.type === 'email') {
          await processEmailNotification(supabase, notification)
          results.emailSent++
        } else if (notification.type === 'sms') {
          await processSMSNotification(supabase, notification)
          results.smsSent++
        }

      } catch (error) {
        console.error(`❌ Failed to process notification ${notification.id}:`, error)
        results.failed++
        results.errors.push(`${notification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        await handleNotificationFailure(supabase, notification, error)
      }
    }

    console.log('✅ Notification processor completed:', results)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Notifications processed',
        results
      })
    }

  } catch (error) {
    console.error('💥 Notification processor failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Notification processor failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function processEmailNotification(supabase: any, notification: QueuedNotification) {
  if (!notification.recipient_email) {
    throw new Error('No recipient email provided')
  }

  const result = await emailService.sendEmail({
    to: notification.recipient_email,
    subject: notification.subject || 'Notification',
    html: notification.content,
    fromName: process.env.VITE_SMTP_FROM_NAME || 'Salon'
  })

  if (result.success) {
    await supabase.rpc('update_notification_status', {
      p_notification_id: notification.id,
      p_new_status: 'sent',
      p_delivery_details: JSON.stringify({
        messageId: result.messageId,
        provider: 'smtp',
        sentAt: new Date().toISOString()
      })
    })

    console.log(`📧 Email sent successfully to ${notification.recipient_email} (${result.messageId})`)
  } else {
    throw new Error(result.error || 'Email sending failed')
  }
}

async function processSMSNotification(supabase: any, notification: QueuedNotification) {
  if (!notification.recipient_phone) {
    throw new Error('No recipient phone provided')
  }

  if (!smsService.isConfigured()) {
    throw new Error('SMS service not configured')
  }

  const formattedPhone = smsService.formatPhoneNumber(notification.recipient_phone)
  
  const result = await smsService.sendSMS({
    to: formattedPhone,
    message: notification.content
  })

  if (result.success) {
    await supabase.rpc('update_notification_status', {
      p_notification_id: notification.id,
      p_new_status: 'sent',
      p_delivery_details: JSON.stringify({
        messageId: result.messageId,
        provider: 'twilio',
        sentAt: new Date().toISOString(),
        phoneNumber: formattedPhone
      })
    })

    console.log(`📱 SMS sent successfully to ${formattedPhone} (${result.messageId})`)
  } else {
    throw new Error(result.error || 'SMS sending failed')
  }
}

async function updateNotificationStatus(supabase: any, notificationId: string, status: string) {
  const { error } = await supabase
    .from('notification_queue')
    .update({ status })
    .eq('id', notificationId)

  if (error) {
    console.error(`Failed to update notification ${notificationId} status to ${status}:`, error)
  }
}

async function handleNotificationFailure(supabase: any, notification: QueuedNotification, error: any) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const canRetry = notification.retry_count < notification.max_retries

  if (canRetry) {
    // Schedule retry with exponential backoff
    const retryDelayMinutes = Math.pow(2, notification.retry_count) * 5 // 5, 10, 20 minutes
    const retryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000)

    await supabase
      .from('notification_queue')
      .update({
        status: 'pending',
        scheduled_for: retryAt.toISOString(),
        retry_count: notification.retry_count + 1,
        error_message: errorMessage,
        error_details: JSON.stringify({
          error: errorMessage,
          retryCount: notification.retry_count + 1,
          retryScheduledFor: retryAt.toISOString(),
          lastAttempt: new Date().toISOString()
        })
      })
      .eq('id', notification.id)

    console.log(`🔄 Notification ${notification.id} scheduled for retry ${notification.retry_count + 1} at ${retryAt.toISOString()}`)
  } else {
    // Mark as failed
    await supabase.rpc('update_notification_status', {
      p_notification_id: notification.id,
      p_new_status: 'failed',
      p_error_message: errorMessage,
      p_error_details: JSON.stringify({
        error: errorMessage,
        maxRetriesReached: true,
        finalAttempt: new Date().toISOString(),
        totalRetries: notification.retry_count
      })
    })

    console.log(`❌ Notification ${notification.id} marked as failed after ${notification.retry_count} retries`)
  }
}