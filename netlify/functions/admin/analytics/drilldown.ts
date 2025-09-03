/**
 * Analytics Drilldown API
 * Provides detailed appointment data for drill-down views
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../../src/lib/validation/schemas'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Analytics drilldown request', {
      method: event.httpMethod,
      userId: context.user.id
    })

    try {
      if (event.httpMethod !== 'GET') {
        return createErrorResponse({
          statusCode: 405,
          message: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
      }

      return await handleGetDrilldown(event, supabase, logger, context)
    } catch (error) {
      logger.error('Drilldown fetch operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 30, windowMs: 60 * 1000 }
)

async function handleGetDrilldown(
  event: HandlerEvent, 
  supabase: SupabaseClient, 
  logger: Logger,
  context: AuthenticatedContext
) {
  const params = event.queryStringParameters || {}
  
  const metric = params.metric as 'appointments' | 'revenue' | 'staff' | 'service'
  const value = params.value
  const startDate = params.startDate
  const endDate = params.endDate
  const status = params.status?.split(',')
  
  if (!metric || !startDate || !endDate) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Missing required parameters: metric, startDate, endDate',
      code: 'VALIDATION_ERROR'
    })
  }

  logger.info('Fetching drilldown data', { metric, value, startDate, endDate, status })

  // Build the appointments query
  let appointmentsQuery = supabase
    .from('appointments_with_details')
    .select('*')
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('start_time', `${endDate}T23:59:59Z`)

  // Apply metric-specific filters
  switch (metric) {
    case 'staff':
      if (value) {
        appointmentsQuery = appointmentsQuery.eq('staff_id', value)
      }
      break
    case 'service':
      if (value) {
        appointmentsQuery = appointmentsQuery.eq('service_id', value)
      }
      break
    case 'revenue':
      // For revenue drilldown, we might filter by specific date
      if (value) {
        const targetDate = value
        appointmentsQuery = appointmentsQuery
          .gte('start_time', `${targetDate}T00:00:00Z`)
          .lte('start_time', `${targetDate}T23:59:59Z`)
      }
      break
  }

  // Apply status filter if provided
  if (status && status.length > 0) {
    appointmentsQuery = appointmentsQuery.in('status', status)
  }

  // Apply role-based access control
  const userRole = context.user.role || 'staff'
  if (userRole === 'staff') {
    // Staff can only see their own appointments
    appointmentsQuery = appointmentsQuery.eq('staff_id', context.user.id)
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery

  if (appointmentsError) {
    logger.error('Failed to fetch appointments for drilldown', { error: appointmentsError })
    throw appointmentsError
  }

  // Transform appointments data for frontend
  const transformedAppointments = (appointments || []).map(apt => ({
    id: apt.id,
    date: format(new Date(apt.start_time), 'yyyy-MM-dd'),
    time: format(new Date(apt.start_time), 'HH:mm'),
    customerName: apt.customer_first_name && apt.customer_last_name 
      ? `${apt.customer_first_name} ${apt.customer_last_name}`
      : apt.customer_first_name || apt.customer_last_name || 'Unbekannt',
    customerEmail: apt.customer_email || undefined,
    staffName: apt.staff_first_name && apt.staff_last_name 
      ? `${apt.staff_first_name} ${apt.staff_last_name}`
      : apt.staff_first_name || apt.staff_last_name || 'Unbekannt',
    serviceName: apt.service_name || 'Unbekannter Service',
    duration: apt.service_duration_minutes || 0,
    price: (apt.service_price_cents || 0) / 100,
    status: apt.status || 'pending',
    notes: apt.notes || undefined
  }))

  // Calculate summary metrics
  const completedAppointments = transformedAppointments.filter(apt => apt.status === 'completed')
  const totalRevenue = completedAppointments.reduce((sum, apt) => sum + apt.price, 0)
  const averageDuration = completedAppointments.length > 0 
    ? completedAppointments.reduce((sum, apt) => sum + apt.duration, 0) / completedAppointments.length
    : 0
  const completionRate = transformedAppointments.length > 0 
    ? (completedAppointments.length / transformedAppointments.length) * 100 
    : 0

  const drilldownData = {
    appointments: transformedAppointments,
    total: transformedAppointments.length,
    summary: {
      totalRevenue,
      averageDuration: Math.round(averageDuration),
      completionRate: Math.round(completionRate * 100) / 100
    }
  }

  logger.info('Drilldown data retrieved successfully', { 
    appointmentCount: transformedAppointments.length,
    totalRevenue,
    metric,
    value
  })

  return createSuccessResponse(drilldownData)
}