/**
 * Business Settings Management API
 * Handles CRUD operations for business settings
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, settingSchema, settingUpdateSchema } from '../../../src/lib/validation/schemas'
import { Database } from '../../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Business settings management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetSettings(event, supabase, logger, context)

        case 'PUT':
          return await handleUpdateSettings(event, supabase, logger, context)

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
  {
    requireAdmin: false, // We'll check permissions within handlers
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    }
  }
)

async function handleGetSettings(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const { searchParams } = new URL(event.rawUrl || `https://example.com${event.path}?${event.rawQuery || ''}`)
  const category = searchParams.get('category')
  const publicOnly = searchParams.get('public_only') === 'true'

  logger.info('Getting business settings', { category, publicOnly, userRole: context.user.role })

  // Build query
  let query = supabase.from('business_settings').select('*')

  // Apply category filter
  if (category) {
    query = query.eq('category', category)
  }

  // Apply visibility filter based on user role
  if (context.user.role === 'customer' || publicOnly) {
    query = query.eq('is_public', true)
  }

  const { data: settings, error } = await query.order('category').order('key')

  if (error) {
    logger.error('Failed to fetch settings', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to fetch settings',
      code: 'FETCH_SETTINGS_FAILED'
    })
  }

  // Transform settings into a more usable format
  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = {
      value: setting.value,
      description: setting.description,
      category: setting.category,
      is_public: setting.is_public,
      updated_at: setting.updated_at
    }
    return acc
  }, {} as Record<string, any>)

  logger.info('Settings fetched successfully', { 
    count: settings.length,
    categories: [...new Set(settings.map(s => s.category))]
  })

  return createSuccessResponse({
    data: {
      settings: settingsMap,
      raw: settings
    }
  })
}

async function handleUpdateSettings(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  // Only admins can update settings
  if (context.user.role !== 'admin') {
    return createErrorResponse({
      statusCode: 403,
      message: 'Only administrators can update settings',
      code: 'INSUFFICIENT_PERMISSIONS'
    })
  }

  const body = validateBody(event, settingUpdateSchema)
  if (!body.success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Invalid request body',
      code: 'INVALID_REQUEST_BODY',
      details: body.error
    })
  }

  const { searchParams } = new URL(event.rawUrl || `https://example.com${event.path}?${event.rawQuery || ''}`)
  const key = searchParams.get('key')

  if (!key) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Setting key is required',
      code: 'MISSING_SETTING_KEY'
    })
  }

  logger.info('Updating business setting', { 
    key, 
    adminId: context.user.id,
    hasValue: !!body.data.value 
  })

  const { error } = await supabase
    .from('business_settings')
    .update({
      ...body.data,
      updated_at: new Date().toISOString(),
      updated_by: context.user.id
    })
    .eq('key', key)

  if (error) {
    logger.error('Failed to update setting', { error, key })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to update setting',
      code: 'UPDATE_SETTING_FAILED'
    })
  }

  // Fetch the updated setting
  const { data: updatedSetting, error: fetchError } = await supabase
    .from('business_settings')
    .select('*')
    .eq('key', key)
    .single()

  if (fetchError) {
    logger.error('Failed to fetch updated setting', { error: fetchError, key })
    return createErrorResponse({
      statusCode: 500,
      message: 'Setting updated but failed to retrieve updated data',
      code: 'FETCH_UPDATED_SETTING_FAILED'
    })
  }

  logger.info('Setting updated successfully', { 
    key,
    adminId: context.user.id,
    category: updatedSetting.category
  })

  return createSuccessResponse({
    data: {
      setting: updatedSetting,
      message: `Setting '${key}' updated successfully`
    }
  })
}