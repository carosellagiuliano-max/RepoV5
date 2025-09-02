/**
 * Google Calendar Utilities
 * Helper functions for Google Calendar API integration
 */

import { GoogleCalendarEvent, SyncResult } from './types'

/**
 * Converts an internal appointment to a Google Calendar event
 */
export function appointmentToGoogleEvent(appointment: any, businessInfo?: any): GoogleCalendarEvent {
  const customerName = `${appointment.customer_first_name} ${appointment.customer_last_name}`.trim()
  const serviceName = appointment.service_name
  
  return {
    summary: `${serviceName} - ${customerName}`,
    description: [
      `Service: ${serviceName}`,
      `Duration: ${appointment.service_duration_minutes} minutes`,
      `Customer: ${customerName}`,
      `Email: ${appointment.customer_email}`,
      appointment.notes ? `Notes: ${appointment.notes}` : null,
      '',
      `Appointment ID: ${appointment.id}`,
      `Managed by ${businessInfo?.name || 'Schnittwerk Your Style'}`
    ].filter(Boolean).join('\n'),
    start: {
      dateTime: appointment.start_time,
      timeZone: 'Europe/Berlin'
    },
    end: {
      dateTime: appointment.end_time,
      timeZone: 'Europe/Berlin'
    },
    location: businessInfo?.address || process.env.VITE_BUSINESS_ADDRESS,
    status: mapAppointmentStatusToGoogle(appointment.status),
    source: {
      title: businessInfo?.name || 'Schnittwerk Your Style',
      url: businessInfo?.url || process.env.VITE_SITE_URL || 'https://schnittwerk-your-style.de'
    }
  }
}

/**
 * Maps internal appointment status to Google Calendar status
 */
function mapAppointmentStatusToGoogle(status: string): 'tentative' | 'confirmed' | 'cancelled' {
  switch (status) {
    case 'pending':
      return 'tentative'
    case 'confirmed':
    case 'completed':
      return 'confirmed'
    case 'cancelled':
    case 'no_show':
      return 'cancelled'
    default:
      return 'tentative'
  }
}

/**
 * Validates Google Calendar API response
 */
export function validateGoogleCalendarResponse(response: Response): void {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Calendar authentication failed - token may be expired')
    } else if (response.status === 403) {
      throw new Error('Google Calendar access forbidden - check permissions')
    } else if (response.status === 404) {
      throw new Error('Google Calendar not found')
    } else if (response.status === 429) {
      throw new Error('Google Calendar API rate limit exceeded')
    } else {
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`)
    }
  }
}

/**
 * Extracts appointment ID from Google Calendar event description
 */
export function extractAppointmentId(googleEvent: any): string | null {
  const description = googleEvent.description || ''
  const match = description.match(/Appointment ID: ([a-zA-Z0-9-]+)/)
  return match ? match[1] : null
}

/**
 * Checks if a Google Calendar event was created by our system
 */
export function isOurEvent(googleEvent: any): boolean {
  const description = googleEvent.description || ''
  return description.includes('Managed by Schnittwerk Your Style') || 
         description.includes('Appointment ID:')
}

/**
 * Builds Google Calendar API URL with proper query parameters
 */
export function buildCalendarApiUrl(calendarId: string, endpoint: string, params?: Record<string, string>): string {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`
  const url = new URL(`${baseUrl}/${endpoint}`)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  
  return url.toString()
}

/**
 * Handles Google Calendar API errors and converts them to user-friendly messages
 */
export function handleGoogleCalendarError(error: any): string {
  if (typeof error === 'string') {
    return error
  }
  
  if (error.error) {
    const googleError = error.error
    
    switch (googleError.code) {
      case 401:
        return 'Authentication failed. Please reconnect your Google Calendar.'
      case 403:
        return 'Permission denied. Please check your Google Calendar permissions.'
      case 404:
        return 'Calendar not found. The calendar may have been deleted.'
      case 429:
        return 'Too many requests. Please try again later.'
      case 409:
        return 'Conflict detected. The event may have been modified elsewhere.'
      default:
        return googleError.message || 'Unknown Google Calendar error'
    }
  }
  
  return error.message || 'Unknown error occurred'
}

/**
 * Validates Google Calendar OAuth scopes
 */
export function validateRequiredScopes(scopes: string[]): boolean {
  const requiredScopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]
  
  return requiredScopes.every(required => 
    scopes.some(scope => scope.includes(required))
  )
}

/**
 * Formats sync result for display
 */
export function formatSyncResult(result: SyncResult): string {
  const parts = []
  
  if (result.eventsCreated > 0) {
    parts.push(`${result.eventsCreated} event(s) created`)
  }
  
  if (result.eventsUpdated > 0) {
    parts.push(`${result.eventsUpdated} event(s) updated`)
  }
  
  if (result.eventsDeleted > 0) {
    parts.push(`${result.eventsDeleted} event(s) deleted`)
  }
  
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error(s) encountered`)
  }
  
  if (parts.length === 0) {
    return 'No changes made'
  }
  
  return parts.join(', ')
}

/**
 * Determines if a sync is needed based on last sync time
 */
export function shouldSync(lastSyncAt: string | null, maxAgeMinutes: number = 60): boolean {
  if (!lastSyncAt) {
    return true
  }
  
  const lastSync = new Date(lastSyncAt)
  const maxAge = maxAgeMinutes * 60 * 1000 // Convert to milliseconds
  
  return Date.now() - lastSync.getTime() > maxAge
}

/**
 * Creates a safe calendar event summary (limited length, no sensitive info)
 */
export function createSafeEventSummary(serviceName: string, customerName: string, maxLength: number = 100): string {
  const summary = `${serviceName} - ${customerName}`
  
  if (summary.length <= maxLength) {
    return summary
  }
  
  // Try shortening the customer name
  const [firstName] = customerName.split(' ')
  const shortSummary = `${serviceName} - ${firstName}`
  
  if (shortSummary.length <= maxLength) {
    return shortSummary
  }
  
  // As last resort, truncate the service name
  return `${serviceName.substring(0, maxLength - 10)}... - ${firstName}`
}

/**
 * Validates Google Calendar event data before sending to API
 */
export function validateGoogleEvent(event: GoogleCalendarEvent): string[] {
  const errors: string[] = []
  
  if (!event.summary || event.summary.trim().length === 0) {
    errors.push('Event summary is required')
  }
  
  if (!event.start?.dateTime) {
    errors.push('Event start time is required')
  }
  
  if (!event.end?.dateTime) {
    errors.push('Event end time is required')
  }
  
  if (event.start?.dateTime && event.end?.dateTime) {
    const startTime = new Date(event.start.dateTime)
    const endTime = new Date(event.end.dateTime)
    
    if (startTime >= endTime) {
      errors.push('Event end time must be after start time')
    }
  }
  
  if (event.summary && event.summary.length > 1000) {
    errors.push('Event summary is too long (max 1000 characters)')
  }
  
  if (event.description && event.description.length > 8192) {
    errors.push('Event description is too long (max 8192 characters)')
  }
  
  return errors
}