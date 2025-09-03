/**
 * Database Types
 * These interfaces represent the structure of our Supabase database tables
 */

import type Stripe from 'stripe'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'staff' | 'customer'
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'staff' | 'customer'
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
        }
        Update: {
          email?: string
          role?: 'admin' | 'staff' | 'customer'
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          profile_id: string
          specialties: string[] | null
          bio: string | null
          hire_date: string | null
          hourly_rate: number | null
          commission_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          specialties?: string[] | null
          bio?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          commission_rate?: number | null
          is_active?: boolean
        }
        Update: {
          specialties?: string[] | null
          bio?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          commission_rate?: number | null
          is_active?: boolean
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          duration_minutes: number
          price_cents: number
          category: string | null
          is_active: boolean
          requires_consultation: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          duration_minutes: number
          price_cents: number
          category?: string | null
          is_active?: boolean
          requires_consultation?: boolean
        }
        Update: {
          name?: string
          description?: string | null
          duration_minutes?: number
          price_cents?: number
          category?: string | null
          is_active?: boolean
          requires_consultation?: boolean
          updated_at?: string
        }
      }
      staff_services: {
        Row: {
          id: string
          staff_id: string
          service_id: string
          created_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          service_id: string
        }
        Update: {
          staff_id?: string
          service_id?: string
        }
      }
      appointments: {
        Row: {
          id: string
          customer_id: string
          staff_id: string
          service_id: string
          start_time: string
          end_time: string
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          staff_id: string
          service_id: string
          start_time: string
          end_time: string
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
        }
        Update: {
          staff_id?: string
          service_id?: string
          start_time?: string
          end_time?: string
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          updated_at?: string
        }
      }
      staff_availability: {
        Row: {
          id: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available?: boolean
        }
        Update: {
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_available?: boolean
          updated_at?: string
        }
      }
      staff_timeoff: {
        Row: {
          id: string
          staff_id: string
          start_date: string
          end_date: string
          reason: string | null
          is_approved: boolean
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          start_date: string
          end_date: string
          reason?: string | null
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
        }
        Update: {
          start_date?: string
          end_date?: string
          reason?: string | null
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: SettingValue // JSONB field - properly typed
          description: string | null
          category: string
          is_public: boolean
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: SettingValue
          description?: string | null
          category?: string
          is_public?: boolean
          updated_by?: string | null
        }
        Update: {
          value?: SettingValue
          description?: string | null
          category?: string
          is_public?: boolean
          updated_by?: string | null
          updated_at?: string
        }
      }
      media: {
        Row: {
          id: string
          filename: string
          original_filename: string
          file_path: string
          file_size: number
          mime_type: string
          storage_bucket: string
          title: string | null
          description: string | null
          tags: string[] | null
          category: string | null
          uploaded_by: string | null
          uploaded_at: string
          is_active: boolean
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          filename: string
          original_filename: string
          file_path: string
          file_size: number
          mime_type: string
          storage_bucket?: string
          title?: string | null
          description?: string | null
          tags?: string[] | null
          category?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
          is_active?: boolean
          is_public?: boolean
        }
        Update: {
          filename?: string
          original_filename?: string
          title?: string | null
          description?: string | null
          tags?: string[] | null
          category?: string | null
          is_active?: boolean
          is_public?: boolean
          updated_at?: string
        }
      }
      notification_queue: {
        Row: {
          id: string
          type: 'email' | 'sms'
          channel: 'appointment_reminder' | 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_reschedule' | 'staff_daily_schedule'
          recipient_id: string
          recipient_email: string | null
          recipient_phone: string | null
          subject: string | null
          template_name: string
          template_data: Record<string, unknown>
          scheduled_for: string
          status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
          attempts: number
          max_attempts: number
          last_attempt_at: string | null
          sent_at: string | null
          failed_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'email' | 'sms'
          channel: 'appointment_reminder' | 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_reschedule' | 'staff_daily_schedule'
          recipient_id: string
          recipient_email?: string | null
          recipient_phone?: string | null
          subject?: string | null
          template_name: string
          template_data: Record<string, unknown>
          scheduled_for: string
          status?: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
          attempts?: number
          max_attempts?: number
          last_attempt_at?: string | null
          sent_at?: string | null
          failed_at?: string | null
          error_message?: string | null
        }
        Update: {
          status?: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
          attempts?: number
          last_attempt_at?: string | null
          sent_at?: string | null
          failed_at?: string | null
          error_message?: string | null
          updated_at?: string
        }
      }
      notification_audit: {
        Row: {
          id: string
          notification_id: string
          event_type: 'queued' | 'sent' | 'failed' | 'cancelled' | 'retry'
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          notification_id: string
          event_type: 'queued' | 'sent' | 'failed' | 'cancelled' | 'retry'
          details?: Record<string, unknown> | null
        }
        Update: {
          // Audit records are immutable - no updates allowed
          [key: string]: never
        }
      }
      notification_templates: {
        Row: {
          id: string
          name: string
          type: 'email' | 'sms'
          channel: 'appointment_reminder' | 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_reschedule' | 'staff_daily_schedule'
          subject_template: string | null
          body_template: string
          variables: string[]
          is_active: boolean
          is_default: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'email' | 'sms'
          channel: 'appointment_reminder' | 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_reschedule' | 'staff_daily_schedule'
          subject_template?: string | null
          body_template: string
          variables?: string[]
          is_active?: boolean
          is_default?: boolean
          created_by?: string | null
        }
        Update: {
          name?: string
          subject_template?: string | null
          body_template?: string
          variables?: string[]
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          appointment_id: string
          customer_id: string
          stripe_payment_intent_id?: string
          stripe_charge_id?: string
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          amount_cents: number
          currency: string
          status: PaymentStatus
          payment_method_type: PaymentMethodType
          card_last4?: string
          card_brand?: string
          card_exp_month?: number
          card_exp_year?: number
          card_funding?: string
          requires_action: boolean
          client_secret?: string
          next_action?: Stripe.PaymentIntent.NextAction
          fee_cents: number
          net_amount_cents?: number
          application_fee_cents: number
          description?: string
          metadata: Record<string, unknown>
          receipt_email?: string
          receipt_url?: string
          created_by?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          customer_id: string
          stripe_payment_intent_id?: string
          stripe_charge_id?: string
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          amount_cents: number
          currency?: string
          status?: PaymentStatus
          payment_method_type?: PaymentMethodType
          card_last4?: string
          card_brand?: string
          card_exp_month?: number
          card_exp_year?: number
          card_funding?: string
          requires_action?: boolean
          client_secret?: string
          next_action?: Stripe.PaymentIntent.NextAction
          fee_cents?: number
          net_amount_cents?: number
          application_fee_cents?: number
          description?: string
          metadata?: Record<string, unknown>
          receipt_email?: string
          receipt_url?: string
          created_by?: string
        }
        Update: {
          stripe_payment_intent_id?: string
          stripe_charge_id?: string
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          amount_cents?: number
          currency?: string
          status?: PaymentStatus
          payment_method_type?: PaymentMethodType
          card_last4?: string
          card_brand?: string
          card_exp_month?: number
          card_exp_year?: number
          card_funding?: string
          requires_action?: boolean
          client_secret?: string
          next_action?: Stripe.PaymentIntent.NextAction
          fee_cents?: number
          net_amount_cents?: number
          application_fee_cents?: number
          description?: string
          metadata?: Record<string, unknown>
          receipt_email?: string
          receipt_url?: string
          updated_at?: string
        }
      }
      payment_events: {
        Row: {
          id: string
          payment_id: string
          event_type: PaymentEventType
          stripe_event_id?: string
          event_data: Record<string, unknown>
          amount_cents?: number
          status?: PaymentStatus
          processed: boolean
          processed_at?: string
          processing_error?: string
          idempotency_key?: string
          created_by?: string
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          event_type: PaymentEventType
          stripe_event_id?: string
          event_data?: Record<string, unknown>
          amount_cents?: number
          status?: PaymentStatus
          processed?: boolean
          processed_at?: string
          processing_error?: string
          idempotency_key?: string
          created_by?: string
        }
        Update: {
          event_data?: Record<string, unknown>
          amount_cents?: number
          status?: PaymentStatus
          processed?: boolean
          processed_at?: string
          processing_error?: string
        }
      }
      payment_reconciliation: {
        Row: {
          id: string
          reconciliation_date: string
          stripe_balance_transaction_id?: string
          stripe_payout_id?: string
          gross_amount_cents: number
          fee_amount_cents: number
          net_amount_cents: number
          currency: string
          reconciled: boolean
          reconciled_at?: string
          reconciliation_notes?: string
          payment_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reconciliation_date: string
          stripe_balance_transaction_id?: string
          stripe_payout_id?: string
          gross_amount_cents: number
          fee_amount_cents: number
          net_amount_cents: number
          currency?: string
          reconciled?: boolean
          reconciled_at?: string
          reconciliation_notes?: string
          payment_ids?: string[]
        }
        Update: {
          reconciliation_date?: string
          stripe_balance_transaction_id?: string
          stripe_payout_id?: string
          gross_amount_cents?: number
          fee_amount_cents?: number
          net_amount_cents?: number
          currency?: string
          reconciled?: boolean
          reconciled_at?: string
          reconciliation_notes?: string
          payment_ids?: string[]
          updated_at?: string
        }
      }
      admin_audit: {
        Row: {
          id: string
          action_type: string
          resource_type: string
          resource_id: string
          admin_id: string
          admin_email: string
          action_data: Record<string, unknown>
          reason?: string
          success: boolean
          error_message?: string
          ip_address?: string
          user_agent?: string
          session_id?: string
          created_at: string
        }
        Insert: {
          id?: string
          action_type: string
          resource_type: string
          resource_id: string
          admin_id: string
          admin_email: string
          action_data?: Record<string, unknown>
          reason?: string
          success: boolean
          error_message?: string
          ip_address?: string
          user_agent?: string
          session_id?: string
        }
        Update: {
          action_data?: Record<string, unknown>
          reason?: string
          success?: boolean
          error_message?: string
        }
      }
      payment_idempotency: {
        Row: {
          id: string
          idempotency_key: string
          request_hash: string
          endpoint: string
          method: string
          response_status?: number
          response_body?: Record<string, unknown>
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          request_hash: string
          endpoint: string
          method: string
          response_status?: number
          response_body?: Record<string, unknown>
          expires_at?: string
        }
        Update: {
          response_status?: number
          response_body?: Record<string, unknown>
          expires_at?: string
        }
      }
    }
    Views: {
      staff_with_profiles: {
        Row: {
          id: string
          profile_id: string
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          specialties: string[] | null
          bio: string | null
          hire_date: string | null
          hourly_rate: number | null
          commission_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      appointments_with_details: {
        Row: {
          id: string
          customer_id: string
          customer_email: string
          customer_first_name: string | null
          customer_last_name: string | null
          staff_id: string
          staff_first_name: string | null
          staff_last_name: string | null
          service_id: string
          service_name: string
          service_duration_minutes: number
          service_price_cents: number
          start_time: string
          end_time: string
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes: string | null
          created_at: string
        }
      }
    }
    Functions: {
      get_available_slots: {
        Args: {
          p_staff_id: string
          p_service_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: {
          start_time: string
          end_time: string
        }[]
      }
      check_appointment_conflicts: {
        Args: {
          p_staff_id: string
          p_start_time: string
          p_end_time: string
          p_exclude_appointment_id?: string
        }
        Returns: boolean
      }
    }
  }
}

// Helper types for common use cases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Staff = Database['public']['Tables']['staff']['Row']
export type StaffInsert = Database['public']['Tables']['staff']['Insert']
export type StaffUpdate = Database['public']['Tables']['staff']['Update']

export type Service = Database['public']['Tables']['services']['Row']
export type ServiceInsert = Database['public']['Tables']['services']['Insert']
export type ServiceUpdate = Database['public']['Tables']['services']['Update']

export type Appointment = Database['public']['Tables']['appointments']['Row']
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']

export type StaffAvailability = Database['public']['Tables']['staff_availability']['Row']
export type StaffAvailabilityInsert = Database['public']['Tables']['staff_availability']['Insert']
export type StaffAvailabilityUpdate = Database['public']['Tables']['staff_availability']['Update']

export type StaffTimeoff = Database['public']['Tables']['staff_timeoff']['Row']
export type StaffTimeoffInsert = Database['public']['Tables']['staff_timeoff']['Insert']
export type StaffTimeoffUpdate = Database['public']['Tables']['staff_timeoff']['Update']

export type Setting = Database['public']['Tables']['settings']['Row']
export type SettingInsert = Database['public']['Tables']['settings']['Insert']
export type SettingUpdate = Database['public']['Tables']['settings']['Update']

// Business-specific setting types
export interface DayHours {
  is_open: boolean
  start_time: string  // HH:MM format
  end_time: string    // HH:MM format
}

export interface OpeningHours {
  [key: string]: DayHours  // "0" to "6" for Sunday to Saturday
}

export interface BusinessSettings {
  opening_hours: OpeningHours
  max_advance_booking_days: number
  buffer_time_minutes: number
  business_name: string
  business_address: string
  business_phone: string
  business_email: string
}

export interface EmailSettings {
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  smtp_from_email: string
  smtp_from_name: string
  smtp_use_tls: boolean
}

export interface NotificationSettings {
  email_enabled: boolean
  sms_enabled: boolean
  reminder_hours_before: number
  send_confirmations: boolean
  send_cancellations: boolean
  send_daily_schedule: boolean
  daily_schedule_time: string  // HH:MM format
  retry_attempts: number
  retry_delay_minutes: number
}

export interface SmsSettings {
  twilio_account_sid: string
  twilio_auth_token: string
  twilio_phone_number: string
  enabled: boolean
}

export interface SettingsState {
  business: BusinessSettings
  email: EmailSettings
  notifications: NotificationSettings
  sms: SmsSettings
  loading: boolean
  error: string | null
}

// Union type for all possible setting values
export type SettingValue = 
  | OpeningHours
  | number
  | string
  | boolean
  | DayHours
  | Record<string, unknown>
  | unknown[]

// Typed settings by category
export type BusinessSettingKeys = keyof BusinessSettings
export type EmailSettingKeys = keyof EmailSettings
export type NotificationSettingKeys = keyof NotificationSettings
export type SmsSettingKeys = keyof SmsSettings

// Setting value mapping for type safety
export interface SettingValueMap {
  'opening_hours': OpeningHours
  'max_advance_booking_days': number
  'buffer_time_minutes': number
  'business_name': string
  'business_address': string
  'business_phone': string
  'business_email': string
  'smtp_host': string
  'smtp_port': number
  'smtp_username': string
  'smtp_password': string
  'smtp_from_email': string
  'smtp_from_name': string
  'smtp_use_tls': boolean
  'email_enabled': boolean
  'sms_enabled': boolean
  'reminder_hours_before': number
  'send_confirmations': boolean
  'send_cancellations': boolean
  'send_daily_schedule': boolean
  'daily_schedule_time': string
  'retry_attempts': number
  'retry_delay_minutes': number
  'twilio_account_sid': string
  'twilio_auth_token': string
  'twilio_phone_number': string
}

export type MediaFile = Database['public']['Tables']['media_files']['Row']
export type MediaFileInsert = Database['public']['Tables']['media_files']['Insert']
export type MediaFileUpdate = Database['public']['Tables']['media_files']['Update']

// Notification types
export type NotificationQueue = Database['public']['Tables']['notification_queue']['Row']
export type NotificationQueueInsert = Database['public']['Tables']['notification_queue']['Insert']
export type NotificationQueueUpdate = Database['public']['Tables']['notification_queue']['Update']

export type NotificationAudit = Database['public']['Tables']['notification_audit']['Row']
export type NotificationAuditInsert = Database['public']['Tables']['notification_audit']['Insert']

export type NotificationTemplate = Database['public']['Tables']['notification_templates']['Row']
export type NotificationTemplateInsert = Database['public']['Tables']['notification_templates']['Insert']
export type NotificationTemplateUpdate = Database['public']['Tables']['notification_templates']['Update']

// Notification enums
export type NotificationType = 'email' | 'sms'
export type NotificationChannel = 'appointment_reminder' | 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_reschedule' | 'staff_daily_schedule'
export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
export type NotificationAuditEvent = 'queued' | 'sent' | 'failed' | 'cancelled' | 'retry'

// View types
export type StaffWithProfile = Database['public']['Views']['staff_with_profiles']['Row']
export type AppointmentWithDetails = Database['public']['Views']['appointments_with_details']['Row']

// Utility types
export type UserRole = 'admin' | 'staff' | 'customer'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: unknown
  }
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Filter types
export interface AppointmentFilters extends PaginationParams {
  staffId?: string
  serviceId?: string
  status?: AppointmentStatus
  startDate?: string
  endDate?: string
  customerId?: string
}

export interface StaffFilters extends PaginationParams {
  isActive?: boolean
  serviceId?: string
  specialties?: string[]
}

export interface ServiceFilters extends PaginationParams {
  category?: string
  isActive?: boolean
  staffId?: string
}

export interface MediaFilters extends PaginationParams {
  category?: string
  tags?: string[]
  isPublic?: boolean
  isActive?: boolean
  mimeType?: string
}

export type Media = Database['public']['Tables']['media']['Row']
export type MediaInsert = Database['public']['Tables']['media']['Insert']
export type MediaUpdate = Database['public']['Tables']['media']['Update']

// Legacy compatibility
export type MediaFile = Media
export type MediaFileInsert = MediaInsert
export type MediaFileUpdate = MediaUpdate
export interface TimeSlot {
  start: string
  end: string
  available: boolean
  conflictReason?: string
}

export interface BusinessHours {
  dayOfWeek: number
  startTime: string
  endTime: string
  isOpen: boolean
}

export interface ConflictCheck {
  hasConflict: boolean
  conflictType?: 'staff_unavailable' | 'timeoff' | 'double_booking' | 'outside_hours'
  message?: string
}

// Analytics types
export interface KPIData {
  totalAppointments: number
  totalRevenue: number
  averageServiceTime: number
  bookingRate: number
  cancellationRate: number
  staffUtilization: Array<{
    staffId: string
    name: string
    utilization: number
    totalAppointments: number
    totalRevenue: number
  }>
  popularServices: Array<{
    serviceId: string
    name: string
    bookingCount: number
    revenue: number
  }>
  dailyStats: Array<{
    date: string
    appointments: number
    revenue: number
    newCustomers: number
  }>
}

// Payment types
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'succeeded'
  | 'requires_capture'
  | 'canceled'
  | 'failed'

export type PaymentMethodType = 
  | 'card'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay'
  | 'sepa_debit'
  | 'bancontact'
  | 'ideal'
  | 'cash'

export type PaymentEventType = 
  | 'payment_intent_created'
  | 'payment_method_attached'
  | 'payment_confirmed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_canceled'
  | 'payment_captured'
  | 'payment_refunded'
  | 'payment_disputed'
  | 'webhook_received'
  | 'manual_action'

export interface Payment {
  id: string
  appointment_id: string
  customer_id: string
  
  // Stripe identifiers
  stripe_payment_intent_id?: string
  stripe_charge_id?: string
  stripe_customer_id?: string
  stripe_payment_method_id?: string
  
  // Payment details
  amount_cents: number
  currency: string
  status: PaymentStatus
  payment_method_type: PaymentMethodType
  
  // Card information (PCI-compliant)
  card_last4?: string
  card_brand?: string
  card_exp_month?: number
  card_exp_year?: number
  card_funding?: string
  
  // Payment flow
  requires_action: boolean
  client_secret?: string
  next_action?: Stripe.PaymentIntent.NextAction
  
  // Financial details
  fee_cents: number
  net_amount_cents?: number
  application_fee_cents: number
  
  // Metadata
  description?: string
  metadata: Record<string, unknown>
  receipt_email?: string
  receipt_url?: string
  
  // Audit fields
  created_by?: string
  created_at: string
  updated_at: string
}

export interface PaymentEvent {
  id: string
  payment_id: string
  event_type: PaymentEventType
  stripe_event_id?: string
  event_data: Record<string, unknown>
  amount_cents?: number
  status?: PaymentStatus
  processed: boolean
  processed_at?: string
  processing_error?: string
  idempotency_key?: string
  created_by?: string
  created_at: string
}

export interface PaymentReconciliation {
  id: string
  reconciliation_date: string
  stripe_balance_transaction_id?: string
  stripe_payout_id?: string
  gross_amount_cents: number
  fee_amount_cents: number
  net_amount_cents: number
  currency: string
  reconciled: boolean
  reconciled_at?: string
  reconciliation_notes?: string
  payment_ids: string[]
  created_at: string
  updated_at: string
}

export interface AdminAudit {
  id: string
  action_type: string
  resource_type: string
  resource_id: string
  admin_id: string
  admin_email: string
  action_data: Record<string, unknown>
  reason?: string
  success: boolean
  error_message?: string
  ip_address?: string
  user_agent?: string
  session_id?: string
  created_at: string
}

export interface PaymentIdempotency {
  id: string
  idempotency_key: string
  request_hash: string
  endpoint: string
  method: string
  response_status?: number
  response_body?: Record<string, unknown>
  expires_at: string
  created_at: string
}

// Stripe-specific types
export interface StripeWebhookEvent {
  id: string
  object: 'event'
  api_version: string
  created: number
  data: {
    object: Stripe.PaymentIntent | Stripe.Charge | Stripe.SetupIntent | Stripe.Customer | unknown
    previous_attributes?: Record<string, unknown>
  }
  livemode: boolean
  pending_webhooks: number
  request: {
    id: string | null
    idempotency_key: string | null
  }
  type: string
}

export interface PaymentIntentCreateRequest {
  appointment_id: string
  amount_cents: number
  currency?: string
  payment_method_type?: PaymentMethodType
  description?: string
  metadata?: Record<string, unknown>
  capture_method?: 'automatic' | 'manual'
}

export interface PaymentSummary {
  period: {
    start_date: string
    end_date: string
  }
  total_amount_cents: number
  total_fee_cents: number
  net_amount_cents: number
  transaction_count: number
  successful_payments: number
  failed_payments: number
  pending_payments: number
  refunded_amount_cents: number
  by_payment_method: Record<PaymentMethodType, {
    count: number
    amount_cents: number
  }>
}