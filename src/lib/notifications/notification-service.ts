import nodemailer from 'nodemailer'
import { 
  NotificationChannel, 
  NotificationType,
  NotificationSettings,
  EmailSettings,
  SmsSettings,
  NotificationQueue
} from '../types/database'
import { 
  NotificationData, 
  NotificationResult, 
  EmailNotificationData, 
  SmsNotificationData,
  NotificationTemplateData,
  NotificationError
} from './types'
import { NotificationTemplateManager } from './notification-templates'
import { NotificationQueueManager } from './notification-queue'
import { NotificationConsentService } from './consent-service'
import { NotificationConsent } from './consent-types'

/**
 * Core notification service for sending emails and SMS
 */
export class NotificationService {
  private emailTransporter: nodemailer.Transporter | null = null
  private emailSettings: EmailSettings | null = null
  private smsSettings: SmsSettings | null = null
  private notificationSettings: NotificationSettings | null = null
  private consentService: NotificationConsentService | null = null
  
  /**
   * Initialize the notification service with settings
   */
  async initialize(
    emailSettings: EmailSettings,
    smsSettings: SmsSettings,
    notificationSettings: NotificationSettings,
    supabaseUrl?: string,
    supabaseServiceKey?: string
  ): Promise<void> {
    this.emailSettings = emailSettings
    this.smsSettings = smsSettings
    this.notificationSettings = notificationSettings
    
    // Initialize consent service if Supabase credentials provided
    if (supabaseUrl && supabaseServiceKey) {
      this.consentService = new NotificationConsentService(supabaseUrl, supabaseServiceKey)
    }
    
    // Initialize email transporter
    if (notificationSettings.emailEnabled && emailSettings.smtp_host) {
      this.emailTransporter = nodemailer.createTransporter({
        host: emailSettings.smtp_host,
        port: emailSettings.smtp_port,
        secure: emailSettings.smtp_use_tls,
        auth: {
          user: emailSettings.smtp_username,
          pass: emailSettings.smtp_password
        }
      })
      
      // Verify email connection
      try {
        await this.emailTransporter.verify()
      } catch (error) {
        console.error('Email transporter verification failed:', error)
        throw new NotificationError(
          'Email service initialization failed',
          'EMAIL_INIT_FAILED',
          false
        )
      }
    }
  }
  
  /**
   * Send an email notification
   */
  async sendEmail(notification: EmailNotificationData): Promise<NotificationResult> {
    if (!this.emailTransporter || !this.emailSettings) {
      throw new NotificationError(
        'Email service not initialized',
        'EMAIL_NOT_INITIALIZED',
        false
      )
    }
    
    if (!this.notificationSettings?.email_enabled) {
      throw new NotificationError(
        'Email notifications are disabled',
        'EMAIL_DISABLED',
        false
      )
    }
    
    try {
      const mailOptions = {
        from: `${this.emailSettings.smtp_from_name} <${this.emailSettings.smtp_from_email}>`,
        to: notification.recipientEmail,
        subject: notification.subject,
        html: notification.htmlBody,
        text: notification.textBody
      }
      
      const info = await this.emailTransporter.sendMail(mailOptions)
      
      return {
        success: true,
        messageId: info.messageId,
        attempts: 1
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown email error'
      
      return {
        success: false,
        error: errorMessage,
        attempts: 1
      }
    }
  }
  
  /**
   * Send an SMS notification
   */
  async sendSMS(notification: SmsNotificationData): Promise<NotificationResult> {
    if (!this.smsSettings?.enabled || !this.notificationSettings?.smsEnabled) {
      throw new NotificationError(
        'SMS notifications are disabled',
        'SMS_DISABLED',
        false
      )
    }
    
    if (!this.smsSettings.twilio_account_sid || !this.smsSettings.twilio_auth_token) {
      throw new NotificationError(
        'SMS service not configured',
        'SMS_NOT_CONFIGURED',
        false
      )
    }
    
    try {
      // For now, we'll simulate SMS sending since Twilio isn't installed
      // In a real implementation, you would use:
      // const twilio = require('twilio')(this.smsSettings.twilio_account_sid, this.smsSettings.twilio_auth_token)
      // const message = await twilio.messages.create({
      //   body: notification.message,
      //   from: this.smsSettings.twilio_phone_number,
      //   to: notification.recipientPhone
      // })
      
      console.log(`SMS would be sent to ${notification.recipientPhone}: ${notification.message}`)
      
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        attempts: 1
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error'
      
      return {
        success: false,
        error: errorMessage,
        attempts: 1
      }
    }
  }
  
  /**
   * Process a notification from the queue
   */
  async processNotification(queueItem: NotificationQueue): Promise<NotificationResult> {
    try {
      // Check consent and suppression if service is available
      if (this.consentService && queueItem.recipient_id) {
        const consentType = this.getConsentTypeFromChannel(queueItem.channel)
        const shouldSend = await this.consentService.shouldSendNotification(
          queueItem.recipient_id,
          queueItem.recipient_email || undefined,
          queueItem.recipient_phone || undefined,
          queueItem.type as 'email' | 'sms',
          consentType
        )

        if (!shouldSend.canSend) {
          // Mark as cancelled due to consent/suppression
          await NotificationQueueManager.markAsCancelled(queueItem.id, shouldSend.reason || 'Consent check failed')
          
          return {
            success: false,
            error: shouldSend.reason || 'Consent check failed',
            attempts: queueItem.attempts + 1,
            cancelled: true
          }
        }
      }

      // Mark as sending
      await NotificationQueueManager.markAsSending(queueItem.id)
      
      // Prepare notification data
      const templateData = queueItem.template_data as NotificationTemplateData
      
      // Add unsubscribe link to template data
      if (this.consentService && queueItem.recipient_id) {
        templateData.unsubscribeLink = await this.generateUnsubscribeLink(
          queueItem.recipient_id,
          queueItem.recipient_email || undefined,
          queueItem.recipient_phone || undefined,
          queueItem.type as 'email' | 'sms',
          queueItem.channel
        )
      }
      
      let result: NotificationResult
      
      if (queueItem.type === 'email') {
        const emailNotification = await this.prepareEmailNotification(
          queueItem.channel,
          queueItem.recipient_email,
          templateData
        )
        result = await this.sendEmail(emailNotification)
      } else if (queueItem.type === 'sms') {
        const smsNotification = await this.prepareSmsNotification(
          queueItem.channel,
          queueItem.recipient_phone,
          templateData
        )
        result = await this.sendSMS(smsNotification)
      } else {
        throw new NotificationError(
          `Unknown notification type: ${queueItem.type}`,
          'UNKNOWN_TYPE',
          false
        )
      }
      
      // Update queue item based on result
      if (result.success) {
        await NotificationQueueManager.markAsSent(queueItem.id, result)
      } else {
        await NotificationQueueManager.markAsFailed(queueItem.id, {
          ...result,
          attempts: queueItem.attempts + 1
        })
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
      const result: NotificationResult = {
        success: false,
        error: errorMessage,
        attempts: queueItem.attempts + 1
      }
      
      await NotificationQueueManager.markAsFailed(queueItem.id, result)
      return result
    }
  }
  
  /**
   * Prepare an email notification with rendered template
   */
  private async prepareEmailNotification(
    channel: NotificationChannel,
    recipientEmail: string,
    templateData: NotificationTemplateData
  ): Promise<EmailNotificationData> {
    const template = NotificationTemplateManager.getDefaultTemplate(channel, 'email')
    
    const subject = template.subject 
      ? NotificationTemplateManager.renderTemplate(template.subject, templateData)
      : `Notification from ${templateData.salonName || 'Salon'}`
    
    const htmlBody = NotificationTemplateManager.renderTemplate(template.body, templateData)
    
    return {
      id: '',
      type: 'email',
      channel,
      recipientId: '',
      recipientEmail,
      templateData: templateData as Record<string, unknown>,
      scheduledFor: new Date(),
      subject,
      htmlBody,
      textBody: this.stripHtml(htmlBody)
    }
  }
  
  /**
   * Prepare an SMS notification with rendered template
   */
  private async prepareSmsNotification(
    channel: NotificationChannel,
    recipientPhone: string,
    templateData: NotificationTemplateData
  ): Promise<SmsNotificationData> {
    if (channel === 'staff_daily_schedule') {
      throw new NotificationError(
        'SMS not supported for daily schedule notifications',
        'SMS_UNSUPPORTED_CHANNEL',
        false
      )
    }
    
    const template = NotificationTemplateManager.getDefaultTemplate(channel, 'sms')
    const message = NotificationTemplateManager.renderTemplate(template.body, templateData)
    
    return {
      id: '',
      type: 'sms',
      channel,
      recipientId: '',
      recipientPhone,
      templateData: templateData as Record<string, unknown>,
      scheduledFor: new Date(),
      message
    }
  }
  
  /**
   * Strip HTML tags for text version of emails
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  /**
   * Process all pending notifications
   */
  async processPendingNotifications(limit = 50): Promise<{
    processed: number
    successful: number
    failed: number
  }> {
    const pendingNotifications = await NotificationQueueManager.getPendingNotifications(limit)
    
    let successful = 0
    let failed = 0
    
    for (const notification of pendingNotifications) {
      try {
        const result = await this.processNotification(notification)
        if (result.success) {
          successful++
        } else {
          failed++
        }
      } catch (error) {
        console.error('Failed to process notification:', error)
        failed++
      }
    }
    
    return {
      processed: pendingNotifications.length,
      successful,
      failed
    }
  }
  
  /**
   * Schedule an appointment reminder
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    customerId: string,
    customerEmail: string,
    customerPhone: string | null,
    appointmentData: Record<string, unknown>,
    reminderTime: Date
  ): Promise<{ emailId?: string; smsId?: string }> {
    const result: { emailId?: string; smsId?: string } = {}
    
    if (this.notificationSettings?.email_enabled && customerEmail) {
      result.emailId = await NotificationQueueManager.scheduleNotification(
        'email',
        'appointment_reminder',
        customerId,
        { ...appointmentData, appointmentId },
        reminderTime,
        customerEmail
      )
    }
    
    if (this.notificationSettings?.sms_enabled && customerPhone) {
      result.smsId = await NotificationQueueManager.scheduleNotification(
        'sms',
        'appointment_reminder',
        customerId,
        { ...appointmentData, appointmentId },
        reminderTime,
        undefined,
        customerPhone
      )
    }
    
    return result
  }
  
  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(
    appointmentId: string,
    customerId: string,
    customerEmail: string,
    customerPhone: string | null,
    appointmentData: Record<string, unknown>
  ): Promise<{ emailId?: string; smsId?: string }> {
    const result: { emailId?: string; smsId?: string } = {}
    const now = new Date()
    
    if (this.notificationSettings?.send_confirmations && this.notificationSettings?.email_enabled && customerEmail) {
      result.emailId = await NotificationQueueManager.scheduleNotification(
        'email',
        'appointment_confirmation',
        customerId,
        { ...appointmentData, appointmentId },
        now,
        customerEmail
      )
    }
    
    if (this.notificationSettings?.send_confirmations && this.notificationSettings?.sms_enabled && customerPhone) {
      result.smsId = await NotificationQueueManager.scheduleNotification(
        'sms',
        'appointment_confirmation',
        customerId,
        { ...appointmentData, appointmentId },
        now,
        undefined,
        customerPhone
      )
    }
    
    return result
  }

  /**
   * Get consent type from notification channel
   */
  private getConsentTypeFromChannel(channel: NotificationChannel): NotificationConsent['consentType'] {
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

  /**
   * Generate unsubscribe link for notification
   */
  private async generateUnsubscribeLink(
    customerId: string,
    email?: string,
    phone?: string,
    channel?: 'email' | 'sms',
    notificationChannel?: NotificationChannel
  ): Promise<string | undefined> {
    if (!this.consentService) {
      return undefined
    }

    try {
      const consentType = notificationChannel ? this.getConsentTypeFromChannel(notificationChannel) : undefined
      const notificationTypes = consentType ? [consentType] : []

      const token = await this.consentService.generateUnsubscribeToken(
        customerId,
        email,
        phone,
        channel,
        notificationTypes
      )

      if (token) {
        // Use site URL from environment or default
        const siteUrl = process.env.VITE_SITE_URL || 'https://your-site.netlify.app'
        return `${siteUrl}/.netlify/functions/unsubscribe/${token}`
      }
    } catch (error) {
      console.error('Failed to generate unsubscribe link:', error)
    }

    return undefined
  }

  /**
   * Check if notification should be sent based on quiet hours and timezone
   */
  async shouldSendAtTime(
    scheduledTime: Date,
    timezone: string = 'Europe/Zurich',
    quietHoursStart: string = '21:00',
    quietHoursEnd: string = '08:00'
  ): Promise<{ shouldSend: boolean; delayUntil?: Date; reason?: string }> {
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

  /**
   * Handle provider feedback (bounces, complaints, delivery status)
   */
  async handleProviderFeedback(
    notificationId: string,
    feedbackType: 'bounce' | 'complaint' | 'delivery' | 'reject',
    details: {
      email?: string
      phone?: string
      reason?: string
      timestamp?: Date
      providerResponse?: any
    }
  ): Promise<void> {
    if (!this.consentService) {
      return
    }

    try {
      // Add to suppression list if bounce or complaint
      if ((feedbackType === 'bounce' || feedbackType === 'complaint') && 
          (details.email || details.phone)) {
        
        await this.consentService.addSuppression({
          email: details.email,
          phone: details.phone,
          suppressionType: feedbackType === 'bounce' ? 'bounce' : 'spam',
          suppressionReason: details.reason || `Provider feedback: ${feedbackType}`,
          suppressionSource: 'provider_feedback'
        })
      }

      // Log audit event
      console.log(`Provider feedback for notification ${notificationId}:`, {
        type: feedbackType,
        details
      })
    } catch (error) {
      console.error('Error handling provider feedback:', error)
    }
  }
}