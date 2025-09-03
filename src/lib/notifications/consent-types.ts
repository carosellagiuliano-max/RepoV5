export interface NotificationConsent {
  id: string;
  customerId: string;
  channel: 'email' | 'sms';
  consentType: 'appointment_reminders' | 'appointment_confirmations' | 'appointment_changes' | 'marketing' | 'daily_schedules';
  consented: boolean;
  consentSource: 'registration' | 'booking_form' | 'admin_update' | 'unsubscribe_page' | 'preference_update';
  consentTimestamp: string;
  consentIpAddress?: string;
  consentUserAgent?: string;
  updatedBy?: string;
  updatedAt: string;
  createdAt: string;
}

export interface NotificationSuppression {
  id: string;
  email?: string;
  phone?: string;
  suppressionType: 'unsubscribe' | 'bounce' | 'spam' | 'invalid' | 'admin_block';
  suppressionReason?: string;
  suppressionSource: 'user_unsubscribe' | 'bounce_handler' | 'spam_report' | 'admin_action' | 'provider_feedback';
  suppressedAt: string;
  suppressedBy?: string;
  reactivationToken?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
  reactivationReason?: string;
  createdAt: string;
}

export interface UnsubscribeToken {
  id: string;
  token: string;
  customerId: string;
  email?: string;
  phone?: string;
  channel?: 'email' | 'sms';
  notificationTypes: string[];
  expiresAt: string;
  usedAt?: string;
  usedFromIp?: string;
  createdAt: string;
}

export interface ConsentCheckResult {
  hasConsent: boolean;
  consentRecord?: NotificationConsent;
}

export interface SuppressionCheckResult {
  isSuppressed: boolean;
  suppressionType?: string;
  suppressionReason?: string;
}

export interface UnsubscribeResult {
  success: boolean;
  message: string;
  customerId?: string;
  affectedChannels: string[];
}

export interface ConsentRequest {
  customerId: string;
  channel: 'email' | 'sms';
  consentType: NotificationConsent['consentType'];
  consented: boolean;
  consentSource: NotificationConsent['consentSource'];
  ipAddress?: string;
  userAgent?: string;
  updatedBy?: string;
}

export interface SuppressionRequest {
  email?: string;
  phone?: string;
  suppressionType: NotificationSuppression['suppressionType'];
  suppressionReason?: string;
  suppressionSource: NotificationSuppression['suppressionSource'];
  suppressedBy?: string;
}

export interface DedupeConfig {
  appointmentId?: string;
  customerId: string;
  notificationType: string;
  timeWindowHours?: number;
}

export interface NotificationSettings {
  // Global settings
  emailEnabled: boolean;
  smsEnabled: boolean;
  
  // Timing settings
  reminderHours: number;
  sendConfirmations: boolean;
  sendCancellations: boolean;
  sendDailySchedule: boolean;
  dailyScheduleTime: string;
  
  // Quiet hours (in Europe/Zurich timezone)
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g., "21:00"
  quietHoursEnd: string;   // e.g., "08:00"
  timezone: string;        // e.g., "Europe/Zurich"
  
  // Budget controls
  monthlyEmailLimit?: number;
  monthlySmsLimit?: number;
  budgetWarningThreshold: number; // 0.8 for 80%
  budgetHardCap: boolean;
  budgetCapBehavior: 'skip' | 'delay';
  budgetWarningBehavior: 'continue' | 'throttle';
  
  // Retry settings
  retryAttempts: number;
  retryDelayMinutes: number;
  
  // Fallback settings
  smsFallbackToEmail: boolean;
  emailFallbackToSms: boolean;
  
  // Short window policy
  shortWindowPolicy: 'send' | 'skip';
  shortWindowThresholdHours: number;
}