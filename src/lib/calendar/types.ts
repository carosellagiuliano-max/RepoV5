/**
 * Calendar Integration Types
 * Types for iCal feeds and Google Calendar sync
 */

export interface CalendarToken {
  id: string
  staff_id: string
  token_hash: string
  feed_type: 'ical' | 'google'
  is_active: boolean
  expires_at: string | null
  last_accessed_at: string | null
  created_at: string
  updated_at: string
}

export interface CalendarTokenInsert {
  staff_id: string
  token_hash: string
  feed_type: 'ical' | 'google'
  is_active?: boolean
  expires_at?: string | null
}

export interface CalendarTokenUpdate {
  is_active?: boolean
  expires_at?: string | null
  last_accessed_at?: string | null
  updated_at?: string
}

export interface GoogleCalendarMapping {
  id: string
  staff_id: string
  google_calendar_id: string
  google_access_token: string // Encrypted
  google_refresh_token: string | null // Encrypted
  token_expires_at: string | null
  sync_enabled: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface GoogleCalendarMappingInsert {
  staff_id: string
  google_calendar_id: string
  google_access_token: string
  google_refresh_token?: string | null
  token_expires_at?: string | null
  sync_enabled?: boolean
}

export interface GoogleCalendarMappingUpdate {
  google_access_token?: string
  google_refresh_token?: string | null
  token_expires_at?: string | null
  sync_enabled?: boolean
  last_sync_at?: string | null
  updated_at?: string
}

// iCal Event representation
export interface ICalEvent {
  uid: string
  summary: string
  description?: string
  start: string // ISO 8601 format
  end: string // ISO 8601 format
  location?: string
  organizer?: {
    name: string
    email: string
  }
  attendee?: {
    name: string
    email: string
  }
  status: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'
  created: string
  lastModified: string
}

// iCal Feed configuration
export interface ICalFeedConfig {
  title: string
  description: string
  timezone: string
  refreshInterval: number // in minutes
}

// Google Calendar Event
export interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: string
  attendees?: Array<{
    email: string
    displayName?: string
  }>
  status: 'tentative' | 'confirmed' | 'cancelled'
  source?: {
    title: string
    url: string
  }
}

// Sync operation results
export interface SyncResult {
  success: boolean
  eventsCreated: number
  eventsUpdated: number
  eventsDeleted: number
  errors: string[]
}

// Calendar feed request
export interface CalendarFeedRequest {
  token: string
  format?: 'ical'
  timezone?: string
}

// Staff calendar feed data
export interface StaffCalendarData {
  staff: {
    id: string
    profile_id: string
    first_name: string
    last_name: string
    email: string
  }
  appointments: Array<{
    id: string
    start_time: string
    end_time: string
    status: string
    notes: string | null
    service: {
      name: string
      duration_minutes: number
    }
    customer: {
      first_name: string
      last_name: string
      email: string
    }
  }>
}