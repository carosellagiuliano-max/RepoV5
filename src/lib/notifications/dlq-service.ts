import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DeadLetterItem {
  id: string;
  originalNotificationId: string;
  notificationType: 'email' | 'sms';
  notificationChannel: string;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateData: any;
  failureReason: string;
  failureDetails?: any;
  failureType: string;
  isPermanent: boolean;
  retryEligible: boolean;
  totalAttempts: number;
  lastErrorMessage?: string;
  lastAttemptAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionAction?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  providerEventId?: string;
  eventType: string;
  notificationId?: string;
  providerMessageId?: string;
  eventData: any;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: string;
  bounceType?: string;
  complaintType?: string;
  processed: boolean;
  processedAt?: string;
  processingError?: string;
  webhookSignature?: string;
  webhookVerified: boolean;
  receivedAt: string;
  createdAt: string;
}

export interface RetryConfig {
  id: string;
  scope: 'global' | 'channel' | 'provider';
  scopeValue?: string;
  maxAttempts: number;
  initialDelayMinutes: number;
  backoffMultiplier: number;
  maxDelayMinutes: number;
  hardBounceRetries: number;
  softBounceRetries: number;
  timeoutRetries: number;
  rateLimitRetries: number;
  maxAgeHours: number;
  dlqAfterHours: number;
  rateLimitPerMinute: number;
  rateLimitBurst: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DLQStats {
  totalItems: number;
  byFailureType: Record<string, number>;
  byChannel: Record<string, number>;
  recentFailures: number; // Last 24 hours
  retryEligible: number;
  resolved: number;
  avgResolutionTimeHours: number;
}

/**
 * Service for managing the Dead Letter Queue and webhook events
 */
export class DeadLetterQueueService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get DLQ items with filtering and pagination
   */
  async getDLQItems(
    filters: {
      failureType?: string;
      notificationChannel?: string;
      resolved?: boolean;
      retryEligible?: boolean;
      createdAfter?: Date;
      createdBefore?: Date;
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<DeadLetterItem[]> {
    try {
      let query = this.supabase
        .from('notification_dead_letter_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.failureType) {
        query = query.eq('failure_type', filters.failureType);
      }
      if (filters.notificationChannel) {
        query = query.eq('notification_channel', filters.notificationChannel);
      }
      if (filters.resolved !== undefined) {
        if (filters.resolved) {
          query = query.not('resolved_at', 'is', null);
        } else {
          query = query.is('resolved_at', null);
        }
      }
      if (filters.retryEligible !== undefined) {
        query = query.eq('retry_eligible', filters.retryEligible);
      }
      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter.toISOString());
      }
      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching DLQ items:', error);
        return [];
      }

      return data.map(this.mapDLQItem);
    } catch (error) {
      console.error('Error in getDLQItems:', error);
      return [];
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStats> {
    try {
      const { data, error } = await this.supabase
        .from('notification_dead_letter_queue')
        .select('failure_type, notification_channel, created_at, resolved_at')

      if (error) {
        console.error('Error fetching DLQ stats:', error);
        return this.getEmptyStats();
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats: DLQStats = {
        totalItems: data.length,
        byFailureType: {},
        byChannel: {},
        recentFailures: 0,
        retryEligible: 0,
        resolved: 0,
        avgResolutionTimeHours: 0
      };

      let totalResolutionTimeHours = 0;
      let resolvedCount = 0;

      for (const item of data) {
        // Count by failure type
        stats.byFailureType[item.failure_type] = (stats.byFailureType[item.failure_type] || 0) + 1;

        // Count by channel
        stats.byChannel[item.notification_channel] = (stats.byChannel[item.notification_channel] || 0) + 1;

        // Count recent failures
        if (new Date(item.created_at) > yesterday) {
          stats.recentFailures++;
        }

        // Count resolved
        if (item.resolved_at) {
          stats.resolved++;
          resolvedCount++;
          
          // Calculate resolution time
          const resolutionTime = new Date(item.resolved_at).getTime() - new Date(item.created_at).getTime();
          totalResolutionTimeHours += resolutionTime / (1000 * 60 * 60);
        }
      }

      // Calculate average resolution time
      if (resolvedCount > 0) {
        stats.avgResolutionTimeHours = totalResolutionTimeHours / resolvedCount;
      }

      // Get retry eligible count
      const { count: retryEligibleCount } = await this.supabase
        .from('notification_dead_letter_queue')
        .select('*', { count: 'exact', head: true })
        .eq('retry_eligible', true)
        .is('resolved_at', null);

      stats.retryEligible = retryEligibleCount || 0;

      return stats;
    } catch (error) {
      console.error('Error in getDLQStats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Retry a DLQ item
   */
  async retryDLQItem(
    dlqId: string,
    retryOptions: {
      updateRecipient?: {
        email?: string;
        phone?: string;
      };
      notes?: string;
      retryBy?: string;
    } = {}
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    try {
      // Get DLQ item
      const { data: dlqItem, error: dlqError } = await this.supabase
        .from('notification_dead_letter_queue')
        .select('*')
        .eq('id', dlqId)
        .single();

      if (dlqError || !dlqItem) {
        return { success: false, error: 'DLQ item not found' };
      }

      if (dlqItem.resolved_at) {
        return { success: false, error: 'DLQ item already resolved' };
      }

      if (!dlqItem.retry_eligible) {
        return { success: false, error: 'DLQ item not eligible for retry' };
      }

      // Create new notification with updated recipient info
      const recipientEmail = retryOptions.updateRecipient?.email || dlqItem.recipient_email;
      const recipientPhone = retryOptions.updateRecipient?.phone || dlqItem.recipient_phone;

      const { data: newNotification, error: notificationError } = await this.supabase
        .from('notification_queue')
        .insert({
          type: dlqItem.notification_type,
          channel: dlqItem.notification_channel,
          recipient_id: dlqItem.recipient_id,
          recipient_email: recipientEmail,
          recipient_phone: recipientPhone,
          template_name: `default_${dlqItem.notification_channel}_${dlqItem.notification_type}`,
          template_data: dlqItem.template_data,
          scheduled_for: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        })
        .select('id')
        .single();

      if (notificationError) {
        return { success: false, error: `Failed to create retry notification: ${notificationError.message}` };
      }

      // Mark DLQ item as resolved
      const { error: resolveError } = await this.supabase
        .from('notification_dead_letter_queue')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: retryOptions.retryBy,
          resolution_action: 'manual_retry',
          resolution_notes: retryOptions.notes || 'Manual retry from DLQ',
          updated_at: new Date().toISOString()
        })
        .eq('id', dlqId);

      if (resolveError) {
        console.error('Error marking DLQ item as resolved:', resolveError);
        // Don't fail the retry if we can't mark as resolved
      }

      return { success: true, notificationId: newNotification.id };
    } catch (error) {
      console.error('Error retrying DLQ item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Resolve a DLQ item without retrying
   */
  async resolveDLQItem(
    dlqId: string,
    resolution: {
      action: 'address_updated' | 'suppressed' | 'ignored';
      notes?: string;
      resolvedBy?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('notification_dead_letter_queue')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: resolution.resolvedBy,
          resolution_action: resolution.action,
          resolution_notes: resolution.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', dlqId)
        .is('resolved_at', null); // Only resolve unresolved items

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error resolving DLQ item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get webhook events with filtering
   */
  async getWebhookEvents(
    filters: {
      provider?: string;
      eventType?: string;
      processed?: boolean;
      notificationId?: string;
      receivedAfter?: Date;
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookEvent[]> {
    try {
      let query = this.supabase
        .from('notification_webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.provider) {
        query = query.eq('provider', filters.provider);
      }
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters.processed !== undefined) {
        query = query.eq('processed', filters.processed);
      }
      if (filters.notificationId) {
        query = query.eq('notification_id', filters.notificationId);
      }
      if (filters.receivedAfter) {
        query = query.gte('received_at', filters.receivedAfter.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching webhook events:', error);
        return [];
      }

      return data.map(this.mapWebhookEvent);
    } catch (error) {
      console.error('Error in getWebhookEvents:', error);
      return [];
    }
  }

  /**
   * Reprocess failed webhook events
   */
  async reprocessWebhookEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: event, error: eventError } = await this.supabase
        .from('notification_webhook_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        return { success: false, error: 'Webhook event not found' };
      }

      if (event.processed) {
        return { success: false, error: 'Event already processed' };
      }

      // Reprocess using the database function
      const { error: processError } = await this.supabase
        .rpc('process_webhook_event', {
          p_provider: event.provider,
          p_provider_event_id: event.provider_event_id,
          p_event_type: event.event_type,
          p_provider_message_id: event.provider_message_id,
          p_event_data: event.event_data,
          p_status: event.status,
          p_error_code: event.error_code,
          p_error_message: event.error_message
        });

      if (processError) {
        return { success: false, error: processError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error reprocessing webhook event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get retry configuration
   */
  async getRetryConfig(
    scope: 'global' | 'channel' | 'provider' = 'global',
    scopeValue?: string
  ): Promise<RetryConfig | null> {
    try {
      let query = this.supabase
        .from('notification_retry_config')
        .select('*')
        .eq('scope', scope);

      if (scopeValue) {
        query = query.eq('scope_value', scopeValue);
      } else {
        query = query.is('scope_value', null);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('Error fetching retry config:', error);
        return null;
      }

      return this.mapRetryConfig(data);
    } catch (error) {
      console.error('Error in getRetryConfig:', error);
      return null;
    }
  }

  /**
   * Update retry configuration
   */
  async updateRetryConfig(
    scope: 'global' | 'channel' | 'provider',
    config: Partial<Omit<RetryConfig, 'id' | 'scope' | 'createdAt' | 'updatedAt'>>,
    scopeValue?: string,
    updatedBy?: string
  ): Promise<RetryConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_retry_config')
        .upsert({
          scope,
          scope_value: scopeValue,
          max_attempts: config.maxAttempts,
          initial_delay_minutes: config.initialDelayMinutes,
          backoff_multiplier: config.backoffMultiplier,
          max_delay_minutes: config.maxDelayMinutes,
          hard_bounce_retries: config.hardBounceRetries,
          soft_bounce_retries: config.softBounceRetries,
          timeout_retries: config.timeoutRetries,
          rate_limit_retries: config.rateLimitRetries,
          max_age_hours: config.maxAgeHours,
          dlq_after_hours: config.dlqAfterHours,
          rate_limit_per_minute: config.rateLimitPerMinute,
          rate_limit_burst: config.rateLimitBurst,
          created_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating retry config:', error);
        return null;
      }

      return this.mapRetryConfig(data);
    } catch (error) {
      console.error('Error in updateRetryConfig:', error);
      return null;
    }
  }

  /**
   * Clean up old resolved DLQ items
   */
  async cleanupResolvedItems(olderThanDays: number = 30): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { count, error } = await this.supabase
        .from('notification_dead_letter_queue')
        .delete({ count: 'exact' })
        .not('resolved_at', 'is', null)
        .lt('resolved_at', cutoffDate.toISOString());

      if (error) {
        console.error('Error cleaning up resolved DLQ items:', error);
        return { deletedCount: 0 };
      }

      return { deletedCount: count || 0 };
    } catch (error) {
      console.error('Error in cleanupResolvedItems:', error);
      return { deletedCount: 0 };
    }
  }

  private mapDLQItem(data: any): DeadLetterItem {
    return {
      id: data.id,
      originalNotificationId: data.original_notification_id,
      notificationType: data.notification_type,
      notificationChannel: data.notification_channel,
      recipientId: data.recipient_id,
      recipientEmail: data.recipient_email,
      recipientPhone: data.recipient_phone,
      templateData: data.template_data,
      failureReason: data.failure_reason,
      failureDetails: data.failure_details,
      failureType: data.failure_type,
      isPermanent: data.is_permanent,
      retryEligible: data.retry_eligible,
      totalAttempts: data.total_attempts,
      lastErrorMessage: data.last_error_message,
      lastAttemptAt: data.last_attempt_at,
      resolvedAt: data.resolved_at,
      resolvedBy: data.resolved_by,
      resolutionAction: data.resolution_action,
      resolutionNotes: data.resolution_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapWebhookEvent(data: any): WebhookEvent {
    return {
      id: data.id,
      provider: data.provider,
      providerEventId: data.provider_event_id,
      eventType: data.event_type,
      notificationId: data.notification_id,
      providerMessageId: data.provider_message_id,
      eventData: data.event_data,
      status: data.status,
      errorCode: data.error_code,
      errorMessage: data.error_message,
      deliveredAt: data.delivered_at,
      bounceType: data.bounce_type,
      complaintType: data.complaint_type,
      processed: data.processed,
      processedAt: data.processed_at,
      processingError: data.processing_error,
      webhookSignature: data.webhook_signature,
      webhookVerified: data.webhook_verified,
      receivedAt: data.received_at,
      createdAt: data.created_at
    };
  }

  private mapRetryConfig(data: any): RetryConfig {
    return {
      id: data.id,
      scope: data.scope,
      scopeValue: data.scope_value,
      maxAttempts: data.max_attempts,
      initialDelayMinutes: data.initial_delay_minutes,
      backoffMultiplier: data.backoff_multiplier,
      maxDelayMinutes: data.max_delay_minutes,
      hardBounceRetries: data.hard_bounce_retries,
      softBounceRetries: data.soft_bounce_retries,
      timeoutRetries: data.timeout_retries,
      rateLimitRetries: data.rate_limit_retries,
      maxAgeHours: data.max_age_hours,
      dlqAfterHours: data.dlq_after_hours,
      rateLimitPerMinute: data.rate_limit_per_minute,
      rateLimitBurst: data.rate_limit_burst,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private getEmptyStats(): DLQStats {
    return {
      totalItems: 0,
      byFailureType: {},
      byChannel: {},
      recentFailures: 0,
      retryEligible: 0,
      resolved: 0,
      avgResolutionTimeHours: 0
    };
  }
}