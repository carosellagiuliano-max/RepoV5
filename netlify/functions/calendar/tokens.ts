/**
 * Admin Calendar Management API
 * Handles calendar token management for staff members
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../../src/lib/validation/schemas'
import { generateCalendarToken, hashCalendarToken, generateExpiringToken, generateCalendarFeedUrl } from '../../../src/lib/calendar/token-utils'
import { CalendarTokenInsert, CalendarTokenUpdate } from '../../../src/lib/calendar/types'
import { z } from 'zod'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

// Validation schemas for calendar management
const createTokenSchema = z.object({
  staff_id: z.string().uuid(),
  feed_type: z.enum(['ical', 'google']).default('ical'),
  expires_hours: z.number().min(1).max(8760).optional() // Max 1 year
})

const updateTokenSchema = z.object({
  is_active: z.boolean().optional(),
  expires_hours: z.number().min(1).max(8760).optional()
})

const tokenFiltersSchema = z.object({
  staff_id: z.string().uuid().optional(),
  feed_type: z.enum(['ical', 'google']).optional(),
  is_active: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
})

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin calendar management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetTokens(event, supabase, logger)

        case 'POST':
          return await handleCreateToken(event, supabase, logger)

        case 'PUT':
          return await handleUpdateToken(event, supabase, logger)

        case 'DELETE':
          return await handleDeleteToken(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Calendar management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 50, windowMs: 60 * 1000 }
)

async function handleGetTokens(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(tokenFiltersSchema, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('calendar_tokens')
    .select(`
      *,
      staff!inner(
        id,
        profile_id,
        staff_with_profiles!inner(
          first_name,
          last_name,
          email
        )
      )
    `)

  // Apply filters
  if (query.staff_id) {
    dbQuery = dbQuery.eq('staff_id', query.staff_id)
  }

  if (query.feed_type) {
    dbQuery = dbQuery.eq('feed_type', query.feed_type)
  }

  if (query.is_active !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.is_active)
  }

  // Apply sorting and pagination
  dbQuery = dbQuery
    .order('created_at', { ascending: false })
    .range((query.page - 1) * query.limit, query.page * query.limit - 1)

  const { data: tokens, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch calendar tokens', { error })
    throw error
  }

  // Transform data to include feed URLs for ical tokens
  const transformedTokens = (tokens || []).map(token => ({
    ...token,
    feed_url: token.feed_type === 'ical' && token.is_active 
      ? generateCalendarFeedUrl(token.token_hash) // Note: This shows hash, not actual token
      : null,
    is_expired: token.expires_at ? new Date() > new Date(token.expires_at) : false
  }))

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Calendar tokens fetched successfully', { count: transformedTokens?.length })

  return createSuccessResponse({
    tokens: transformedTokens,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleCreateToken(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const body = JSON.parse(event.body || '{}')
  const validatedData = validateBody(createTokenSchema, body)

  // Check if staff member exists and is active
  const { data: staff, error: staffError } = await supabase
    .from('staff_with_profiles')
    .select('id, first_name, last_name, email, is_active')
    .eq('id', validatedData.staff_id)
    .single()

  if (staffError || !staff) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Staff member not found',
      code: 'STAFF_NOT_FOUND'
    })
  }

  if (!staff.is_active) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Cannot create calendar token for inactive staff member',
      code: 'STAFF_INACTIVE'
    })
  }

  // Check if token already exists for this staff member and feed type
  const { data: existingToken } = await supabase
    .from('calendar_tokens')
    .select('id')
    .eq('staff_id', validatedData.staff_id)
    .eq('feed_type', validatedData.feed_type)
    .eq('is_active', true)
    .single()

  if (existingToken) {
    return createErrorResponse({
      statusCode: 409,
      message: `Active ${validatedData.feed_type} token already exists for this staff member`,
      code: 'TOKEN_EXISTS'
    })
  }

  // Generate token
  const token = generateCalendarToken()
  const tokenHash = hashCalendarToken(token)

  // Calculate expiration if specified
  let expiresAt: string | null = null
  if (validatedData.expires_hours) {
    expiresAt = new Date(Date.now() + validatedData.expires_hours * 60 * 60 * 1000).toISOString()
  }

  // Create token record
  const tokenData: CalendarTokenInsert = {
    staff_id: validatedData.staff_id,
    token_hash: tokenHash,
    feed_type: validatedData.feed_type,
    expires_at: expiresAt,
    is_active: true
  }

  const { data: createdToken, error: createError } = await supabase
    .from('calendar_tokens')
    .insert(tokenData)
    .select(`
      *,
      staff!inner(
        staff_with_profiles!inner(
          first_name,
          last_name,
          email
        )
      )
    `)
    .single()

  if (createError) {
    logger.error('Failed to create calendar token', { error: createError })
    throw createError
  }

  logger.info('Calendar token created successfully', { 
    tokenId: createdToken.id,
    staffId: validatedData.staff_id,
    feedType: validatedData.feed_type
  })

  // Return token with actual token value (only time it's exposed)
  const response = {
    ...createdToken,
    token: token, // Actual token for initial setup
    feed_url: validatedData.feed_type === 'ical' 
      ? generateCalendarFeedUrl(token)
      : null
  }

  return createSuccessResponse(response, 201)
}

async function handleUpdateToken(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const tokenId = event.path.split('/').pop()
  if (!tokenId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Token ID is required',
      code: 'TOKEN_ID_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')
  const validatedData = validateBody(updateTokenSchema, body)

  // Get existing token
  const { data: existingToken, error: fetchError } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('id', tokenId)
    .single()

  if (fetchError || !existingToken) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Calendar token not found',
      code: 'TOKEN_NOT_FOUND'
    })
  }

  // Prepare update data
  const updates: CalendarTokenUpdate = {
    updated_at: new Date().toISOString()
  }

  if (validatedData.is_active !== undefined) {
    updates.is_active = validatedData.is_active
  }

  if (validatedData.expires_hours !== undefined) {
    updates.expires_at = new Date(Date.now() + validatedData.expires_hours * 60 * 60 * 1000).toISOString()
  }

  // Update token
  const { data: updatedToken, error: updateError } = await supabase
    .from('calendar_tokens')
    .update(updates)
    .eq('id', tokenId)
    .select(`
      *,
      staff!inner(
        staff_with_profiles!inner(
          first_name,
          last_name,
          email
        )
      )
    `)
    .single()

  if (updateError) {
    logger.error('Failed to update calendar token', { error: updateError })
    throw updateError
  }

  logger.info('Calendar token updated successfully', { tokenId })

  return createSuccessResponse(updatedToken)
}

async function handleDeleteToken(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const tokenId = event.path.split('/').pop()
  if (!tokenId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Token ID is required',
      code: 'TOKEN_ID_REQUIRED'
    })
  }

  // Soft delete - deactivate instead of hard delete
  const { data: deactivatedToken, error: deleteError } = await supabase
    .from('calendar_tokens')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', tokenId)
    .select('id, staff_id, feed_type')
    .single()

  if (deleteError) {
    logger.error('Failed to deactivate calendar token', { error: deleteError })
    
    if (deleteError.code === 'PGRST116') {
      return createErrorResponse({
        statusCode: 404,
        message: 'Calendar token not found',
        code: 'TOKEN_NOT_FOUND'
      })
    }
    
    throw deleteError
  }

  logger.info('Calendar token deactivated successfully', { tokenId })

  return createSuccessResponse({ 
    message: 'Calendar token deactivated successfully',
    tokenId: deactivatedToken.id
  })
}