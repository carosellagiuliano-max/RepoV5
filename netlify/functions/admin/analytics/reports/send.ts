/**
 * Send Report API
 * Triggers immediate report generation and delivery
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../../src/lib/auth/netlify-auth'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Send report request', {
      method: event.httpMethod,
      userId: context.user.id,
      path: event.path
    })

    try {
      // Only admins can send reports
      if (context.user.role !== 'admin') {
        return createErrorResponse({
          statusCode: 403,
          message: 'Access denied - admin permissions required',
          code: 'ACCESS_DENIED'
        })
      }

      if (event.httpMethod !== 'POST') {
        return createErrorResponse({
          statusCode: 405,
          message: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
      }

      return await handleSendReport(event, supabase, logger, context)
    } catch (error) {
      logger.error('Send report operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 5, windowMs: 60 * 1000 } // Stricter rate limiting for report generation
)

async function handleSendReport(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  // Extract report ID from path like /admin/analytics/reports/123/send
  const pathSegments = event.path.split('/')
  const sendIndex = pathSegments.indexOf('send')
  const reportId = sendIndex > 0 ? pathSegments[sendIndex - 1] : null
  
  if (!reportId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Report ID is required',
      code: 'VALIDATION_ERROR'
    })
  }

  logger.info('Processing send request for report', { reportId })

  // For demo purposes, we'll simulate successful report delivery
  // In production, this would trigger actual report generation and email delivery
  
  return createSuccessResponse({
    message: 'Report wird gesendet...',
    reportId,
    estimatedDelivery: '2-3 Minuten'
  })
}