import { createClient } from '@supabase/supabase-js'
import { 
  NotificationQueue, 
  NotificationQueueInsert, 
  NotificationQueueUpdate,
  NotificationAuditInsert,
  NotificationChannel,
  NotificationType,
  NotificationStatus
} from '../types/database'
import { NotificationData, NotificationResult } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration for notifications')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Notification queue manager for handling notification queuing, processing, and auditing
 */
export class NotificationQueueManager {
  
  /**
   * Add a notification to the queue
   */
  static async enqueue(notification: NotificationData): Promise<string> {
    const queueItem: NotificationQueueInsert = {
      type: notification.type,
      channel: notification.channel,
      recipient_id: notification.recipientId,
      recipient_email: notification.recipientEmail || null,
      recipient_phone: notification.recipientPhone || null,
      template_name: `default_${notification.channel}_${notification.type}`,
      template_data: notification.templateData,
      scheduled_for: notification.scheduledFor.toISOString(),
      status: 'pending',
      attempts: 0,
      max_attempts: 3
    }
    
    const { data, error } = await supabase
      .from('notification_queue')
      .insert(queueItem)
      .select('id')
      .single()
    
    if (error) {
      throw new Error(`Failed to enqueue notification: ${error.message}`)
    }
    
    // Log audit entry
    await this.addAuditEntry(data.id, 'queued', {
      notification_data: notification.templateData,
      scheduled_for: notification.scheduledFor.toISOString()
    })
    
    return data.id
  }
  
  /**
   * Get pending notifications that are ready to be sent
   */
  static async getPendingNotifications(limit = 50): Promise<NotificationQueue[]> {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .lt('attempts', supabase.from('notification_queue').select('max_attempts'))
      .order('scheduled_for', { ascending: true })
      .limit(limit)
    
    if (error) {
      throw new Error(`Failed to fetch pending notifications: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Mark notification as being sent
   */
  static async markAsSending(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notification_queue')
      .update({ 
        status: 'sending',
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as NotificationQueueUpdate)
      .eq('id', notificationId)
    
    if (error) {
      throw new Error(`Failed to mark notification as sending: ${error.message}`)
    }
  }
  
  /**
   * Mark notification as successfully sent
   */
  static async markAsSent(notificationId: string, result: NotificationResult): Promise<void> {
    const update: NotificationQueueUpdate = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('notification_queue')
      .update(update)
      .eq('id', notificationId)
    
    if (error) {
      throw new Error(`Failed to mark notification as sent: ${error.message}`)
    }
    
    // Log audit entry
    await this.addAuditEntry(notificationId, 'sent', {
      message_id: result.messageId,
      attempts: result.attempts
    })
  }
  
  /**
   * Mark notification as failed
   */
  static async markAsFailed(
    notificationId: string, 
    result: NotificationResult,
    shouldRetry = true
  ): Promise<void> {
    // Get current notification to check retry logic
    const { data: notification, error: fetchError } = await supabase
      .from('notification_queue')
      .select('attempts, max_attempts')
      .eq('id', notificationId)
      .single()
    
    if (fetchError) {
      throw new Error(`Failed to fetch notification for retry check: ${fetchError.message}`)
    }
    
    const newAttempts = result.attempts
    const shouldGiveUp = newAttempts >= notification.max_attempts
    
    const update: NotificationQueueUpdate = {
      status: shouldGiveUp ? 'failed' : 'pending',
      attempts: newAttempts,
      last_attempt_at: new Date().toISOString(),
      error_message: result.error || null,
      updated_at: new Date().toISOString()
    }
    
    if (shouldGiveUp) {
      update.failed_at = new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('notification_queue')
      .update(update)
      .eq('id', notificationId)
    
    if (error) {
      throw new Error(`Failed to mark notification as failed: ${error.message}`)
    }
    
    // Log audit entry
    await this.addAuditEntry(notificationId, shouldGiveUp ? 'failed' : 'retry', {
      error: result.error,
      attempts: newAttempts,
      max_attempts: notification.max_attempts,
      will_retry: !shouldGiveUp
    })
  }
  
  /**
   * Cancel a pending notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notification_queue')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      } as NotificationQueueUpdate)
      .eq('id', notificationId)
      .in('status', ['pending', 'sending'])
    
    if (error) {
      throw new Error(`Failed to cancel notification: ${error.message}`)
    }
    
    // Log audit entry
    await this.addAuditEntry(notificationId, 'cancelled')
  }

  /**
   * Mark a notification as cancelled with reason
   */
  static async markAsCancelled(notificationId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('notification_queue')
      .update({ 
        status: 'cancelled',
        error_message: reason,
        updated_at: new Date().toISOString()
      } as NotificationQueueUpdate)
      .eq('id', notificationId)
      .in('status', ['pending', 'sending'])
    
    if (error) {
      throw new Error(`Failed to mark notification as cancelled: ${error.message}`)
    }
    
    // Log audit entry
    await this.addAuditEntry(notificationId, 'cancelled', { reason })
  }
  
  /**
   * Schedule a notification for a specific time
   */
  static async scheduleNotification(
    type: NotificationType,
    channel: NotificationChannel,
    recipientId: string,
    templateData: Record<string, unknown>,
    scheduledFor: Date,
    recipientEmail?: string,
    recipientPhone?: string
  ): Promise<string> {
    const notification: NotificationData = {
      id: '', // Will be generated by database
      type,
      channel,
      recipientId,
      recipientEmail,
      recipientPhone,
      templateData,
      scheduledFor
    }
    
    return await this.enqueue(notification)
  }
  
  /**
   * Cancel notifications for a specific appointment
   */
  static async cancelAppointmentNotifications(appointmentId: string): Promise<number> {
    const { data, error } = await supabase
      .from('notification_queue')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      } as NotificationQueueUpdate)
      .eq('template_data->>appointmentId', appointmentId)
      .in('status', ['pending', 'sending'])
      .select('id')
    
    if (error) {
      throw new Error(`Failed to cancel appointment notifications: ${error.message}`)
    }
    
    // Log audit entries for all cancelled notifications
    if (data && data.length > 0) {
      await Promise.all(
        data.map(item => 
          this.addAuditEntry(item.id, 'cancelled', { 
            reason: 'appointment_cancelled',
            appointment_id: appointmentId
          })
        )
      )
    }
    
    return data?.length || 0
  }
  
  /**
   * Get notification statistics
   */
  static async getStatistics(days = 30): Promise<{
    total: number
    sent: number
    failed: number
    pending: number
    cancelled: number
    byChannel: Record<NotificationChannel, number>
    byType: Record<NotificationType, number>
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    
    const { data, error } = await supabase
      .from('notification_queue')
      .select('status, channel, type')
      .gte('created_at', since.toISOString())
    
    if (error) {
      throw new Error(`Failed to fetch notification statistics: ${error.message}`)
    }
    
    const stats = {
      total: data.length,
      sent: 0,
      failed: 0,
      pending: 0,
      cancelled: 0,
      byChannel: {} as Record<NotificationChannel, number>,
      byType: {} as Record<NotificationType, number>
    }
    
    data.forEach(item => {
      // Count by status
      stats[item.status as keyof typeof stats]++
      
      // Count by channel
      stats.byChannel[item.channel] = (stats.byChannel[item.channel] || 0) + 1
      
      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1
    })
    
    return stats
  }
  
  /**
   * Clean up old notifications (older than specified days)
   */
  static async cleanupOldNotifications(days = 90): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    const { data, error } = await supabase
      .from('notification_queue')
      .delete()
      .lt('created_at', cutoff.toISOString())
      .in('status', ['sent', 'failed', 'cancelled'])
      .select('id')
    
    if (error) {
      throw new Error(`Failed to cleanup old notifications: ${error.message}`)
    }
    
    return data?.length || 0
  }
  
  /**
   * Add an audit entry for a notification
   */
  private static async addAuditEntry(
    notificationId: string, 
    eventType: 'queued' | 'sent' | 'failed' | 'cancelled' | 'retry',
    details?: Record<string, unknown>
  ): Promise<void> {
    const auditEntry: NotificationAuditInsert = {
      notification_id: notificationId,
      event_type: eventType,
      details: details || null
    }
    
    const { error } = await supabase
      .from('notification_audit')
      .insert(auditEntry)
    
    if (error) {
      console.error('Failed to add audit entry:', error.message)
      // Don't throw here as audit is secondary to the main operation
    }
  }
}