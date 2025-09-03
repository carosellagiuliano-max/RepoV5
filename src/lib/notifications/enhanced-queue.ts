import { createClient } from '@supabase/supabase-js'
import { NotificationQueueManager } from './notification-queue'
import { NotificationConsentService } from './consent-service'
import { 
  NotificationChannel,
  NotificationType,
  NotificationQueue
} from '../types/database'
import { DedupeConfig, NotificationSettings } from './consent-types'

/**
 * Enhanced notification queue manager with consent, deduplication, and timing features
 */
export class EnhancedNotificationQueue extends NotificationQueueManager {
  private consentService: NotificationConsentService
  private settings: NotificationSettings

  constructor(
    supabaseUrl: string, 
    supabaseServiceKey: string,
    settings: NotificationSettings
  ) {
    super()
    this.consentService = new NotificationConsentService(supabaseUrl, supabaseServiceKey)
    this.settings = settings
  }

  /**
   * Schedule notification with consent checking, deduplication, and quiet hours
   */
  async scheduleNotificationSmart(
    type: NotificationType,
    channel: NotificationChannel,
    recipientId: string,
    templateData: Record<string, unknown>,
    scheduledFor: Date,
    recipientEmail?: string,
    recipientPhone?: string,
    dedupeConfig?: DedupeConfig
  ): Promise<{ id?: string; skipped?: boolean; reason?: string; delayedUntil?: Date }> {
    
    // Step 1: Check consent and suppression
    const consentType = this.getConsentTypeFromChannel(channel)
    const shouldSend = await this.consentService.shouldSendNotification(
      recipientId,
      recipientEmail,
      recipientPhone,
      type as 'email' | 'sms',
      consentType
    )

    if (!shouldSend.canSend) {
      return {
        skipped: true,
        reason: shouldSend.reason
      }
    }

    // Step 2: Check for duplicates
    if (dedupeConfig) {
      const dedupeKey = this.consentService.generateDedupeKey(dedupeConfig)
      const isDuplicate = await this.checkDuplicate(dedupeKey)
      
      if (isDuplicate) {
        return {
          skipped: true,
          reason: 'Duplicate notification detected'
        }
      }
    }

    // Step 3: Check quiet hours and timezone
    const timeCheck = await this.shouldSendAtTime(
      scheduledFor,
      this.settings.timezone,
      this.settings.quietHoursStart,
      this.settings.quietHoursEnd
    )

    if (!timeCheck.shouldSend && timeCheck.delayUntil) {
      scheduledFor = timeCheck.delayUntil
    }

    // Step 4: Check short window policy
    const now = new Date()
    const hoursUntilAppointment = (scheduledFor.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilAppointment < this.settings.shortWindowThresholdHours) {
      if (this.settings.shortWindowPolicy === 'skip') {
        return {
          skipped: true,
          reason: `Appointment too soon (${hoursUntilAppointment.toFixed(1)}h < ${this.settings.shortWindowThresholdHours}h threshold)`
        }
      }
    }

    // Step 5: Schedule the notification
    try {
      const id = await this.scheduleNotification(
        type,
        channel,
        recipientId,
        templateData,
        scheduledFor,
        recipientEmail,
        recipientPhone
      )

      return { 
        id,
        delayedUntil: timeCheck.delayUntil 
      }
    } catch (error) {
      return {
        skipped: true,
        reason: `Failed to schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Process notifications with budget checking
   */
  async processPendingNotificationsSmart(limit = 50): Promise<{
    processed: number
    successful: number
    failed: number
    skipped: number
    budgetStatus: {
      emailBudgetUsed: number
      smsBudgetUsed: number
      emailLimitReached: boolean
      smsLimitReached: boolean
    }
  }> {
    // Get current month's usage
    const budgetStatus = await this.getBudgetStatus()

    // Get pending notifications
    const pendingNotifications = await this.getPendingNotifications(limit)
    
    let successful = 0
    let failed = 0
    let skipped = 0

    for (const notification of pendingNotifications) {
      try {
        // Check budget limits
        if (this.settings.budgetHardCap) {
          if (notification.type === 'email' && budgetStatus.emailLimitReached) {
            await this.markAsCancelled(notification.id, 'Email budget limit reached')
            skipped++
            continue
          }
          if (notification.type === 'sms' && budgetStatus.smsLimitReached) {
            await this.markAsCancelled(notification.id, 'SMS budget limit reached')
            skipped++
            continue
          }
        }

        // Process notification (this will call the existing processNotification method)
        const result = await this.processNotification(notification)
        
        if (result.success) {
          successful++
          // Update budget tracking
          if (notification.type === 'email') {
            budgetStatus.emailBudgetUsed++
          } else if (notification.type === 'sms') {
            budgetStatus.smsBudgetUsed++
          }
        } else if (result.cancelled) {
          skipped++
        } else {
          failed++
        }
      } catch (error) {
        console.error('Failed to process notification:', error)
        failed++
      }
    }

    // Update budget limits check
    const emailLimitReached = this.settings.monthlyEmailLimit ? 
      budgetStatus.emailBudgetUsed >= this.settings.monthlyEmailLimit : false
    const smsLimitReached = this.settings.monthlySmsLimit ? 
      budgetStatus.smsBudgetUsed >= this.settings.monthlySmsLimit : false

    return {
      processed: pendingNotifications.length,
      successful,
      failed,
      skipped,
      budgetStatus: {
        ...budgetStatus,
        emailLimitReached,
        smsLimitReached
      }
    }
  }

  /**
   * Cancel and reschedule notifications for rescheduled appointments
   */
  async handleAppointmentReschedule(
    appointmentId: string,
    newAppointmentTime: Date,
    customerData: {
      id: string
      email?: string
      phone?: string
      firstName: string
      lastName: string
    },
    appointmentData: Record<string, unknown>
  ): Promise<{
    cancelled: number
    rescheduled: { emailId?: string; smsId?: string }
  }> {
    // Cancel existing notifications
    const cancelled = await this.cancelAppointmentNotifications(appointmentId)

    // Calculate new reminder time
    const reminderTime = new Date(newAppointmentTime.getTime() - (this.settings.reminderHours * 60 * 60 * 1000))

    // Schedule new reminders
    const rescheduled: { emailId?: string; smsId?: string } = {}

    if (this.settings.emailEnabled && customerData.email) {
      const result = await this.scheduleNotificationSmart(
        'email',
        'appointment_reminder',
        customerData.id,
        {
          ...appointmentData,
          appointmentId,
          customerName: `${customerData.firstName} ${customerData.lastName}`,
          rescheduleNotice: true
        },
        reminderTime,
        customerData.email,
        undefined,
        {
          appointmentId,
          customerId: customerData.id,
          notificationType: 'appointment_reminder',
          timeWindowHours: 24
        }
      )
      
      if (result.id) {
        rescheduled.emailId = result.id
      }
    }

    if (this.settings.smsEnabled && customerData.phone) {
      const result = await this.scheduleNotificationSmart(
        'sms',
        'appointment_reminder',
        customerData.id,
        {
          ...appointmentData,
          appointmentId,
          customerName: `${customerData.firstName} ${customerData.lastName}`,
          rescheduleNotice: true
        },
        reminderTime,
        undefined,
        customerData.phone,
        {
          appointmentId,
          customerId: customerData.id,
          notificationType: 'appointment_reminder',
          timeWindowHours: 24
        }
      )
      
      if (result.id) {
        rescheduled.smsId = result.id
      }
    }

    return { cancelled, rescheduled }
  }

  private getConsentTypeFromChannel(channel: NotificationChannel): 'appointment_reminders' | 'appointment_confirmations' | 'appointment_changes' | 'daily_schedules' {
    switch (channel) {
      case 'appointment_reminder':
        return 'appointment_reminders'
      case 'appointment_confirmation':
        return 'appointment_confirmations'
      case 'appointment_cancellation':
      case 'appointment_reschedule':
        return 'appointment_changes'
      case 'staff_daily_schedule':
        return 'daily_schedules'
      default:
        return 'appointment_reminders'
    }
  }

  private async shouldSendAtTime(
    scheduledTime: Date,
    timezone: string = 'Europe/Zurich',
    quietHoursStart: string = '21:00',
    quietHoursEnd: string = '08:00'
  ): Promise<{ shouldSend: boolean; delayUntil?: Date; reason?: string }> {
    if (!this.settings.quietHoursEnabled) {
      return { shouldSend: true }
    }

    try {
      // Convert to target timezone
      const targetTime = new Date(scheduledTime.toLocaleString('en-US', { timeZone: timezone }))
      const hours = targetTime.getHours()
      const minutes = targetTime.getMinutes()
      const currentTimeMinutes = hours * 60 + minutes

      // Parse quiet hours
      const [quietStartHour, quietStartMin] = quietHoursStart.split(':').map(Number)
      const [quietEndHour, quietEndMin] = quietHoursEnd.split(':').map(Number)
      const quietStartMinutes = quietStartHour * 60 + quietStartMin
      const quietEndMinutes = quietEndHour * 60 + quietEndMin

      // Check if we're in quiet hours
      let inQuietHours = false
      if (quietStartMinutes < quietEndMinutes) {
        // Same day quiet hours (e.g., 13:00 - 17:00)
        inQuietHours = currentTimeMinutes >= quietStartMinutes && currentTimeMinutes < quietEndMinutes
      } else {
        // Overnight quiet hours (e.g., 21:00 - 08:00)
        inQuietHours = currentTimeMinutes >= quietStartMinutes || currentTimeMinutes < quietEndMinutes
      }

      if (!inQuietHours) {
        return { shouldSend: true }
      }

      // Calculate delay until end of quiet hours
      let delayUntil: Date
      if (quietStartMinutes > quietEndMinutes) {
        // Overnight quiet hours
        if (currentTimeMinutes >= quietStartMinutes) {
          // Same day, wait until tomorrow's end time
          delayUntil = new Date(targetTime)
          delayUntil.setDate(delayUntil.getDate() + 1)
          delayUntil.setHours(quietEndHour, quietEndMin, 0, 0)
        } else {
          // Next day, wait until today's end time
          delayUntil = new Date(targetTime)
          delayUntil.setHours(quietEndHour, quietEndMin, 0, 0)
        }
      } else {
        // Same day quiet hours
        delayUntil = new Date(targetTime)
        delayUntil.setHours(quietEndHour, quietEndMin, 0, 0)
      }

      return {
        shouldSend: false,
        delayUntil,
        reason: `Delayed due to quiet hours (${quietHoursStart} - ${quietHoursEnd} ${timezone})`
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error)
      // If we can't determine, err on the side of sending
      return { shouldSend: true }
    }
  }

  private async checkDuplicate(dedupeKey: string): Promise<boolean> {
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .neq('status', 'cancelled')
      .limit(1)

    if (error) {
      console.error('Error checking for duplicates:', error)
      return false
    }

    return data && data.length > 0
  }

  private async getBudgetStatus(): Promise<{
    emailBudgetUsed: number
    smsBudgetUsed: number
    emailLimitReached: boolean
    smsLimitReached: boolean
  }> {
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current month's start
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const { data, error } = await supabase
      .from('notification_queue')
      .select('type')
      .eq('status', 'sent')
      .gte('sent_at', monthStart.toISOString())

    if (error) {
      console.error('Error getting budget status:', error)
      return {
        emailBudgetUsed: 0,
        smsBudgetUsed: 0,
        emailLimitReached: false,
        smsLimitReached: false
      }
    }

    const emailCount = data.filter(n => n.type === 'email').length
    const smsCount = data.filter(n => n.type === 'sms').length

    const emailLimitReached = this.settings.monthlyEmailLimit ? 
      emailCount >= this.settings.monthlyEmailLimit : false
    const smsLimitReached = this.settings.monthlySmsLimit ? 
      smsCount >= this.settings.monthlySmsLimit : false

    return {
      emailBudgetUsed: emailCount,
      smsBudgetUsed: smsCount,
      emailLimitReached,
      smsLimitReached
    }
  }
}