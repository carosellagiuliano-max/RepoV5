/**
 * Admin Settings Management API
 * Handles CRUD operations for business settings
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../src/lib/validation/schemas'
import { Database } from '../../src/lib/types/database'
import { SettingKey, SettingValue } from '../../src/lib/types/settings'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin settings management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetSettings(event, supabase, logger)

        case 'PUT':
          return await handleUpdateSetting(event, supabase, logger, context)

        case 'POST':
          return await handleCreateSetting(event, supabase, logger, context)

        case 'DELETE':
          return await handleDeleteSetting(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Settings management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true }, // Only admin access for settings
  { maxRequests: 100, windowMs: 60 * 1000 }
)

async function handleGetSettings(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.settings.filters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('settings')
    .select('*')

  // Apply filters
  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`key.ilike.%${query.search}%,description.ilike.%${query.search}%`)
  }

  // Hide sensitive settings unless explicitly requested
  if (!query.include_sensitive) {
    dbQuery = dbQuery.eq('is_sensitive', false)
  }

  // Apply sorting
  dbQuery = dbQuery.order('category').order('key')

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: settings, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch settings', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Settings fetched successfully', { count: settings?.length })

  return createSuccessResponse({
    settings,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleUpdateSetting(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, context: AuthenticatedContext) {
  const settingKey = event.path.split('/').pop()
  if (!settingKey) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Setting key is required',
      code: 'SETTING_KEY_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')
  const updates = validateBody(schemas.settings.update, body)

  // Add audit trail
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString(),
    updated_by: context.user.id
  }

  const { data: setting, error } = await supabase
    .from('settings')
    .update(updateData)
    .eq('key', settingKey)
    .select()
    .single()

  if (error) {
    logger.error('Failed to update setting', { error, settingKey })
    throw error
  }

  if (!setting) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Setting not found',
      code: 'SETTING_NOT_FOUND'
    })
  }

  logger.info('Setting updated successfully', { settingKey, userId: context.user.id })

  return createSuccessResponse(setting)
}

async function handleCreateSetting(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, context: AuthenticatedContext) {
  const body = JSON.parse(event.body || '{}')
  const settingData = validateBody(schemas.settings.create, {
    ...body,
    updated_by: context.user.id
  })

  const { data: setting, error } = await supabase
    .from('settings')
    .insert(settingData)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return createErrorResponse({
        statusCode: 409,
        message: 'Setting key already exists',
        code: 'SETTING_KEY_EXISTS'
      })
    }
    logger.error('Failed to create setting', { error })
    throw error
  }

  logger.info('Setting created successfully', { settingKey: setting.key, userId: context.user.id })

  return createSuccessResponse(setting, 201)
}

async function handleDeleteSetting(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const settingKey = event.path.split('/').pop()
  if (!settingKey) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Setting key is required',
      code: 'SETTING_KEY_REQUIRED'
    })
  }

  // Check if it's a core setting that cannot be deleted
  const coreSettings = [
    'business.opening_hours',
    'business.name',
    'booking.window_days',
    'booking.buffer_time_minutes'
  ]

  if (coreSettings.includes(settingKey)) {
    return createErrorResponse({
      statusCode: 403,
      message: 'Core settings cannot be deleted',
      code: 'CORE_SETTING_PROTECTED'
    })
  }

  const { error } = await supabase
    .from('settings')
    .delete()
    .eq('key', settingKey)

  if (error) {
    logger.error('Failed to delete setting', { error, settingKey })
    throw error
  }

  logger.info('Setting deleted successfully', { settingKey })

  return createSuccessResponse({ message: 'Setting deleted successfully' })
}