/**
 * Business Settings Types
 * Defines TypeScript interfaces for business configuration settings
 */

export interface OpeningHours {
  [key: string]: {
    enabled: boolean
    start: string // HH:MM format
    end: string   // HH:MM format
  }
}

export interface SMTPSettings {
  host: string
  port: number
  user: string
  password: string
  from_email: string
  from_name: string
}

export interface BusinessInfo {
  name: string
  address: string
  phone: string
  email: string
}

export interface BookingSettings {
  window_days: number
  buffer_time_minutes: number
  cancellation_hours: number
}

// Union type for all possible setting values
export type SettingValue = 
  | string
  | number
  | boolean
  | OpeningHours
  | SMTPSettings
  | BusinessInfo
  | BookingSettings

// Settings configuration mapping
export interface SettingsConfig {
  'business.opening_hours': OpeningHours
  'business.name': string
  'business.address': string  
  'business.phone': string
  'business.email': string
  'booking.window_days': number
  'booking.buffer_time_minutes': number
  'booking.cancellation_hours': number
  'smtp.host': string
  'smtp.port': number
  'smtp.user': string
  'smtp.password': string
  'smtp.from_email': string
  'smtp.from_name': string
}

export type SettingKey = keyof SettingsConfig

export interface Setting {
  id: string
  key: SettingKey
  value: SettingValue
  description: string | null
  category: string
  is_sensitive: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface SettingUpdate {
  value: SettingValue
  description?: string
  category?: string
  is_sensitive?: boolean
}

// For form handling
export interface SettingsFormData {
  business: {
    name: string
    address: string
    phone: string
    email: string
    opening_hours: OpeningHours
  }
  booking: {
    window_days: number
    buffer_time_minutes: number
    cancellation_hours: number
  }
  smtp: {
    host: string
    port: number
    user: string
    password: string
    from_email: string
    from_name: string
  }
}

// Default opening hours structure
export const defaultOpeningHours: OpeningHours = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: true, start: '09:00', end: '18:00' },
  sunday: { enabled: false, start: '09:00', end: '18:00' }
}

// Settings categories for grouping
export const settingsCategories = {
  business: 'Business Information',
  booking: 'Booking Configuration', 
  email: 'Email & Notifications'
} as const

export type SettingCategory = keyof typeof settingsCategories