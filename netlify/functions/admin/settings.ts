/**
 * Admin Settings Management API
 * Handles CRUD operations for business settings
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { businessSettingsSchema, emailSettingsSchema, settingUpdateSchema } from '../../../src/lib/validation/schemas'
import { SettingValue, BusinessSettings, EmailSettings } from '../../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

// Helper function to safely extract query parameters
function getQueryParam(params: Record<string, unknown> | null, key: string): string | undefined {
  if (!params || typeof params[key] !== 'string') return undefined
  return params[key] as string
}

// Helper function to convert settings array to typed object
function convertSettingsToObject(settings: Array<{ key: string; value: SettingValue }>): Record<string, SettingValue> {
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, SettingValue>)
}

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
          return await handleUpdateSettings(event, supabase, logger, context.user.id)

        case 'PATCH':
          return await handlePatchSetting(event, supabase, logger, context.user.id)

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
    requiredRole: 'admin',
    rateLimitKey: 'admin-settings',
    maxRequests: 50
  }
)

async function handleGetSettings(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger
) {
  const category = getQueryParam(event.queryStringParameters, 'category')

  logger.info('Fetching settings', { category })

  try {
    let query = supabase
      .from('settings')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: settings, error } = await query

    if (error) {
      logger.error('Failed to fetch settings', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to fetch settings',
        code: 'FETCH_FAILED'
      })
    }

    // Group settings by category for easier consumption
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {}
      }
      acc[setting.category][setting.key] = setting.value
      return acc
    }, {} as Record<string, Record<string, SettingValue>>)

    logger.info('Settings fetched successfully', { 
      totalSettings: settings.length,
      categories: Object.keys(groupedSettings)
    })

    return createSuccessResponse({
      data: {
        settings: groupedSettings,
        raw: settings // Also provide raw array for admin purposes
      }
    })
  } catch (error) {
    logger.error('Error fetching settings', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to fetch settings',
      code: 'FETCH_ERROR'
    })
  }
}

async function handleUpdateSettings(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string
) {
  const body = JSON.parse(event.body || '{}')
  const { category, settings } = body

  if (!category || !settings) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Category and settings are required',
      code: 'VALIDATION_ERROR'
    })
  }

  logger.info('Updating settings batch', { category, userId })

  try {
    // Validate settings based on category
    if (category === 'business') {
      businessSettingsSchema.parse(settings)
    } else if (category === 'email') {
      emailSettingsSchema.parse(settings)
    }

    // Update settings in batch
    const settingsToUpdate = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      category,
      updated_by: userId
    }))

    const updatePromises = settingsToUpdate.map(setting =>
      supabase
        .from('settings')
        .upsert(setting, { onConflict: 'key' })
    )

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      logger.error('Failed to update some settings', { errors })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to update settings',
        code: 'UPDATE_FAILED'
      })
    }

    logger.info('Settings updated successfully', { 
      category, 
      settingsCount: settingsToUpdate.length,
      userId 
    })

    return createSuccessResponse({
      message: 'Settings updated successfully',
      data: { category, updatedCount: settingsToUpdate.length }
    })
  } catch (error) {
    if (error.name === 'ZodError') {
      logger.warn('Settings validation failed', { error: error.issues })
      return createErrorResponse({
        statusCode: 400,
        message: 'Invalid settings data',
        code: 'VALIDATION_ERROR',
        details: error.issues
      })
    }

    logger.error('Error updating settings', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to update settings',
      code: 'UPDATE_ERROR'
    })
  }
}

async function handlePatchSetting(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string
) {
  const body = JSON.parse(event.body || '{}')
  const validation = settingUpdateSchema.safeParse(body)

  if (!validation.success) {
    logger.warn('Setting validation failed', { errors: validation.error.issues })
    return createErrorResponse({
      statusCode: 400,
      message: 'Invalid setting data',
      code: 'VALIDATION_ERROR',
      details: validation.error.issues
    })
  }

  const key = getQueryParam(event.queryStringParameters, 'key')

  if (!key) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Setting key is required',
      code: 'VALIDATION_ERROR'
    })
  }

  logger.info('Updating single setting', { key, userId })

  try {
    const updateData = {
      ...validation.data,
      updated_by: userId
    }

    const { data, error } = await supabase
      .from('settings')
      .update(updateData)
      .eq('key', key)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse({
          statusCode: 404,
          message: 'Setting not found',
          code: 'SETTING_NOT_FOUND'
        })
      }

      logger.error('Failed to update setting', { error, key })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to update setting',
        code: 'UPDATE_FAILED'
      })
    }

    logger.info('Setting updated successfully', { key, userId })

    return createSuccessResponse({
      message: 'Setting updated successfully',
      data: data
    })
  } catch (error) {
    logger.error('Error updating setting', { error, key })
    return createErrorResponse({
      statusCode: 500,
      message: 'Failed to update setting',
      code: 'UPDATE_ERROR'
    })
  }
}