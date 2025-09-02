/**
 * Database Types
 * These interfaces represent the structure of our Supabase database tables
 */

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

export interface SettingsState {
  business: BusinessSettings
  email: EmailSettings
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
}

export type MediaFile = Database['public']['Tables']['media_files']['Row']
export type MediaFileInsert = Database['public']['Tables']['media_files']['Insert']
export type MediaFileUpdate = Database['public']['Tables']['media_files']['Update']

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