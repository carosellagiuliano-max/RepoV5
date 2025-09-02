/**
 * Admin Notification Templates Management API
 * Handles CRUD operations for email/SMS notification templates
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

    logger.info('Admin notification templates request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      const templateId = pathSegments[pathSegments.length - 1]

      switch (event.httpMethod) {
        case 'GET':
          if (templateId && templateId !== 'templates') {
            return await handleGetTemplate(templateId, supabase, logger)
          } else {
            return await handleGetTemplates(event, supabase, logger)
          }

        case 'POST':
          return await handleCreateTemplate(event, supabase, logger, context.user.id)

        case 'PUT':
          if (!templateId || templateId === 'templates') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Template ID is required for updates',
              code: 'TEMPLATE_ID_REQUIRED'
            })
          }
          return await handleUpdateTemplate(templateId, event, supabase, logger, context.user.id)

        case 'DELETE':
          if (!templateId || templateId === 'templates') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Template ID is required for deletion',
              code: 'TEMPLATE_ID_REQUIRED'
            })
          }
          return await handleDeleteTemplate(templateId, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Notification templates operation failed', { error })
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

async function handleGetTemplates(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.notificationTemplateFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('notification_templates')
    .select('*')

  // Apply filters
  if (query.type) {
    dbQuery = dbQuery.eq('type', query.type)
  }

  if (query.channel) {
    dbQuery = dbQuery.eq('channel', query.channel)
  }

  if (query.is_active !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.is_active)
  }

  if (query.is_default !== undefined) {
    dbQuery = dbQuery.eq('is_default', query.is_default)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`name.ilike.%${query.search}%,subject.ilike.%${query.search}%,content.ilike.%${query.search}%`)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'name'
  const sortOrder = query.sortOrder || 'asc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: templates, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch notification templates', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Notification templates fetched successfully', { count: templates?.length })

  return createSuccessResponse({
    templates,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleGetTemplate(templateId: string, supabase: SupabaseClient, logger: Logger) {
  const { data: template, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error || !template) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification template not found',
      code: 'TEMPLATE_NOT_FOUND'
    })
  }

  logger.info('Notification template fetched successfully', { templateId })

  return createSuccessResponse(template)
}

async function handleCreateTemplate(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const templateData = validateBody(schemas.notificationTemplate.create, body)

  // Check if template name already exists
  const { data: existingTemplate } = await supabase
    .from('notification_templates')
    .select('id')
    .eq('name', templateData.name)
    .single()

  if (existingTemplate) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Template name already exists',
      code: 'TEMPLATE_NAME_EXISTS'
    })
  }

  // If setting as default, unset other defaults for same type+channel
  if (templateData.is_default) {
    await supabase
      .from('notification_templates')
      .update({ is_default: false })
      .eq('type', templateData.type)
      .eq('channel', templateData.channel)
      .eq('is_default', true)
  }

  const { data: template, error } = await supabase
    .from('notification_templates')
    .insert({
      ...templateData,
      created_by: adminUserId,
      updated_by: adminUserId
    })
    .select()
    .single()

  if (error) {
    logger.error('Failed to create notification template', { error })
    throw error
  }

  logger.info('Notification template created successfully', { 
    templateId: template.id,
    name: template.name,
    createdBy: adminUserId 
  })

  return createSuccessResponse(template, 201)
}

async function handleUpdateTemplate(
  templateId: string,
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const updates = validateBody(schemas.notificationTemplate.update, body)

  // Get existing template
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (fetchError || !existingTemplate) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification template not found',
      code: 'TEMPLATE_NOT_FOUND'
    })
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse({
      statusCode: 400,
      message: 'No updates provided',
      code: 'NO_UPDATES'
    })
  }

  // Check if name is being updated to an existing name
  if (updates.name && updates.name !== existingTemplate.name) {
    const { data: nameConflict } = await supabase
      .from('notification_templates')
      .select('id')
      .eq('name', updates.name)
      .neq('id', templateId)
      .single()

    if (nameConflict) {
      return createErrorResponse({
        statusCode: 409,
        message: 'Template name already exists',
        code: 'TEMPLATE_NAME_EXISTS'
      })
    }
  }

  // If setting as default, unset other defaults for same type+channel
  if (updates.is_default) {
    await supabase
      .from('notification_templates')
      .update({ is_default: false })
      .eq('type', existingTemplate.type)
      .eq('channel', existingTemplate.channel)
      .eq('is_default', true)
      .neq('id', templateId)
  }

  const { data: template, error: updateError } = await supabase
    .from('notification_templates')
    .update({
      ...updates,
      updated_by: adminUserId
    })
    .eq('id', templateId)
    .select()
    .single()

  if (updateError) {
    logger.error('Failed to update notification template', { error: updateError })
    throw updateError
  }

  logger.info('Notification template updated successfully', { 
    templateId,
    updatedBy: adminUserId 
  })

  return createSuccessResponse(template)
}

async function handleDeleteTemplate(
  templateId: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  // Check if template exists and if it's in use
  const { data: template, error: fetchError } = await supabase
    .from('notification_templates')
    .select('id, name, is_default')
    .eq('id', templateId)
    .single()

  if (fetchError || !template) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification template not found',
      code: 'TEMPLATE_NOT_FOUND'
    })
  }

  // Check if template is in use
  const { data: usageCount, error: usageError } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('template_id', templateId)
    .limit(1)

  if (usageError) {
    logger.error('Failed to check template usage', { error: usageError })
    throw usageError
  }

  if (usageCount && usageCount.length > 0) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot delete template that is in use',
      code: 'TEMPLATE_IN_USE'
    })
  }

  // Prevent deletion of default templates (soft delete instead)
  if (template.is_default) {
    const { error: deactivateError } = await supabase
      .from('notification_templates')
      .update({ is_active: false })
      .eq('id', templateId)

    if (deactivateError) {
      logger.error('Failed to deactivate default template', { error: deactivateError })
      throw deactivateError
    }

    logger.info('Default notification template deactivated', { templateId })

    return createSuccessResponse({ 
      message: 'Default template deactivated instead of deleted',
      action: 'deactivated'
    })
  }

  const { error: deleteError } = await supabase
    .from('notification_templates')
    .delete()
    .eq('id', templateId)

  if (deleteError) {
    logger.error('Failed to delete notification template', { error: deleteError })
    throw deleteError
  }

  logger.info('Notification template deleted successfully', { templateId })

  return createSuccessResponse({ message: 'Notification template deleted successfully' })
}