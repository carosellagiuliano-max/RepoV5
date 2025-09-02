/**
 * Enhanced Admin Appointments List API
 * Web-optimized queries with pagination, keyset pagination, and advanced filtering
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../src/lib/validation/schemas'
import { AppointmentWithDetails } from '../../../src/lib/types/database'
import { z } from 'zod'

// Enhanced filters schema for admin appointments
const adminAppointmentFiltersSchema = schemas.appointmentFilters.extend({
  view: z.enum(['day', 'week', 'month']).optional(),
  includeDetails: z.coerce.boolean().optional().default(true),
  includeStats: z.coerce.boolean().optional().default(false),
  cursor: z.string().optional(), // For keyset pagination
  direction: z.enum(['next', 'prev']).optional().default('next')
})

type AdminAppointmentFilters = z.infer<typeof adminAppointmentFiltersSchema>

interface AppointmentListResponse {
  appointments: AppointmentWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats?: AppointmentStats
  cursor?: {
    next?: string
    prev?: string
  }
}

interface AppointmentStats {
  todayCount: number
  todayRevenue: number
  statusBreakdown: Array<{
    status: string
    count: number
    percentage: number
  }>
  topStaff: Array<{
    staffId: string
    staffName: string
    appointmentCount: number
    revenue: number
  }>
  topServices: Array<{
    serviceId: string
    serviceName: string
    bookingCount: number
    revenue: number
  }>
}

interface CursorData {
  timestamp: string
  id: string
}

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin appointments list request', {
      method: event.httpMethod,
      userId: context.user.id
    })

    if (event.httpMethod !== 'GET') {
      return createErrorResponse({
        statusCode: 405,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
    }

    try {
      const filters = validateQuery(adminAppointmentFiltersSchema, event.queryStringParameters || {})

      // Use keyset pagination for better performance on large datasets
      const useKeysetPagination = !!filters.cursor
      let appointmentsQuery

      if (useKeysetPagination) {
        appointmentsQuery = buildKeysetQuery(supabase, filters)
      } else {
        appointmentsQuery = buildOffsetQuery(supabase, filters)
      }

      // Apply filters
      appointmentsQuery = applyFilters(appointmentsQuery, filters)

      // Apply sorting
      const sortColumn = filters.sortBy || 'start_time'
      const sortOrder = filters.sortOrder || 'asc'
      appointmentsQuery = appointmentsQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

      // Apply pagination
      if (!useKeysetPagination) {
        const from = (filters.page - 1) * filters.limit
        const to = from + filters.limit - 1
        appointmentsQuery = appointmentsQuery.range(from, to)
      } else {
        appointmentsQuery = appointmentsQuery.limit(filters.limit)
      }

      const { data: appointments, error, count } = await appointmentsQuery

      if (error) {
        logger.error('Failed to fetch appointments', { error })
        throw error
      }

      // Build response
      const response: AppointmentListResponse = {
        appointments: appointments || [],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / filters.limit) : 0
        }
      }

      // Add keyset pagination info
      if (useKeysetPagination && appointments && appointments.length > 0) {
        response.cursor = {
          next: generateCursor(appointments[appointments.length - 1], sortColumn),
          prev: generateCursor(appointments[0], sortColumn)
        }
      }

      // Add statistics if requested
      if (filters.includeStats) {
        response.stats = await getAppointmentStats(supabase, filters, logger)
      }

      logger.info('Appointments fetched successfully', { 
        count: appointments?.length,
        useKeysetPagination,
        includeStats: filters.includeStats
      })

      return createSuccessResponse(response)
    } catch (error) {
      logger.error('Appointments list operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 100, windowMs: 60 * 1000 }
)

function buildKeysetQuery(supabase: ReturnType<typeof createAdminClient>, filters: AdminAppointmentFilters) {
  let query = supabase
    .from('appointments_with_details')
    .select(`
      id,
      customer_id,
      staff_id,
      service_id,
      start_time,
      end_time,
      status,
      notes,
      cancellation_reason,
      cancelled_at,
      created_at,
      updated_at,
      customer_name,
      customer_email,
      customer_phone,
      staff_name,
      staff_email,
      staff_phone,
      service_name,
      service_description,
      service_duration_minutes,
      service_price_cents,
      service_category
    `, { count: 'exact' })

  // Apply cursor-based filtering
  if (filters.cursor) {
    const { timestamp, id } = parseCursor(filters.cursor)
    const operator = filters.direction === 'next' ? 'gt' : 'lt'
    
    query = query.or(`start_time.${operator}.${timestamp},and(start_time.eq.${timestamp},id.${operator}.${id})`)
  }

  return query
}

function buildOffsetQuery(supabase: ReturnType<typeof createAdminClient>, filters: AdminAppointmentFilters) {
  return supabase
    .from('appointments_with_details')
    .select(`
      id,
      customer_id,
      staff_id,
      service_id,
      start_time,
      end_time,
      status,
      notes,
      cancellation_reason,
      cancelled_at,
      created_at,
      updated_at,
      customer_name,
      customer_email,
      customer_phone,
      staff_name,
      staff_email,
      staff_phone,
      service_name,
      service_description,
      service_duration_minutes,
      service_price_cents,
      service_category
    `, { count: 'exact' })
}

function applyFilters(query: ReturnType<typeof createAdminClient>['from'], filters: AdminAppointmentFilters) {
  // Staff filter
  if (filters.staffId) {
    query = query.eq('staff_id', filters.staffId)
  }

  // Service filter
  if (filters.serviceId) {
    query = query.eq('service_id', filters.serviceId)
  }

  // Customer filter
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  // Status filter
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  // Date range filters
  if (filters.startDate) {
    query = query.gte('start_time', filters.startDate + 'T00:00:00Z')
  }

  if (filters.endDate) {
    query = query.lte('start_time', filters.endDate + 'T23:59:59Z')
  }

  // View-based date filtering
  if (filters.view) {
    const now = new Date()
    let startDate: Date, endDate: Date

    switch (filters.view) {
      case 'day': {
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.setHours(23, 59, 59, 999))
        break
      }
      case 'week': {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
        weekStart.setHours(0, 0, 0, 0)
        
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6) // Sunday
        weekEnd.setHours(23, 59, 59, 999)
        
        startDate = weekStart
        endDate = weekEnd
        break
      }
      case 'month': {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        break
      }
      default:
        return query
    }

    query = query
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
  }

  // Search filter
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(`
      customer_name.ilike.${searchTerm},
      customer_email.ilike.${searchTerm},
      staff_name.ilike.${searchTerm},
      service_name.ilike.${searchTerm},
      notes.ilike.${searchTerm}
    `)
  }

  return query
}

function generateCursor(record: AppointmentWithDetails, sortColumn: string): string {
  const timestamp = record[sortColumn] || record.start_time
  const id = record.id
  return Buffer.from(JSON.stringify({ timestamp, id })).toString('base64')
}

function parseCursor(cursor: string): CursorData {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString())
  } catch {
    throw new Error('Invalid cursor format')
  }
}

async function getAppointmentStats(
  supabase: ReturnType<typeof createAdminClient>, 
  filters: AdminAppointmentFilters, 
  logger: ReturnType<typeof createLogger>
): Promise<AppointmentStats> {
  try {
    // Build base query for stats
    let statsQuery = supabase
      .from('appointments_with_details')
      .select('status, service_price_cents, start_time')

    // Apply same filters as main query (excluding pagination)
    const statsFilters = { ...filters }
    delete statsFilters.page
    delete statsFilters.limit
    delete statsFilters.cursor
    delete statsFilters.direction
    
    statsQuery = applyFilters(statsQuery, statsFilters)

    const { data: statsData, error } = await statsQuery

    if (error) {
      logger.warn('Failed to fetch stats', { error })
      return null
    }

    // Calculate statistics
    const stats = {
      total: statsData?.length || 0,
      confirmed: statsData?.filter(a => a.status === 'confirmed').length || 0,
      pending: statsData?.filter(a => a.status === 'pending').length || 0,
      completed: statsData?.filter(a => a.status === 'completed').length || 0,
      cancelled: statsData?.filter(a => a.status === 'cancelled').length || 0,
      totalRevenue: statsData
        ?.filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.service_price_cents || 0), 0) || 0,
      averageAppointmentsPerDay: 0
    }

    // Calculate average appointments per day
    if (statsData && statsData.length > 0) {
      const dates = [...new Set(statsData.map(a => a.start_time.split('T')[0]))]
      stats.averageAppointmentsPerDay = Math.round((stats.total / dates.length) * 10) / 10
    }

    return stats
  } catch (error) {
    logger.warn('Error calculating stats', { error })
    return null
  }
}