import { NotificationChannel, NotificationType } from '../types/database'

// Core type definitions
export type Channel = 'email' | 'sms'
export type NotificationChannelType = NotificationChannel
export type NotificationTypeEnum = NotificationType

// Budget and cost tracking types
export interface BudgetLimits {
  monthly_email_limit?: number
  monthly_sms_limit?: number
  budget_warning_threshold?: number
  budget_hard_cap?: number
}

export interface BudgetUsage {
  scope: 'global' | 'location' | 'user'
  scope_id: string
  email_count: number
  sms_count: number
  email_cost: number
  sms_cost: number
  month: number
  year: number
  usage_percentage: number
  warning_sent: boolean
  hard_cap_reached: boolean
}

export interface BudgetCheckResult {
  canSend: boolean
  reason?: string
  usage_percentage: number
  limits: BudgetLimits
  current_usage: BudgetUsage
}

export interface BudgetPolicy {
  cap_behavior: 'skip' | 'delay'
  warning_behavior: 'continue' | 'throttle'
  warning_threshold: number
  hard_cap_threshold: number
}

// Settings configuration types
export interface SettingsConfig {
  scope: 'global' | 'location' | 'user'
  scope_id: string
  email_enabled: boolean
  sms_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone?: string
  budget_limits: BudgetLimits
  budget_policy: BudgetPolicy
  lead_times: {
    appointment_reminder: number
    appointment_confirmation: number
    staff_daily_schedule: number
  }
  templates: Record<string, string>
}

// Dead Letter Queue types
export interface DLQItem {
  id: string
  notification_id: string
  channel: Channel
  recipient: string
  failure_type: 'hard_bounce' | 'soft_bounce' | 'rate_limited' | 'invalid_recipient' | 'provider_error' | 'timeout' | 'unknown'
  failure_reason: string
  failure_code?: string
  attempts: number
  max_attempts: number
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
  resolved_at?: string
  resolved_by?: string
  resolution_action?: 'retry' | 'manual_retry' | 'skip' | 'update_recipient'
  resolution_notes?: string
}

export interface DLQStats {
  total_items: number
  items_by_type: Record<string, number>
  items_by_channel: Record<Channel, number>
  recent_failures: number
  resolution_rate: number
}

// Provider webhook types
export interface TwilioStatusPayload {
  MessageSid: string
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed'
  ErrorCode?: string
  ErrorMessage?: string
  To: string
  From: string
  Body?: string
  NumSegments?: string
  NumMedia?: string
  DateCreated?: string
  DateSent?: string
  DateUpdated?: string
  AccountSid: string
}

export interface SMTPBounceEvent {
  type: 'bounce' | 'complaint' | 'delivery'
  bounce_type?: 'hard' | 'soft'
  bounce_subtype?: string
  recipient: string
  timestamp: string
  feedback_id?: string
  user_agent?: string
  arrival_date?: string
  reporting_mta?: string
  source_ip?: string
  complaint_feedback_type?: string
  smtp_response?: string
  status_code?: string
  diagnostic_code?: string
}

export interface WebhookEvent {
  id: string
  provider: 'twilio' | 'ses' | 'mailgun' | 'sendgrid' | 'generic'
  event_type: string
  message_id: string
  recipient: string
  status: string
  timestamp: string
  payload: Record<string, unknown>
  processed: boolean
  processed_at?: string
  error?: string
  idempotency_key: string
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: { status: string; latency?: number }
    queue: { status: string; pending_count: number; failed_count: number }
    budget: { status: string; email_usage: number; sms_usage: number }
    dlq: { status: string; total_items: number; recent_failures: number }
    providers: {
      smtp: { status: string; last_check?: string }
      sms: { status: string; last_check?: string }
    }
  }
  timestamp: string
}

// Admin API types
export interface AdminBudgetResponse {
  scopes: Array<{
    scope: string
    scope_id: string
    usage: BudgetUsage
    limits: BudgetLimits
    status: 'healthy' | 'warning' | 'exceeded'
  }>
  global_stats: {
    total_email_sent: number
    total_sms_sent: number
    total_cost: number
    average_usage_percentage: number
  }
}

export interface AdminDLQResponse {
  items: DLQItem[]
  stats: DLQStats
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

// Notification data interfaces
export interface NotificationData {
  id: string
  type: NotificationType
  channel: NotificationChannel
  recipientId: string
  recipientEmail?: string
  recipientPhone?: string
  templateData: Record<string, unknown>
  scheduledFor: Date
}

export interface EmailNotificationData extends NotificationData {
  type: 'email'
  subject: string
  htmlBody: string
  textBody?: string
}

export interface SmsNotificationData extends NotificationData {
  type: 'sms'
  message: string
}

// Template data interfaces for different notification types
export interface AppointmentReminderData {
  customerName: string
  appointmentDate: string
  appointmentTime: string
  serviceName: string
  staffName: string
  salonName: string
  salonPhone: string
  salonAddress: string
  appointmentId: string
}

export interface AppointmentConfirmationData {
  customerName: string
  appointmentDate: string
  appointmentTime: string
  serviceName: string
  staffName: string
  salonName: string
  salonPhone: string
  salonAddress: string
  appointmentId: string
  totalPrice: string
}

export interface AppointmentCancellationData {
  customerName: string
  appointmentDate: string
  appointmentTime: string
  serviceName: string
  staffName: string
  salonName: string
  cancellationReason?: string
  appointmentId: string
}

export interface AppointmentRescheduleData {
  customerName: string
  oldAppointmentDate: string
  oldAppointmentTime: string
  newAppointmentDate: string
  newAppointmentTime: string
  serviceName: string
  staffName: string
  salonName: string
  appointmentId: string
}

export interface StaffDailyScheduleData {
  staffName: string
  date: string
  appointments: Array<{
    time: string
    customerName: string
    serviceName: string
    duration: string
    notes?: string
  }>
  totalAppointments: number
  firstAppointment?: string
  lastAppointment?: string
}

// Union type for all template data
export type NotificationTemplateData = 
  | AppointmentReminderData
  | AppointmentConfirmationData
  | AppointmentCancellationData
  | AppointmentRescheduleData
  | StaffDailyScheduleData

// Notification result interfaces
export interface NotificationResult {
  success: boolean
  messageId?: string
  error?: string
  attempts: number
  cancelled?: boolean
}

export interface NotificationBatch {
  notifications: NotificationData[]
  totalCount: number
  successCount: number
  failureCount: number
  results: NotificationResult[]
}

// Settings interfaces
export interface NotificationChannelSettings {
  enabled: boolean
  template: string
  subject?: string
}

export interface NotificationPreferences {
  email: {
    appointment_reminder: NotificationChannelSettings
    appointment_confirmation: NotificationChannelSettings
    appointment_cancellation: NotificationChannelSettings
    appointment_reschedule: NotificationChannelSettings
    staff_daily_schedule: NotificationChannelSettings
  }
  sms: {
    appointment_reminder: NotificationChannelSettings
    appointment_confirmation: NotificationChannelSettings
    appointment_cancellation: NotificationChannelSettings
    appointment_reschedule: NotificationChannelSettings
  }
}

// Error types
export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateError'
  }
}