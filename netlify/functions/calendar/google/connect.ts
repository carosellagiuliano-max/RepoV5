/**
 * Google Calendar OAuth Connect Function
 * Handles the OAuth flow for connecting staff Google Calendar accounts
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { encryptData } from '../../../src/lib/calendar/token-utils'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Google Calendar OAuth request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleOAuthCallback(event, supabase, logger)

        case 'POST':
          return await handleConnectRequest(event, supabase, logger, context.user.id, context.user.role)

        case 'DELETE':
          return await handleDisconnect(event, supabase, logger, context.user.id, context.user.role)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Google Calendar OAuth operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 20, windowMs: 60 * 1000 }
)

async function handleConnectRequest(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, userId: string, userRole: string) {
  // Check if Google Calendar API is configured
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    return createErrorResponse({
      statusCode: 503,
      message: 'Google Calendar integration is not configured',
      code: 'GOOGLE_NOT_CONFIGURED'
    })
  }

  const body = JSON.parse(event.body || '{}')
  const { staff_id } = body

  // Verify user has permission to connect this staff member's calendar
  // Admin can connect any staff calendar, staff can only connect their own
  if (userRole !== 'admin') {
    const { data: staffProfile } = await supabase
      .from('staff')
      .select('profile_id')
      .eq('id', staff_id)
      .single()

    if (!staffProfile || staffProfile.profile_id !== userId) {
      return createErrorResponse({
        statusCode: 403,
        message: 'You can only connect your own calendar',
        code: 'PERMISSION_DENIED'
      })
    }
  }

  // Generate OAuth URL
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]

  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  
  const state = Buffer.from(JSON.stringify({ 
    staff_id,
    user_id: userId,
    timestamp: Date.now()
  })).toString('base64')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  logger.info('Generated Google OAuth URL', { staff_id, userId })

  return createSuccessResponse({
    auth_url: authUrl.toString(),
    message: 'Visit the auth_url to complete Google Calendar connection'
  })
}

async function handleOAuthCallback(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const { code, state, error } = event.queryStringParameters || {}

  if (error) {
    logger.error('OAuth error from Google', { error })
    return createErrorResponse({
      statusCode: 400,
      message: `OAuth error: ${error}`,
      code: 'OAUTH_ERROR'
    })
  }

  if (!code || !state) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Missing OAuth code or state',
      code: 'MISSING_OAUTH_PARAMS'
    })
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const { staff_id, user_id, timestamp } = stateData

    // Check state timestamp (should be within 10 minutes)
    if (Date.now() - timestamp > 10 * 60 * 1000) {
      return createErrorResponse({
        statusCode: 400,
        message: 'OAuth state has expired',
        code: 'STATE_EXPIRED'
      })
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      logger.error('Failed to exchange OAuth code', { error: errorData })
      return createErrorResponse({
        statusCode: 400,
        message: 'Failed to exchange OAuth code',
        code: 'TOKEN_EXCHANGE_FAILED'
      })
    }

    const tokens = await tokenResponse.json()
    
    // Get user's primary calendar
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    if (!calendarResponse.ok) {
      logger.error('Failed to get Google Calendar info')
      return createErrorResponse({
        statusCode: 400,
        message: 'Failed to access Google Calendar',
        code: 'CALENDAR_ACCESS_FAILED'
      })
    }

    const calendarInfo = await calendarResponse.json()

    // Encrypt and store tokens
    const encryptedAccessToken = encryptData(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token ? encryptData(tokens.refresh_token) : null

    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    // Upsert Google Calendar mapping
    const { error: upsertError } = await supabase
      .from('google_calendar_mappings')
      .upsert({
        staff_id,
        google_calendar_id: calendarInfo.id,
        google_access_token: encryptedAccessToken,
        google_refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt,
        sync_enabled: true
      }, {
        onConflict: 'staff_id'
      })

    if (upsertError) {
      logger.error('Failed to store Google Calendar mapping', { error: upsertError })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to store calendar connection',
        code: 'STORAGE_FAILED'
      })
    }

    logger.info('Google Calendar connected successfully', { staff_id, calendar_id: calendarInfo.id })

    // Return a success page
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .info { color: #6c757d; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Google Calendar Connected</h1>
          <p>Your Google Calendar has been successfully connected to your staff account.</p>
          <p class="info">Calendar: ${calendarInfo.summary}</p>
          <p class="info">You can now close this window and return to the admin panel.</p>
        </body>
      </html>
    `

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: successHtml
    }

  } catch (error) {
    logger.error('OAuth callback processing failed', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to process OAuth callback',
      code: 'CALLBACK_PROCESSING_FAILED'
    })
  }
}

async function handleDisconnect(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, userId: string, userRole: string) {
  const staffId = event.path.split('/').pop()
  
  if (!staffId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Staff ID is required',
      code: 'STAFF_ID_REQUIRED'
    })
  }

  // Verify user has permission to disconnect this staff member's calendar
  if (userRole !== 'admin') {
    const { data: staffProfile } = await supabase
      .from('staff')
      .select('profile_id')
      .eq('id', staffId)
      .single()

    if (!staffProfile || staffProfile.profile_id !== userId) {
      return createErrorResponse({
        statusCode: 403,
        message: 'You can only disconnect your own calendar',
        code: 'PERMISSION_DENIED'
      })
    }
  }

  // Delete Google Calendar mapping
  const { error: deleteError } = await supabase
    .from('google_calendar_mappings')
    .delete()
    .eq('staff_id', staffId)

  if (deleteError) {
    logger.error('Failed to disconnect Google Calendar', { error: deleteError })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to disconnect calendar',
      code: 'DISCONNECT_FAILED'
    })
  }

  logger.info('Google Calendar disconnected successfully', { staff_id: staffId })

  return createSuccessResponse({
    message: 'Google Calendar disconnected successfully'
  })
}