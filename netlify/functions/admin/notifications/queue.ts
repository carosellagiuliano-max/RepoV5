/**
 * Admin Notification Queue Management API
 * Handles viewing and managing notification queue and audit logs
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

    logger.info('Admin notification queue request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      const lastSegment = pathSegments[pathSegments.length - 1]
      const secondLastSegment = pathSegments[pathSegments.length - 2]

      // Handle different endpoints
      if (pathSegments.includes('audit-log')) {
        const notificationId = pathSegments[pathSegments.indexOf('audit-log') - 1]
        return await handleGetAuditLog(notificationId, supabase, logger)
      }

      if (lastSegment === 'retry' && event.httpMethod === 'POST') {
        const notificationId = secondLastSegment
        return await handleRetryNotification(notificationId, supabase, logger, context.user.id)
      }

      if (lastSegment === 'cancel' && event.httpMethod === 'POST') {
        const notificationId = secondLastSegment
        return await handleCancelNotification(notificationId, supabase, logger, context.user.id)
      }

      const notificationId = lastSegment !== 'queue' ? lastSegment : undefined

      switch (event.httpMethod) {
        case 'GET':
          if (notificationId) {
            return await handleGetNotification(notificationId, supabase, logger)
          } else {
            return await handleGetNotifications(event, supabase, logger)
          }

        case 'POST':
          return await handleCreateNotification(event, supabase, logger, context.user.id)

        case 'PUT':
          if (!notificationId || notificationId === 'queue') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Notification ID is required for updates',
              code: 'NOTIFICATION_ID_REQUIRED'
            })
          }
          return await handleUpdateNotification(notificationId, event, supabase, logger, context.user.id)

        case 'DELETE':
          if (!notificationId || notificationId === 'queue') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Notification ID is required for deletion',
              code: 'NOTIFICATION_ID_REQUIRED'
            })
          }
          return await handleDeleteNotification(notificationId, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Notification queue operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 100, windowMs: 60 * 1000 }
)

async function handleGetNotifications(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.notificationFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('notification_queue')
    .select(`
      *,
      template:template_id(name, type, channel),
      appointment:appointment_id(id, starts_at, status),
      customer:customer_id(id, customer_number, profiles!inner(full_name, email)),
      staff:staff_id(id, profiles!inner(first_name, last_name, email))
    `)

  // Apply filters
  if (query.type) {
    dbQuery = dbQuery.eq('type', query.type)
  }

  if (query.channel) {
    dbQuery = dbQuery.eq('channel', query.channel)
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.appointment_id) {
    dbQuery = dbQuery.eq('appointment_id', query.appointment_id)
  }

  if (query.customer_id) {
    dbQuery = dbQuery.eq('customer_id', query.customer_id)
  }

  if (query.staff_id) {
    dbQuery = dbQuery.eq('staff_id', query.staff_id)
  }

  if (query.correlation_id) {
    dbQuery = dbQuery.eq('correlation_id', query.correlation_id)
  }

  if (query.scheduled_after) {
    dbQuery = dbQuery.gte('scheduled_for', query.scheduled_after)
  }

  if (query.scheduled_before) {
    dbQuery = dbQuery.lte('scheduled_for', query.scheduled_before)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`recipient_email.ilike.%${query.search}%,recipient_phone.ilike.%${query.search}%,recipient_name.ilike.%${query.search}%,subject.ilike.%${query.search}%`)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'created_at'
  const sortOrder = query.sortOrder || 'desc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: notifications, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch notifications', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Notifications fetched successfully', { count: notifications?.length })

  return createSuccessResponse({
    notifications,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleGetNotification(notificationId: string, supabase: SupabaseClient, logger: Logger) {
  const { data: notification, error } = await supabase
    .from('notification_queue')
    .select(`
      *,
      template:template_id(name, type, channel),
      appointment:appointment_id(id, starts_at, status),
      customer:customer_id(id, customer_number, profiles!inner(full_name, email)),
      staff:staff_id(id, profiles!inner(first_name, last_name, email))
    `)
    .eq('id', notificationId)
    .single()

  if (error || !notification) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification not found',
      code: 'NOTIFICATION_NOT_FOUND'
    })
  }

  logger.info('Notification fetched successfully', { notificationId })

  return createSuccessResponse(notification)
}

async function handleCreateNotification(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const notificationData = validateBody(schemas.notificationQueue.create, body)

  // Use the create_notification function
  const { data: notificationId, error } = await supabase.rpc('create_notification', {
    p_type: notificationData.type,
    p_channel: notificationData.channel,
    p_recipient_email: notificationData.recipient_email,
    p_recipient_phone: notificationData.recipient_phone,
    p_recipient_name: notificationData.recipient_name,
    p_subject: notificationData.subject,
    p_content: notificationData.content,
    p_appointment_id: notificationData.appointment_id,
    p_customer_id: notificationData.customer_id,
    p_staff_id: notificationData.staff_id,
    p_scheduled_for: notificationData.scheduled_for || new Date().toISOString(),
    p_template_id: notificationData.template_id,
    p_correlation_id: notificationData.correlation_id,
    p_metadata: notificationData.metadata
  })

  if (error) {
    logger.error('Failed to create notification', { error })
    throw error
  }

  // Fetch the created notification
  const { data: notification } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('id', notificationId)
    .single()

  logger.info('Notification created successfully', { 
    notificationId,
    createdBy: adminUserId 
  })

  return createSuccessResponse(notification, 201)
}

async function handleUpdateNotification(
  notificationId: string,
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const updates = validateBody(schemas.notificationQueue.update, body)

  // Get existing notification
  const { data: existingNotification, error: fetchError } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('id', notificationId)
    .single()

  if (fetchError || !existingNotification) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification not found',
      code: 'NOTIFICATION_NOT_FOUND'
    })
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse({
      statusCode: 400,
      message: 'No updates provided',
      code: 'NO_UPDATES'
    })
  }

  // Prevent updates to sent notifications
  if (existingNotification.status === 'sent') {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot update sent notifications',
      code: 'NOTIFICATION_ALREADY_SENT'
    })
  }

  const { data: notification, error: updateError } = await supabase
    .from('notification_queue')
    .update(updates)
    .eq('id', notificationId)
    .select()
    .single()

  if (updateError) {
    logger.error('Failed to update notification', { error: updateError })
    throw updateError
  }

  // Log the update
  await supabase
    .from('notification_audit_log')
    .insert({
      notification_id: notificationId,
      action: 'updated',
      status_before: existingNotification.status,
      status_after: notification.status,
      performed_by: adminUserId
    })

  logger.info('Notification updated successfully', { 
    notificationId,
    updatedBy: adminUserId 
  })

  return createSuccessResponse(notification)
}

async function handleDeleteNotification(
  notificationId: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  // Check if notification exists
  const { data: notification, error: fetchError } = await supabase
    .from('notification_queue')
    .select('status')
    .eq('id', notificationId)
    .single()

  if (fetchError || !notification) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Notification not found',
      code: 'NOTIFICATION_NOT_FOUND'
    })
  }

  // Prevent deletion of sent notifications
  if (notification.status === 'sent') {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot delete sent notifications',
      code: 'NOTIFICATION_ALREADY_SENT'
    })
  }

  const { error: deleteError } = await supabase
    .from('notification_queue')
    .delete()
    .eq('id', notificationId)

  if (deleteError) {
    logger.error('Failed to delete notification', { error: deleteError })
    throw deleteError
  }

  logger.info('Notification deleted successfully', { notificationId })

  return createSuccessResponse({ message: 'Notification deleted successfully' })
}

async function handleRetryNotification(
  notificationId: string,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  // Use the update_notification_status function to retry
  const { data: success, error } = await supabase.rpc('update_notification_status', {
    p_notification_id: notificationId,
    p_new_status: 'pending'
  })

  if (error || !success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Failed to retry notification',
      code: 'RETRY_FAILED'
    })
  }

  logger.info('Notification retry scheduled', { notificationId, retriedBy: adminUserId })

  return createSuccessResponse({ message: 'Notification retry scheduled successfully' })
}

async function handleCancelNotification(
  notificationId: string,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  // Use the update_notification_status function to cancel
  const { data: success, error } = await supabase.rpc('update_notification_status', {
    p_notification_id: notificationId,
    p_new_status: 'cancelled'
  })

  if (error || !success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Failed to cancel notification',
      code: 'CANCEL_FAILED'
    })
  }

  logger.info('Notification cancelled', { notificationId, cancelledBy: adminUserId })

  return createSuccessResponse({ message: 'Notification cancelled successfully' })
}

async function handleGetAuditLog(
  notificationId: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  const { data: auditLog, error } = await supabase
    .from('notification_audit_log')
    .select(`
      *,
      performer:performed_by(first_name, last_name, email)
    `)
    .eq('notification_id', notificationId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to fetch notification audit log', { error })
    throw error
  }

  logger.info('Notification audit log fetched successfully', { 
    notificationId, 
    count: auditLog?.length 
  })

  return createSuccessResponse({ auditLog })
}