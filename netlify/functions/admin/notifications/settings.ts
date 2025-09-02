/**
 * Admin Notification Settings Management API
 * Handles CRUD operations for notification settings configuration
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../../src/lib/validation/schemas'
import { Database } from '../../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin notification settings request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      const settingKey = pathSegments[pathSegments.length - 1]

      switch (event.httpMethod) {
        case 'GET':
          if (settingKey && settingKey !== 'settings') {
            return await handleGetSetting(settingKey, supabase, logger)
          } else {
            return await handleGetSettings(event, supabase, logger)
          }

        case 'POST':
          return await handleCreateSetting(event, supabase, logger, context.user.id)

        case 'PUT':
          if (!settingKey || settingKey === 'settings') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Setting key is required for updates',
              code: 'SETTING_KEY_REQUIRED'
            })
          }
          return await handleUpdateSetting(settingKey, event, supabase, logger, context.user.id)

        case 'DELETE':
          if (!settingKey || settingKey === 'settings') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Setting key is required for deletion',
              code: 'SETTING_KEY_REQUIRED'
            })
          }
          return await handleDeleteSetting(settingKey, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Notification settings operation failed', { error })
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

async function handleGetSettings(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.notificationSettingFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('notification_settings')
    .select('*')

  // Apply filters
  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.is_active !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.is_active)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`key.ilike.%${query.search}%,description.ilike.%${query.search}%`)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'key'
  const sortOrder = query.sortOrder || 'asc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: settings, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch notification settings', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Notification settings fetched successfully', { count: settings?.length })

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

async function handleGetSetting(settingKey: string, supabase: SupabaseClient, logger: Logger) {
  const { data: setting, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('key', settingKey)
    .single()

  if (error || !setting) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification setting not found',
      code: 'SETTING_NOT_FOUND'
    })
  }

  logger.info('Notification setting fetched successfully', { settingKey })

  return createSuccessResponse(setting)
}

async function handleCreateSetting(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const settingData = validateBody(schemas.notificationSetting.create, body)

  // Check if setting key already exists
  const { data: existingSetting } = await supabase
    .from('notification_settings')
    .select('id')
    .eq('key', settingData.key)
    .single()

  if (existingSetting) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Setting key already exists',
      code: 'SETTING_KEY_EXISTS'
    })
  }

  const { data: setting, error } = await supabase
    .from('notification_settings')
    .insert({
      ...settingData,
      created_by: adminUserId,
      updated_by: adminUserId
    })
    .select()
    .single()

  if (error) {
    logger.error('Failed to create notification setting', { error })
    throw error
  }

  logger.info('Notification setting created successfully', { 
    settingId: setting.id,
    key: setting.key,
    createdBy: adminUserId 
  })

  return createSuccessResponse(setting, 201)
}

async function handleUpdateSetting(
  settingKey: string,
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const updates = validateBody(schemas.notificationSetting.update, body)

  // Get existing setting
  const { data: existingSetting, error: fetchError } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('key', settingKey)
    .single()

  if (fetchError || !existingSetting) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification setting not found',
      code: 'SETTING_NOT_FOUND'
    })
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse({
      statusCode: 400,
      message: 'No updates provided',
      code: 'NO_UPDATES'
    })
  }

  const { data: setting, error: updateError } = await supabase
    .from('notification_settings')
    .update({
      ...updates,
      updated_by: adminUserId
    })
    .eq('key', settingKey)
    .select()
    .single()

  if (updateError) {
    logger.error('Failed to update notification setting', { error: updateError })
    throw updateError
  }

  logger.info('Notification setting updated successfully', { 
    settingKey,
    updatedBy: adminUserId 
  })

  return createSuccessResponse(setting)
}

async function handleDeleteSetting(
  settingKey: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  // Check if setting exists
  const { data: setting, error: fetchError } = await supabase
    .from('notification_settings')
    .select('id')
    .eq('key', settingKey)
    .single()

  if (fetchError || !setting) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification setting not found',
      code: 'SETTING_NOT_FOUND'
    })
  }

  const { error: deleteError } = await supabase
    .from('notification_settings')
    .delete()
    .eq('key', settingKey)

  if (deleteError) {
    logger.error('Failed to delete notification setting', { error: deleteError })
    throw deleteError
  }

  logger.info('Notification setting deleted successfully', { settingKey })

  return createSuccessResponse({ message: 'Notification setting deleted successfully' })
}