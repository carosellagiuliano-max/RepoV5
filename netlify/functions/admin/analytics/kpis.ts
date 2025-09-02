/**
 * Analytics KPIs API
 * Provides key performance indicators for the salon business
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../../src/lib/validation/schemas'
import { addDays, format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Analytics KPIs request', {
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

      return await handleGetKPIs(event, supabase, logger)
    } catch (error) {
      logger.error('KPIs fetch operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 60, windowMs: 60 * 1000 }
)

async function handleGetKPIs(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.analyticsFilters, event.queryStringParameters || {})
  
  // Set default date range based on period
  let startDate: string
  let endDate: string
  
  if (query.startDate && query.endDate) {
    startDate = query.startDate
    endDate = query.endDate
  } else {
    const now = new Date()
    switch (query.period) {
      case 'day':
        startDate = format(startOfDay(now), 'yyyy-MM-dd')
        endDate = format(endOfDay(now), 'yyyy-MM-dd')
        break
      case 'week':
        startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'month':
      default:
        startDate = format(startOfMonth(now), 'yyyy-MM-dd')
        endDate = format(endOfMonth(now), 'yyyy-MM-dd')
        break
    }
  }

  logger.info('Fetching KPIs for date range', { startDate, endDate, staffId: query.staffId, serviceId: query.serviceId })

  // Build the main appointments query
  let appointmentsQuery = supabase
    .from('appointments_with_details')
    .select('*')
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('start_time', `${endDate}T23:59:59Z`)

  // Apply filters
  if (query.staffId) {
    appointmentsQuery = appointmentsQuery.eq('staff_id', query.staffId)
  }

  if (query.serviceId) {
    appointmentsQuery = appointmentsQuery.eq('service_id', query.serviceId)
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery

  if (appointmentsError) {
    logger.error('Failed to fetch appointments', { error: appointmentsError })
    throw appointmentsError
  }

  // Calculate KPIs
  const totalAppointments = appointments?.length || 0
  const completedAppointments = appointments?.filter(apt => apt.status === 'completed') || []
  const cancelledAppointments = appointments?.filter(apt => apt.status === 'cancelled') || []
  
  const totalRevenue = completedAppointments.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100
  const averageServiceTime = completedAppointments.length > 0 
    ? completedAppointments.reduce((sum, apt) => {
        const start = new Date(apt.start_time)
        const end = new Date(apt.end_time)
        return sum + (end.getTime() - start.getTime())
      }, 0) / completedAppointments.length / (1000 * 60) // Convert to minutes
    : 0

  const bookingRate = totalAppointments > 0 ? (completedAppointments.length / totalAppointments) * 100 : 0
  const cancellationRate = totalAppointments > 0 ? (cancelledAppointments.length / totalAppointments) * 100 : 0

  // Staff utilization
  const staffStats = appointments?.reduce((acc, apt) => {
    const staffId = apt.staff_id
    const staffName = apt.staff_first_name && apt.staff_last_name 
      ? `${apt.staff_first_name} ${apt.staff_last_name}`
      : 'Unknown Staff'

    if (!acc[staffId]) {
      acc[staffId] = {
        staffId,
        name: staffName,
        totalAppointments: 0,
        completedAppointments: 0,
        totalRevenue: 0,
        totalDuration: 0
      }
    }

    acc[staffId].totalAppointments += 1
    if (apt.status === 'completed') {
      acc[staffId].completedAppointments += 1
      acc[staffId].totalRevenue += (apt.service_price_cents || 0) / 100
      
      const start = new Date(apt.start_time)
      const end = new Date(apt.end_time)
      acc[staffId].totalDuration += (end.getTime() - start.getTime()) / (1000 * 60) // minutes
    }

    return acc
  }, {} as Record<string, any>) || {}

  const staffUtilization = Object.values(staffStats).map((staff: any) => ({
    staffId: staff.staffId,
    name: staff.name,
    utilization: staff.totalAppointments > 0 ? (staff.completedAppointments / staff.totalAppointments) * 100 : 0,
    totalAppointments: staff.totalAppointments,
    totalRevenue: staff.totalRevenue
  }))

  // Popular services
  const serviceStats = appointments?.reduce((acc, apt) => {
    const serviceId = apt.service_id
    const serviceName = apt.service_name || 'Unknown Service'

    if (!acc[serviceId]) {
      acc[serviceId] = {
        serviceId,
        name: serviceName,
        bookingCount: 0,
        revenue: 0
      }
    }

    acc[serviceId].bookingCount += 1
    if (apt.status === 'completed') {
      acc[serviceId].revenue += (apt.service_price_cents || 0) / 100
    }

    return acc
  }, {} as Record<string, any>) || {}

  const popularServices = Object.values(serviceStats)
    .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
    .slice(0, 10)

  // Daily stats for the period
  const dailyStats: any[] = []
  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)
  
  for (let date = new Date(startDateObj); date <= endDateObj; date = addDays(date, 1)) {
    const dayString = format(date, 'yyyy-MM-dd')
    const dayAppointments = appointments?.filter(apt => {
      const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd')
      return aptDate === dayString
    }) || []

    const dayCompleted = dayAppointments.filter(apt => apt.status === 'completed')
    const dayRevenue = dayCompleted.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100
    
    // Count new customers (simplified - customers who haven't had appointments before this date)
    const newCustomers = dayAppointments.filter(apt => {
      // For now, we'll count all customers as "new" for this day
      // In a real implementation, we'd check if they had previous appointments
      return apt.status !== 'cancelled'
    }).length

    dailyStats.push({
      date: dayString,
      appointments: dayAppointments.length,
      revenue: dayRevenue,
      newCustomers
    })
  }

  const kpiData = {
    totalAppointments,
    totalRevenue,
    averageServiceTime: Math.round(averageServiceTime),
    bookingRate: Math.round(bookingRate * 100) / 100,
    cancellationRate: Math.round(cancellationRate * 100) / 100,
    staffUtilization,
    popularServices,
    dailyStats,
    period: query.period,
    dateRange: {
      startDate,
      endDate
    }
  }

  logger.info('KPIs calculated successfully', { 
    totalAppointments,
    totalRevenue,
    staffCount: staffUtilization.length,
    servicesCount: popularServices.length
  })

  return createSuccessResponse(kpiData)
}