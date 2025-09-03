/**
 * Analytics KPIs API
 * Provides key performance indicators for the salon business
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../../src/lib/validation/schemas'
import { addDays, format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, subYears } from 'date-fns'

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

interface StaffUtilizationData {
  staffId: string
  name: string
  totalAppointments: number
  completedAppointments: number
  totalRevenue: number
  totalDuration: number
}

interface ServiceData {
  serviceId: string
  name: string
  bookingCount: number
  revenue: number
}

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
  }, {} as Record<string, StaffUtilizationData>) || {}

  const staffUtilization = Object.values(staffStats).map((staff) => ({
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
  }, {} as Record<string, ServiceData>) || {}

  const popularServices = Object.values(serviceStats)
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 10)

interface DailyStat {
  date: string
  appointments: number
  revenue: number
  newCustomers: number
}

  // Daily stats for the period
  const dailyStats: DailyStat[] = []
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

  // Calculate comparison data if requested
  let comparisonData = null
  if (query.comparisonPeriod && query.comparisonPeriod !== 'none') {
    let compStartDate: string
    let compEndDate: string
    
    if (query.comparisonPeriod === 'previous_period') {
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      const periodLength = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
      
      compEndDate = format(subDays(startDateObj, 1), 'yyyy-MM-dd')
      compStartDate = format(subDays(startDateObj, periodLength), 'yyyy-MM-dd')
    } else { // previous_year
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      
      compStartDate = format(subYears(startDateObj, 1), 'yyyy-MM-dd')
      compEndDate = format(subYears(endDateObj, 1), 'yyyy-MM-dd')
    }

    // Fetch comparison period data
    let compAppointmentsQuery = supabase
      .from('appointments_with_details')
      .select('*')
      .gte('start_time', `${compStartDate}T00:00:00Z`)
      .lte('start_time', `${compEndDate}T23:59:59Z`)

    if (query.staffId) {
      compAppointmentsQuery = compAppointmentsQuery.eq('staff_id', query.staffId)
    }
    if (query.serviceId) {
      compAppointmentsQuery = compAppointmentsQuery.eq('service_id', query.serviceId)
    }

    const { data: compAppointments } = await compAppointmentsQuery

    if (compAppointments) {
      const compTotalAppointments = compAppointments.length
      const compCompletedAppointments = compAppointments.filter(apt => apt.status === 'completed')
      const compCancelledAppointments = compAppointments.filter(apt => apt.status === 'cancelled')
      const compTotalRevenue = compCompletedAppointments.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100
      const compBookingRate = compTotalAppointments > 0 ? (compCompletedAppointments.length / compTotalAppointments) * 100 : 0
      const compCancellationRate = compTotalAppointments > 0 ? (compCancelledAppointments.length / compTotalAppointments) * 100 : 0

      const createComparison = (current: number, previous: number) => {
        const change = current - previous
        const changePercentage = previous > 0 ? (change / previous) * 100 : 0
        const trend = Math.abs(changePercentage) < 1 ? 'stable' : (changePercentage > 0 ? 'up' : 'down')
        
        return {
          current,
          previous,
          change,
          changePercentage,
          trend
        }
      }

      comparisonData = {
        totalAppointments: createComparison(totalAppointments, compTotalAppointments),
        totalRevenue: createComparison(totalRevenue, compTotalRevenue),
        bookingRate: createComparison(bookingRate, compBookingRate),
        cancellationRate: createComparison(cancellationRate, compCancellationRate)
      }
    }
  }

  // Calculate heatmap data (day of week vs hour)
  const heatmapData: Array<{
    dayOfWeek: number
    hour: number
    appointments: number
    density: number
    revenue?: number
  }> = []

  if (appointments) {
    // Initialize heatmap grid
    const heatmapGrid: Record<string, { appointments: number; revenue: number }> = {}
    
    for (let day = 0; day <= 6; day++) {
      for (let hour = 0; hour <= 23; hour++) {
        heatmapGrid[`${day}-${hour}`] = { appointments: 0, revenue: 0 }
      }
    }

    // Populate grid with appointment data
    appointments.forEach(apt => {
      const aptDate = new Date(apt.start_time)
      const dayOfWeek = aptDate.getDay()
      const hour = aptDate.getHours()
      const key = `${dayOfWeek}-${hour}`
      
      heatmapGrid[key].appointments += 1
      if (apt.status === 'completed') {
        heatmapGrid[key].revenue += (apt.service_price_cents || 0) / 100
      }
    })

    // Find max appointments for density calculation
    const maxAppointments = Math.max(...Object.values(heatmapGrid).map(cell => cell.appointments))

    // Convert to array format
    for (let day = 0; day <= 6; day++) {
      for (let hour = 0; hour <= 23; hour++) {
        const key = `${day}-${hour}`
        const cell = heatmapGrid[key]
        
        heatmapData.push({
          dayOfWeek: day,
          hour,
          appointments: cell.appointments,
          density: maxAppointments > 0 ? cell.appointments / maxAppointments : 0,
          revenue: cell.revenue
        })
      }
    }
  }

  // Get user permissions
  const userRole = context.user.role || 'staff'
  const permissions = {
    canViewAllStaff: userRole === 'admin',
    canViewRevenue: userRole === 'admin' || userRole === 'staff',
    canExportData: userRole === 'admin' || userRole === 'staff',
    canManageReports: userRole === 'admin',
    ownStaffId: userRole === 'staff' ? context.user.id : undefined
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
    },
    ...(comparisonData && { comparison: comparisonData }),
    heatmapData,
    realTimeUpdate: true
  }

  logger.info('KPIs calculated successfully', { 
    totalAppointments,
    totalRevenue,
    staffCount: staffUtilization.length,
    servicesCount: popularServices.length
  })

  return createSuccessResponse({ 
    ...kpiData, 
    permissions 
  })
}