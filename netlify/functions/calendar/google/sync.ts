/**
 * Google Calendar Sync Function
 * Handles bidirectional synchronization between internal appointments and Google Calendar
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { decryptData, encryptData } from '../../../src/lib/calendar/token-utils'
import { GoogleCalendarEvent, SyncResult } from '../../../src/lib/calendar/types'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Google Calendar sync request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'POST':
          return await handleSync(event, supabase, logger, context.user.id, context.user.role)

        case 'GET':
          return await handleSyncStatus(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Google Calendar sync operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 10, windowMs: 60 * 1000 } // Lower rate limit for sync operations
)

async function handleSync(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, userId: string, userRole: string) {
  const body = JSON.parse(event.body || '{}')
  const { staff_id, direction = 'both' } = body // 'to_google', 'from_google', 'both'

  // Verify permission
  if (userRole !== 'admin') {
    const { data: staffProfile } = await supabase
      .from('staff')
      .select('profile_id')
      .eq('id', staff_id)
      .single()

    if (!staffProfile || staffProfile.profile_id !== userId) {
      return createErrorResponse({
        statusCode: 403,
        message: 'You can only sync your own calendar',
        code: 'PERMISSION_DENIED'
      })
    }
  }

  // Get Google Calendar mapping
  const { data: mapping, error: mappingError } = await supabase
    .from('google_calendar_mappings')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('sync_enabled', true)
    .single()

  if (mappingError || !mapping) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Google Calendar not connected for this staff member',
      code: 'NOT_CONNECTED'
    })
  }

  try {
    let result: SyncResult = {
      success: true,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: []
    }

    // Get access token (refresh if needed)
    const accessToken = await getValidAccessToken(mapping, supabase, logger)
    
    if (direction === 'to_google' || direction === 'both') {
      const toGoogleResult = await syncToGoogle(staff_id, accessToken, mapping.google_calendar_id, supabase, logger)
      result.eventsCreated += toGoogleResult.eventsCreated
      result.eventsUpdated += toGoogleResult.eventsUpdated
      result.errors.push(...toGoogleResult.errors)
    }

    if (direction === 'from_google' || direction === 'both') {
      const fromGoogleResult = await syncFromGoogle(staff_id, accessToken, mapping.google_calendar_id, supabase, logger)
      result.eventsCreated += fromGoogleResult.eventsCreated
      result.eventsUpdated += fromGoogleResult.eventsUpdated
      result.errors.push(...fromGoogleResult.errors)
    }

    // Update last sync time
    await supabase
      .from('google_calendar_mappings')
      .update({ 
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('staff_id', staff_id)

    if (result.errors.length > 0) {
      result.success = false
    }

    logger.info('Google Calendar sync completed', { 
      staff_id, 
      direction, 
      result 
    })

    return createSuccessResponse(result)

  } catch (error) {
    logger.error('Sync operation failed', { error, staff_id })
    return createErrorResponse({
      statusCode: 500,
      message: 'Sync operation failed',
      code: 'SYNC_FAILED'
    })
  }
}

async function handleSyncStatus(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const staffId = event.queryStringParameters?.staff_id

  if (!staffId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Staff ID is required',
      code: 'STAFF_ID_REQUIRED'
    })
  }

  const { data: mapping } = await supabase
    .from('google_calendar_mappings')
    .select('*')
    .eq('staff_id', staffId)
    .single()

  if (!mapping) {
    return createSuccessResponse({
      connected: false,
      last_sync_at: null,
      sync_enabled: false
    })
  }

  return createSuccessResponse({
    connected: true,
    sync_enabled: mapping.sync_enabled,
    last_sync_at: mapping.last_sync_at,
    calendar_id: mapping.google_calendar_id
  })
}

async function getValidAccessToken(mapping: any, supabase: SupabaseClient, logger: Logger): Promise<string> {
  try {
    const accessToken = decryptData(mapping.google_access_token)
    
    // Check if token is expired
    if (mapping.token_expires_at && new Date() >= new Date(mapping.token_expires_at)) {
      logger.info('Access token expired, refreshing...')
      
      if (!mapping.google_refresh_token) {
        throw new Error('No refresh token available')
      }

      const refreshToken = decryptData(mapping.google_refresh_token)
      
      // Refresh the token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const tokens = await response.json()
      
      // Update stored tokens
      const newExpiresAt = tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null

      await supabase
        .from('google_calendar_mappings')
        .update({
          google_access_token: encryptData(tokens.access_token),
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', mapping.id)

      return tokens.access_token
    }

    return accessToken
  } catch (error) {
    logger.error('Failed to get valid access token', { error })
    throw error
  }
}

async function syncToGoogle(
  staffId: string, 
  accessToken: string, 
  calendarId: string, 
  supabase: SupabaseClient, 
  logger: Logger
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    errors: []
  }

  try {
    // Get appointments from the last 30 days to 1 year in the future
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    const { data: appointments } = await supabase
      .from('appointments_with_details')
      .select('*')
      .eq('staff_id', staffId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .in('status', ['confirmed', 'completed'])

    if (!appointments || appointments.length === 0) {
      return result
    }

    // Get existing Google Calendar events
    const existingEventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin: startDate,
        timeMax: endDate,
        q: 'Schnittwerk' // Search for our events
      }),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    const existingEvents = existingEventsResponse.ok 
      ? (await existingEventsResponse.json()).items || []
      : []

    // Create a map of existing events by our appointment ID
    const existingEventMap = new Map()
    existingEvents.forEach((event: any) => {
      const description = event.description || ''
      const match = description.match(/Appointment ID: ([a-zA-Z0-9-]+)/)
      if (match) {
        existingEventMap.set(match[1], event)
      }
    })

    // Sync each appointment
    for (const appointment of appointments) {
      try {
        const googleEvent: GoogleCalendarEvent = {
          summary: `${appointment.service_name} - ${appointment.customer_first_name} ${appointment.customer_last_name}`,
          description: [
            `Service: ${appointment.service_name}`,
            `Duration: ${appointment.service_duration_minutes} minutes`,
            `Customer: ${appointment.customer_first_name} ${appointment.customer_last_name}`,
            `Email: ${appointment.customer_email}`,
            appointment.notes ? `Notes: ${appointment.notes}` : null,
            ``,
            `Appointment ID: ${appointment.id}`,
            `Managed by Schnittwerk Your Style`
          ].filter(Boolean).join('\n'),
          start: {
            dateTime: appointment.start_time,
            timeZone: 'Europe/Berlin'
          },
          end: {
            dateTime: appointment.end_time,
            timeZone: 'Europe/Berlin'
          },
          status: appointment.status === 'completed' ? 'confirmed' : 'confirmed',
          source: {
            title: 'Schnittwerk Your Style',
            url: process.env.VITE_SITE_URL || 'https://schnittwerk-your-style.de'
          }
        }

        const existingEvent = existingEventMap.get(appointment.id)
        
        if (existingEvent) {
          // Update existing event
          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingEvent.id}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(googleEvent)
            }
          )

          if (response.ok) {
            result.eventsUpdated++
          } else {
            result.errors.push(`Failed to update event for appointment ${appointment.id}`)
          }
        } else {
          // Create new event
          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(googleEvent)
            }
          )

          if (response.ok) {
            result.eventsCreated++
          } else {
            result.errors.push(`Failed to create event for appointment ${appointment.id}`)
          }
        }
      } catch (error) {
        result.errors.push(`Error syncing appointment ${appointment.id}: ${error}`)
      }
    }

  } catch (error) {
    logger.error('Failed to sync to Google Calendar', { error })
    result.errors.push(`Sync to Google failed: ${error}`)
  }

  return result
}

async function syncFromGoogle(
  staffId: string, 
  accessToken: string, 
  calendarId: string, 
  supabase: SupabaseClient, 
  logger: Logger
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    errors: []
  }

  // For now, we'll implement a read-only sync from Google
  // This prevents conflicts and keeps our appointment system as the source of truth
  // In the future, this could be enhanced to create appointments from Google Calendar events
  
  logger.info('Sync from Google Calendar is read-only - no changes made to internal appointments')
  
  return result
}