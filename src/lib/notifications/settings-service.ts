import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NotificationSettings } from './consent-types';

export interface NotificationSettingsDB {
  id: string;
  scope: 'global' | 'location' | 'user';
  scopeId?: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  reminderHoursBefore: number;
  sendConfirmations: boolean;
  sendCancellations: boolean;
  sendDailySchedule: boolean;
  dailyScheduleTime: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  monthlyEmailLimit?: number;
  monthlySmsLimit?: number;
  budgetWarningThreshold: number;
  budgetHardCap: boolean;
  budgetCapBehavior: 'skip' | 'delay';
  budgetWarningBehavior: 'continue' | 'throttle';
  costPerEmailCents: number;
  costPerSmsCents: number;
  retryAttempts: number;
  retryDelayMinutes: number;
  maxQueueAgeHours: number;
  smsFallbackToEmail: boolean;
  emailFallbackToSms: boolean;
  shortWindowPolicy: 'send' | 'skip';
  shortWindowThresholdHours: number;
  rateLimitPerMinute: number;
  batchSize: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTracking {
  id: string;
  year: number;
  month: number;
  scope: 'global' | 'location' | 'user';
  scopeId?: string;
  emailCount: number;
  smsCount: number;
  emailCostCents: number;
  smsCostCents: number;
  emailBudgetLimit?: number;
  smsBudgetLimit?: number;
  emailBudgetUsedPct: number;
  smsBudgetUsedPct: number;
  warningSentAt?: string;
  hardCapReachedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostTracking {
  id: string;
  notificationId: string;
  provider: string;
  costCents: number;
  currency: string;
  providerMessageId?: string;
  providerCostDetails?: any;
  billingYear: number;
  billingMonth: number;
  createdAt: string;
}

export interface BudgetCheckResult {
  canSend: boolean;
  reason?: string;
  usagePct: number;
  limitReached: boolean;
}

export interface BudgetAlert {
  type: 'warning' | 'limit_reached';
  scope: string;
  scopeId?: string;
  notificationType: 'email' | 'sms';
  currentUsage: number;
  limit: number;
  usagePercentage: number;
  timestamp: Date;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'error';
  checks: {
    email: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: Date;
      details?: any;
    };
    sms: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: Date;
      details?: any;
    };
    database: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: Date;
      details?: any;
    };
    queue: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: Date;
      pendingCount: number;
      failedCount: number;
    };
    budget: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: Date;
      emailUsage: number;
      smsUsage: number;
    };
  };
}

/**
 * Service for managing notification settings and budget controls
 */
export class NotificationSettingsService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get notification settings with fallback hierarchy
   */
  async getSettings(
    scope: 'global' | 'location' | 'user' = 'global',
    scopeId?: string
  ): Promise<NotificationSettings> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_notification_settings', {
          p_scope: scope,
          p_scope_id: scopeId || null
        });

      if (error) {
        console.error('Error fetching notification settings:', error);
        return this.getDefaultSettings();
      }

      // Convert database format to application format
      const settings: NotificationSettings = this.getDefaultSettings();
      
      if (data) {
        data.forEach((item: any) => {
          switch (item.setting_key) {
            case 'email_enabled':
              settings.emailEnabled = item.setting_value === 'true';
              break;
            case 'sms_enabled':
              settings.smsEnabled = item.setting_value === 'true';
              break;
            // Add more settings as needed
          }
        });
      }

      return settings;
    } catch (error) {
      console.error('Error in getSettings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(
    settings: Partial<NotificationSettings>,
    scope: 'global' | 'location' | 'user' = 'global',
    scopeId?: string,
    updatedBy?: string
  ): Promise<NotificationSettingsDB | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_settings')
        .upsert({
          scope,
          scope_id: scopeId,
          email_enabled: settings.emailEnabled,
          sms_enabled: settings.smsEnabled,
          reminder_hours_before: settings.reminderHours,
          send_confirmations: settings.sendConfirmations,
          send_cancellations: settings.sendCancellations,
          send_daily_schedule: settings.sendDailySchedule,
          daily_schedule_time: settings.dailyScheduleTime,
          quiet_hours_enabled: settings.quietHoursEnabled,
          quiet_hours_start: settings.quietHoursStart,
          quiet_hours_end: settings.quietHoursEnd,
          timezone: settings.timezone,
          monthly_email_limit: settings.monthlyEmailLimit,
          monthly_sms_limit: settings.monthlySmsLimit,
          budget_warning_threshold: settings.budgetWarningThreshold,
          budget_hard_cap: settings.budgetHardCap,
          budget_cap_behavior: settings.budgetCapBehavior || 'skip',
          budget_warning_behavior: settings.budgetWarningBehavior || 'continue',
          cost_per_email_cents: 0, // Usually free
          cost_per_sms_cents: 5,   // ~5 cents per SMS
          retry_attempts: settings.retryAttempts,
          retry_delay_minutes: settings.retryDelayMinutes || 15,
          max_queue_age_hours: 48,
          sms_fallback_to_email: settings.smsFallbackToEmail,
          email_fallback_to_sms: settings.emailFallbackToSms,
          short_window_policy: settings.shortWindowPolicy,
          short_window_threshold_hours: settings.shortWindowThresholdHours,
          rate_limit_per_minute: 60,
          batch_size: 50,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        return null;
      }

      return this.mapSettingsRecord(data);
    } catch (error) {
      console.error('Error in updateSettings:', error);
      return null;
    }
  }

  /**
   * Check budget limits before sending notification
   */
  async checkBudgetLimit(
    notificationType: 'email' | 'sms',
    scope: 'global' | 'location' | 'user' = 'global',
    scopeId?: string
  ): Promise<BudgetCheckResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_budget_limit', {
          p_notification_type: notificationType,
          p_scope: scope,
          p_scope_id: scopeId || null
        })
        .single();

      if (error) {
        console.error('Error checking budget limit:', error);
        return {
          canSend: true, // Fail open
          usagePct: 0,
          limitReached: false
        };
      }

      return {
        canSend: data.can_send,
        reason: data.reason,
        usagePct: data.usage_pct || 0,
        limitReached: data.limit_reached || false
      };
    } catch (error) {
      console.error('Error in checkBudgetLimit:', error);
      return {
        canSend: true, // Fail open
        usagePct: 0,
        limitReached: false
      };
    }
  }

  /**
   * Get current month's budget tracking
   */
  async getBudgetTracking(
    scope: 'global' | 'location' | 'user' = 'global',
    scopeId?: string,
    year?: number,
    month?: number
  ): Promise<BudgetTracking | null> {
    try {
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;

      const { data, error } = await this.supabase
        .from('notification_budget_tracking')
        .select('*')
        .eq('scope', scope)
        .eq('year', targetYear)
        .eq('month', targetMonth)
        .eq('scope_id', scopeId || null)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('Error fetching budget tracking:', error);
        return null;
      }

      return data ? this.mapBudgetTrackingRecord(data) : null;
    } catch (error) {
      console.error('Error in getBudgetTracking:', error);
      return null;
    }
  }

  /**
   * Get cost tracking for a period
   */
  async getCostTracking(
    year: number,
    month: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<CostTracking[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_cost_tracking')
        .select('*')
        .eq('billing_year', year)
        .eq('billing_month', month)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching cost tracking:', error);
        return [];
      }

      return data.map(this.mapCostTrackingRecord);
    } catch (error) {
      console.error('Error in getCostTracking:', error);
      return [];
    }
  }

  /**
   * Generate budget alerts for admin dashboard
   */
  async getBudgetAlerts(
    scope: 'global' | 'location' | 'user' = 'global',
    scopeId?: string
  ): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];

    try {
      const settings = await this.getSettings(scope, scopeId);
      const tracking = await this.getBudgetTracking(scope, scopeId);

      if (!tracking) {
        return alerts;
      }

      // Check email budget
      if (settings.monthlyEmailLimit && tracking.emailCount > 0) {
        const usagePercentage = (tracking.emailCount / settings.monthlyEmailLimit) * 100;
        
        if (usagePercentage >= settings.budgetWarningThreshold * 100) {
          alerts.push({
            type: usagePercentage >= 100 ? 'limit_reached' : 'warning',
            scope,
            scopeId,
            notificationType: 'email',
            currentUsage: tracking.emailCount,
            limit: settings.monthlyEmailLimit,
            usagePercentage,
            timestamp: new Date()
          });
        }
      }

      // Check SMS budget
      if (settings.monthlySmsLimit && tracking.smsCount > 0) {
        const usagePercentage = (tracking.smsCount / settings.monthlySmsLimit) * 100;
        
        if (usagePercentage >= settings.budgetWarningThreshold * 100) {
          alerts.push({
            type: usagePercentage >= 100 ? 'limit_reached' : 'warning',
            scope,
            scopeId,
            notificationType: 'sms',
            currentUsage: tracking.smsCount,
            limit: settings.monthlySmsLimit,
            usagePercentage,
            timestamp: new Date()
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('Error generating budget alerts:', error);
      return alerts;
    }
  }

  /**
   * Perform health checks on notification system
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const healthStatus: HealthStatus = {
      overall: 'healthy',
      checks: {
        email: {
          status: 'healthy',
          message: 'Email service operational',
          lastCheck: new Date()
        },
        sms: {
          status: 'healthy',
          message: 'SMS service operational',
          lastCheck: new Date()
        },
        database: {
          status: 'healthy',
          message: 'Database connection healthy',
          lastCheck: new Date()
        },
        queue: {
          status: 'healthy',
          message: 'Queue processing normally',
          lastCheck: new Date(),
          pendingCount: 0,
          failedCount: 0
        },
        budget: {
          status: 'healthy',
          message: 'Budget usage within limits',
          lastCheck: new Date(),
          emailUsage: 0,
          smsUsage: 0
        }
      }
    };

    try {
      // Check database connection
      await this.checkDatabaseHealth(healthStatus);
      
      // Check notification queue status
      await this.checkQueueHealth(healthStatus);
      
      // Check budget status
      await this.checkBudgetHealth(healthStatus);
      
      // Check email/SMS service health (basic connectivity)
      await this.checkServiceHealth(healthStatus);

      // Determine overall status
      const statuses = Object.values(healthStatus.checks).map(check => check.status);
      if (statuses.includes('error')) {
        healthStatus.overall = 'error';
      } else if (statuses.includes('warning')) {
        healthStatus.overall = 'warning';
      }

      return healthStatus;
    } catch (error) {
      console.error('Error performing health check:', error);
      healthStatus.overall = 'error';
      return healthStatus;
    }
  }

  private async checkDatabaseHealth(healthStatus: HealthStatus): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notification_queue')
        .select('id')
        .limit(1);

      if (error) {
        healthStatus.checks.database.status = 'error';
        healthStatus.checks.database.message = `Database error: ${error.message}`;
      }
    } catch (error) {
      healthStatus.checks.database.status = 'error';
      healthStatus.checks.database.message = 'Database connection failed';
    }
  }

  private async checkQueueHealth(healthStatus: HealthStatus): Promise<void> {
    try {
      const { data: pendingData, error: pendingError } = await this.supabase
        .from('notification_queue')
        .select('id')
        .eq('status', 'pending');

      const { data: failedData, error: failedError } = await this.supabase
        .from('notification_queue')
        .select('id')
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (pendingError || failedError) {
        healthStatus.checks.queue.status = 'warning';
        healthStatus.checks.queue.message = 'Could not check queue status';
        return;
      }

      const pendingCount = pendingData?.length || 0;
      const failedCount = failedData?.length || 0;

      healthStatus.checks.queue.pendingCount = pendingCount;
      healthStatus.checks.queue.failedCount = failedCount;

      if (pendingCount > 1000) {
        healthStatus.checks.queue.status = 'warning';
        healthStatus.checks.queue.message = `High pending count: ${pendingCount}`;
      } else if (failedCount > 100) {
        healthStatus.checks.queue.status = 'warning';
        healthStatus.checks.queue.message = `High failed count in last 24h: ${failedCount}`;
      }
    } catch (error) {
      healthStatus.checks.queue.status = 'error';
      healthStatus.checks.queue.message = 'Queue health check failed';
    }
  }

  private async checkBudgetHealth(healthStatus: HealthStatus): Promise<void> {
    try {
      const alerts = await this.getBudgetAlerts();
      const limitReachedAlerts = alerts.filter(a => a.type === 'limit_reached');
      const warningAlerts = alerts.filter(a => a.type === 'warning');

      if (limitReachedAlerts.length > 0) {
        healthStatus.checks.budget.status = 'error';
        healthStatus.checks.budget.message = `Budget limits reached: ${limitReachedAlerts.length} services`;
      } else if (warningAlerts.length > 0) {
        healthStatus.checks.budget.status = 'warning';
        healthStatus.checks.budget.message = `Budget warnings: ${warningAlerts.length} services`;
      }

      // Get current usage percentages
      const tracking = await this.getBudgetTracking();
      if (tracking) {
        healthStatus.checks.budget.emailUsage = tracking.emailBudgetUsedPct;
        healthStatus.checks.budget.smsUsage = tracking.smsBudgetUsedPct;
      }
    } catch (error) {
      healthStatus.checks.budget.status = 'warning';
      healthStatus.checks.budget.message = 'Budget health check failed';
    }
  }

  private async checkServiceHealth(healthStatus: HealthStatus): Promise<void> {
    // This would be expanded to actually test SMTP/Twilio connectivity
    // For now, just check if settings exist
    try {
      const settings = await this.getSettings();
      
      if (settings.emailEnabled) {
        // In a real implementation, you'd test SMTP connection
        healthStatus.checks.email.message = 'Email service configured';
      } else {
        healthStatus.checks.email.status = 'warning';
        healthStatus.checks.email.message = 'Email service disabled';
      }

      if (settings.smsEnabled) {
        // In a real implementation, you'd test Twilio connection
        healthStatus.checks.sms.message = 'SMS service configured';
      } else {
        healthStatus.checks.sms.status = 'warning';
        healthStatus.checks.sms.message = 'SMS service disabled';
      }
    } catch (error) {
      healthStatus.checks.email.status = 'warning';
      healthStatus.checks.sms.status = 'warning';
    }
  }

  private getDefaultSettings(): NotificationSettings {
    return {
      emailEnabled: true,
      smsEnabled: false,
      reminderHours: 24,
      sendConfirmations: true,
      sendCancellations: true,
      sendDailySchedule: true,
      dailyScheduleTime: '08:00',
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      timezone: 'Europe/Zurich',
      budgetWarningThreshold: 0.80,
      budgetHardCap: true,
      budgetCapBehavior: 'skip',
      budgetWarningBehavior: 'continue',
      retryAttempts: 3,
      retryDelayMinutes: 15,
      smsFallbackToEmail: false,
      emailFallbackToSms: false,
      shortWindowPolicy: 'send',
      shortWindowThresholdHours: 6
    };
  }

  private mapSettingsRecord(data: any): NotificationSettingsDB {
    return {
      id: data.id,
      scope: data.scope,
      scopeId: data.scope_id,
      emailEnabled: data.email_enabled,
      smsEnabled: data.sms_enabled,
      reminderHoursBefore: data.reminder_hours_before,
      sendConfirmations: data.send_confirmations,
      sendCancellations: data.send_cancellations,
      sendDailySchedule: data.send_daily_schedule,
      dailyScheduleTime: data.daily_schedule_time,
      quietHoursEnabled: data.quiet_hours_enabled,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      timezone: data.timezone,
      monthlyEmailLimit: data.monthly_email_limit,
      monthlySmsLimit: data.monthly_sms_limit,
      budgetWarningThreshold: data.budget_warning_threshold,
      budgetHardCap: data.budget_hard_cap,
      budgetCapBehavior: data.budget_cap_behavior || 'skip',
      budgetWarningBehavior: data.budget_warning_behavior || 'continue',
      costPerEmailCents: data.cost_per_email_cents,
      costPerSmsCents: data.cost_per_sms_cents,
      retryAttempts: data.retry_attempts,
      retryDelayMinutes: data.retry_delay_minutes,
      maxQueueAgeHours: data.max_queue_age_hours,
      smsFallbackToEmail: data.sms_fallback_to_email,
      emailFallbackToSms: data.email_fallback_to_sms,
      shortWindowPolicy: data.short_window_policy,
      shortWindowThresholdHours: data.short_window_threshold_hours,
      rateLimitPerMinute: data.rate_limit_per_minute,
      batchSize: data.batch_size,
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapBudgetTrackingRecord(data: any): BudgetTracking {
    return {
      id: data.id,
      year: data.year,
      month: data.month,
      scope: data.scope,
      scopeId: data.scope_id,
      emailCount: data.email_count,
      smsCount: data.sms_count,
      emailCostCents: data.email_cost_cents,
      smsCostCents: data.sms_cost_cents,
      emailBudgetLimit: data.email_budget_limit,
      smsBudgetLimit: data.sms_budget_limit,
      emailBudgetUsedPct: data.email_budget_used_pct,
      smsBudgetUsedPct: data.sms_budget_used_pct,
      warningSentAt: data.warning_sent_at,
      hardCapReachedAt: data.hard_cap_reached_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapCostTrackingRecord(data: any): CostTracking {
    return {
      id: data.id,
      notificationId: data.notification_id,
      provider: data.provider,
      costCents: data.cost_cents,
      currency: data.currency,
      providerMessageId: data.provider_message_id,
      providerCostDetails: data.provider_cost_details,
      billingYear: data.billing_year,
      billingMonth: data.billing_month,
      createdAt: data.created_at
    };
  }
}