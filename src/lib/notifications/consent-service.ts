import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  NotificationConsent, 
  NotificationSuppression,
  UnsubscribeToken,
  ConsentCheckResult,
  SuppressionCheckResult,
  UnsubscribeResult,
  ConsentRequest,
  SuppressionRequest,
  DedupeConfig
} from './consent-types';

export class NotificationConsentService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check if a customer has given consent for a specific notification type
   */
  async checkConsent(
    customerId: string, 
    channel: 'email' | 'sms', 
    consentType: NotificationConsent['consentType']
  ): Promise<ConsentCheckResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_notification_consent', {
          p_customer_id: customerId,
          p_channel: channel,
          p_consent_type: consentType
        });

      if (error) {
        console.error('Error checking consent:', error);
        return { hasConsent: false };
      }

      return { hasConsent: data === true };
    } catch (error) {
      console.error('Error checking consent:', error);
      return { hasConsent: false };
    }
  }

  /**
   * Record customer consent
   */
  async recordConsent(request: ConsentRequest): Promise<NotificationConsent | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_consent')
        .upsert({
          customer_id: request.customerId,
          channel: request.channel,
          consent_type: request.consentType,
          consented: request.consented,
          consent_source: request.consentSource,
          consent_ip_address: request.ipAddress,
          consent_user_agent: request.userAgent,
          updated_by: request.updatedBy,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording consent:', error);
        return null;
      }

      return this.mapConsentRecord(data);
    } catch (error) {
      console.error('Error recording consent:', error);
      return null;
    }
  }

  /**
   * Get all consent records for a customer
   */
  async getCustomerConsent(customerId: string): Promise<NotificationConsent[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_consent')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer consent:', error);
        return [];
      }

      return data.map(this.mapConsentRecord);
    } catch (error) {
      console.error('Error fetching customer consent:', error);
      return [];
    }
  }

  /**
   * Check if an email or phone number is suppressed
   */
  async checkSuppression(email?: string, phone?: string): Promise<SuppressionCheckResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_suppression_status', {
          p_email: email || null,
          p_phone: phone || null
        })
        .single();

      if (error) {
        console.error('Error checking suppression:', error);
        return { isSuppressed: false };
      }

      return {
        isSuppressed: data.is_suppressed,
        suppressionType: data.suppression_type,
        suppressionReason: data.suppression_reason
      };
    } catch (error) {
      console.error('Error checking suppression:', error);
      return { isSuppressed: false };
    }
  }

  /**
   * Add email or phone to suppression list
   */
  async addSuppression(request: SuppressionRequest): Promise<NotificationSuppression | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_suppression')
        .insert({
          email: request.email,
          phone: request.phone,
          suppression_type: request.suppressionType,
          suppression_reason: request.suppressionReason,
          suppression_source: request.suppressionSource,
          suppressed_by: request.suppressedBy
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding suppression:', error);
        return null;
      }

      return this.mapSuppressionRecord(data);
    } catch (error) {
      console.error('Error adding suppression:', error);
      return null;
    }
  }

  /**
   * Generate unsubscribe token for customer
   */
  async generateUnsubscribeToken(
    customerId: string,
    email?: string,
    phone?: string,
    channel?: 'email' | 'sms',
    notificationTypes: string[] = []
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('generate_unsubscribe_token', {
          p_customer_id: customerId,
          p_email: email || null,
          p_phone: phone || null,
          p_channel: channel || null,
          p_notification_types: notificationTypes
        });

      if (error) {
        console.error('Error generating unsubscribe token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error generating unsubscribe token:', error);
      return null;
    }
  }

  /**
   * Process unsubscribe using token
   */
  async processUnsubscribe(token: string, ipAddress?: string): Promise<UnsubscribeResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('process_unsubscribe', {
          p_token: token,
          p_ip_address: ipAddress || null
        })
        .single();

      if (error) {
        console.error('Error processing unsubscribe:', error);
        return {
          success: false,
          message: 'Failed to process unsubscribe request',
          affectedChannels: []
        };
      }

      return {
        success: data.success,
        message: data.message,
        customerId: data.customer_id,
        affectedChannels: data.affected_channels || []
      };
    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      return {
        success: false,
        message: 'Failed to process unsubscribe request',
        affectedChannels: []
      };
    }
  }

  /**
   * Get suppression list (admin only)
   */
  async getSuppressionList(limit: number = 100, offset: number = 0): Promise<NotificationSuppression[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_suppression')
        .select('*')
        .order('suppressed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching suppression list:', error);
        return [];
      }

      return data.map(this.mapSuppressionRecord);
    } catch (error) {
      console.error('Error fetching suppression list:', error);
      return [];
    }
  }

  /**
   * Generate dedupe key for notification
   */
  generateDedupeKey(config: DedupeConfig): string {
    const windowHours = config.timeWindowHours || 24;
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - (windowStart.getHours() % windowHours));
    windowStart.setMinutes(0);
    windowStart.setSeconds(0);
    windowStart.setMilliseconds(0);

    const windowKey = windowStart.toISOString().slice(0, 13); // YYYY-MM-DDTHH

    return `${config.customerId}_${config.notificationType}_${config.appointmentId || 'general'}_${windowKey}`;
  }

  /**
   * Check if notification should be sent based on consent and suppression
   */
  async shouldSendNotification(
    customerId: string,
    email?: string,
    phone?: string,
    channel: 'email' | 'sms' = 'email',
    consentType: NotificationConsent['consentType'] = 'appointment_reminders'
  ): Promise<{ 
    canSend: boolean; 
    reason?: string; 
    consent?: ConsentCheckResult;
    suppression?: SuppressionCheckResult;
  }> {
    // Check suppression first (hard block)
    const suppressionCheck = await this.checkSuppression(email, phone);
    if (suppressionCheck.isSuppressed) {
      return {
        canSend: false,
        reason: `Contact suppressed: ${suppressionCheck.suppressionType}`,
        suppression: suppressionCheck
      };
    }

    // Check consent
    const consentCheck = await this.checkConsent(customerId, channel, consentType);
    if (!consentCheck.hasConsent) {
      return {
        canSend: false,
        reason: `No consent for ${channel} ${consentType}`,
        consent: consentCheck,
        suppression: suppressionCheck
      };
    }

    return {
      canSend: true,
      consent: consentCheck,
      suppression: suppressionCheck
    };
  }

  /**
   * Bulk record consent for new customers (e.g., during registration)
   */
  async recordBulkConsent(
    customerId: string,
    consents: Array<{
      channel: 'email' | 'sms';
      consentType: NotificationConsent['consentType'];
      consented: boolean;
    }>,
    source: NotificationConsent['consentSource'] = 'registration',
    ipAddress?: string,
    userAgent?: string
  ): Promise<NotificationConsent[]> {
    const results: NotificationConsent[] = [];

    for (const consent of consents) {
      const result = await this.recordConsent({
        customerId,
        channel: consent.channel,
        consentType: consent.consentType,
        consented: consent.consented,
        consentSource: source,
        ipAddress,
        userAgent
      });

      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private mapConsentRecord(data: any): NotificationConsent {
    return {
      id: data.id,
      customerId: data.customer_id,
      channel: data.channel,
      consentType: data.consent_type,
      consented: data.consented,
      consentSource: data.consent_source,
      consentTimestamp: data.consent_timestamp,
      consentIpAddress: data.consent_ip_address,
      consentUserAgent: data.consent_user_agent,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at,
      createdAt: data.created_at
    };
  }

  private mapSuppressionRecord(data: any): NotificationSuppression {
    return {
      id: data.id,
      email: data.email,
      phone: data.phone,
      suppressionType: data.suppression_type,
      suppressionReason: data.suppression_reason,
      suppressionSource: data.suppression_source,
      suppressedAt: data.suppressed_at,
      suppressedBy: data.suppressed_by,
      reactivationToken: data.reactivation_token,
      reactivatedAt: data.reactivated_at,
      reactivatedBy: data.reactivated_by,
      reactivationReason: data.reactivation_reason,
      createdAt: data.created_at
    };
  }
}