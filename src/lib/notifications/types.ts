import { NotificationChannel, NotificationType } from '../types/database'

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