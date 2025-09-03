/**
 * Scheduled Reports API
 * Manages automated report generation and delivery
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../src/lib/auth/netlify-auth'
import { z } from 'zod'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

const createReportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly']),
  format: z.enum(['csv', 'pdf']),
  recipients: z.array(z.string().email()),
  filters: z.object({
    staffId: z.string().optional(),
    serviceId: z.string().optional(),
    period: z.enum(['week', 'month']).default('month')
  }),
  isActive: z.boolean().default(true)
})

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Scheduled reports request', {
      method: event.httpMethod,
      userId: context.user.id
    })

    try {
      // Only admins can manage scheduled reports
      if (context.user.role !== 'admin') {
        return createErrorResponse({
          statusCode: 403,
          message: 'Access denied - admin permissions required',
          code: 'ACCESS_DENIED'
        })
      }

      switch (event.httpMethod) {
        case 'GET':
          return await handleGetReports(supabase, logger, context)
        case 'POST':
          return await handleCreateReport(event, supabase, logger, context)
        case 'PUT':
          return await handleUpdateReport(event, supabase, logger, context)
        case 'PATCH':
          return await handlePatchReport(event, supabase, logger, context)
        case 'DELETE':
          return await handleDeleteReport(event, supabase, logger, context)
        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Scheduled reports operation failed', { error })
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

async function handleGetReports(
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const { data: reports, error } = await supabase
    .from('scheduled_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to fetch scheduled reports', { error })
    throw error
  }

  return createSuccessResponse(reports || [])
}

async function handleCreateReport(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  if (!event.body) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Request body is required',
      code: 'VALIDATION_ERROR'
    })
  }

  const body = JSON.parse(event.body)
  const validatedData = createReportSchema.parse(body)

  // Calculate next run date
  const now = new Date()
  const nextRun = validatedData.frequency === 'weekly' 
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Next week
    : new Date(now.getFullYear(), now.getMonth() + 1, 1) // First day of next month

  const reportData = {
    ...validatedData,
    recipients: JSON.stringify(validatedData.recipients),
    filters: JSON.stringify(validatedData.filters),
    next_run: nextRun.toISOString(),
    created_by: context.user.id,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  }

  const { data: report, error } = await supabase
    .from('scheduled_reports')
    .insert(reportData)
    .select()
    .single()

  if (error) {
    logger.error('Failed to create scheduled report', { error })
    throw error
  }

  logger.info('Scheduled report created', { reportId: report.id, name: validatedData.name })
  return createSuccessResponse(report)
}

async function handleUpdateReport(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const reportId = event.path.split('/').pop()
  
  if (!reportId || !event.body) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Report ID and request body are required',
      code: 'VALIDATION_ERROR'
    })
  }

  const body = JSON.parse(event.body)
  const validatedData = createReportSchema.parse(body)

  const updateData = {
    ...validatedData,
    recipients: JSON.stringify(validatedData.recipients),
    filters: JSON.stringify(validatedData.filters),
    updated_at: new Date().toISOString()
  }

  const { data: report, error } = await supabase
    .from('scheduled_reports')
    .update(updateData)
    .eq('id', reportId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to update scheduled report', { error, reportId })
    throw error
  }

  logger.info('Scheduled report updated', { reportId, name: validatedData.name })
  return createSuccessResponse(report)
}

async function handlePatchReport(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const reportId = event.path.split('/').pop()
  
  if (!reportId || !event.body) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Report ID and request body are required',
      code: 'VALIDATION_ERROR'
    })
  }

  const body = JSON.parse(event.body)
  
  // For PATCH, we only update specific fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }

  if ('isActive' in body) {
    updateData.is_active = body.isActive
  }

  const { data: report, error } = await supabase
    .from('scheduled_reports')
    .update(updateData)
    .eq('id', reportId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to patch scheduled report', { error, reportId })
    throw error
  }

  logger.info('Scheduled report patched', { reportId, changes: updateData })
  return createSuccessResponse(report)
}

async function handleDeleteReport(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const reportId = event.path.split('/').pop()
  
  if (!reportId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Report ID is required',
      code: 'VALIDATION_ERROR'
    })
  }

  const { error } = await supabase
    .from('scheduled_reports')
    .delete()
    .eq('id', reportId)

  if (error) {
    logger.error('Failed to delete scheduled report', { error, reportId })
    throw error
  }

  logger.info('Scheduled report deleted', { reportId })
  return createSuccessResponse({ success: true })
}