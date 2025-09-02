/**
 * Analytics Metrics API
 * Provides aggregated analytics data for the admin dashboard
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../src/lib/validation/schemas'
import { z } from 'zod'

// Validation schema for analytics queries
const analyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  staffId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  period: z.enum(['day', 'week', 'month']).default('month')
})

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Analytics metrics request', {
      method: event.httpMethod,
      userId: context.user.id,
      role: context.user.role
    })

    // Ensure user is admin
    if (context.user.role !== 'admin') {
      logger.warn('Unauthorized analytics access attempt', { userId: context.user.id, role: context.user.role })
      return createErrorResponse({
        statusCode: 403,
        message: 'Admin access required for analytics',
        code: 'INSUFFICIENT_PERMISSIONS'
      })
    }

    try {
      if (event.httpMethod !== 'GET') {
        return createErrorResponse({
          statusCode: 405,
          message: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
      }

      // Validate query parameters
      const queryValidation = validateQuery(event, analyticsQuerySchema)
      if (!queryValidation.success) {
        return createErrorResponse({
          statusCode: 400,
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: queryValidation.error
        })
      }

      const { startDate, endDate, staffId, serviceId, period } = queryValidation.data

      // Set default date range if not provided
      const defaultEndDate = new Date().toISOString().split('T')[0]
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const finalStartDate = startDate || defaultStartDate
      const finalEndDate = endDate || defaultEndDate

      logger.info('Fetching analytics metrics', {
        startDate: finalStartDate,
        endDate: finalEndDate,
        staffId,
        serviceId,
        period
      })

      // Get basic appointment metrics
      const { data: appointmentMetrics, error: metricsError } = await supabase
        .rpc('get_appointment_metrics_secure', {
          start_date: finalStartDate,
          end_date: finalEndDate,
          staff_filter: staffId || null,
          service_filter: serviceId || null
        })

      if (metricsError) {
        logger.error('Failed to fetch appointment metrics', { error: metricsError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch appointment metrics',
          code: 'DATABASE_ERROR'
        })
      }

      // Get staff performance metrics
      const { data: staffMetrics, error: staffError } = await supabase
        .rpc('get_staff_performance_metrics_secure', {
          start_date: finalStartDate,
          end_date: finalEndDate
        })

      if (staffError) {
        logger.error('Failed to fetch staff metrics', { error: staffError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch staff metrics',
          code: 'DATABASE_ERROR'
        })
      }

      // Get service popularity data
      const { data: serviceData, error: serviceError } = await supabase
        .from('analytics_service_popularity')
        .select('*')
        .limit(10)
        .order('total_bookings', { ascending: false })

      if (serviceError) {
        logger.error('Failed to fetch service popularity', { error: serviceError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch service popularity',
          code: 'DATABASE_ERROR'
        })
      }

      // Get revenue summary based on period
      let revenuePeriodQuery = supabase
        .from('analytics_revenue_summary')
        .select('*')
        .gte('date', finalStartDate)
        .lte('date', finalEndDate)

      if (period === 'week') {
        revenuePeriodQuery = revenuePeriodQuery.order('week', { ascending: false }).limit(12)
      } else if (period === 'month') {
        revenuePeriodQuery = revenuePeriodQuery.order('month', { ascending: false }).limit(12)
      } else {
        revenuePeriodQuery = revenuePeriodQuery.order('date', { ascending: false }).limit(30)
      }

      const { data: revenueData, error: revenueError } = await revenuePeriodQuery

      if (revenueError) {
        logger.error('Failed to fetch revenue data', { error: revenueError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch revenue data',
          code: 'DATABASE_ERROR'
        })
      }

      // Get appointment trend data for charts
      const { data: appointmentTrend, error: trendError } = await supabase
        .from('analytics_appointment_summary')
        .select('appointment_date, status, price, service_category')
        .gte('appointment_date', finalStartDate)
        .lte('appointment_date', finalEndDate)
        .order('appointment_date', { ascending: true })

      if (trendError) {
        logger.error('Failed to fetch appointment trend', { error: trendError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch appointment trend',
          code: 'DATABASE_ERROR'
        })
      }

      // Process trend data for charts
      const trendByDate = appointmentTrend.reduce((acc, appointment) => {
        const date = appointment.appointment_date
        if (!acc[date]) {
          acc[date] = {
            date,
            appointments: 0,
            revenue: 0,
            completed: 0,
            cancelled: 0
          }
        }
        acc[date].appointments += 1
        if (appointment.status === 'completed') {
          acc[date].completed += 1
          acc[date].revenue += parseFloat(appointment.price) || 0
        } else if (appointment.status === 'cancelled') {
          acc[date].cancelled += 1
        }
        return acc
      }, {})

      const chartData = Object.values(trendByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Calculate growth percentages
      const previousPeriodStart = new Date(finalStartDate)
      previousPeriodStart.setDate(previousPeriodStart.getDate() - (new Date(finalEndDate).getTime() - new Date(finalStartDate).getTime()) / (24 * 60 * 60 * 1000))
      
      const { data: previousMetrics } = await supabase
        .rpc('get_appointment_metrics_secure', {
          start_date: previousPeriodStart.toISOString().split('T')[0],
          end_date: finalStartDate,
          staff_filter: staffId || null,
          service_filter: serviceId || null
        })

      // Calculate growth rates
      const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) return 0
        return ((current - previous) / previous * 100).toFixed(1)
      }

      const currentMetrics = appointmentMetrics[0] || {}
      const prevMetrics = previousMetrics?.[0] || {}

      const response = {
        period: {
          startDate: finalStartDate,
          endDate: finalEndDate,
          period
        },
        overview: {
          totalAppointments: parseInt(currentMetrics.total_appointments) || 0,
          completedAppointments: parseInt(currentMetrics.completed_appointments) || 0,
          cancelledAppointments: parseInt(currentMetrics.cancelled_appointments) || 0,
          totalRevenue: parseFloat(currentMetrics.total_revenue) || 0,
          averageTicket: parseFloat(currentMetrics.average_ticket) || 0,
          uniqueCustomers: parseInt(currentMetrics.unique_customers) || 0,
          averageDuration: parseFloat(currentMetrics.average_duration) || 0,
          // Growth calculations
          appointmentsGrowth: calculateGrowth(
            parseInt(currentMetrics.total_appointments) || 0,
            parseInt(prevMetrics.total_appointments) || 0
          ),
          revenueGrowth: calculateGrowth(
            parseFloat(currentMetrics.total_revenue) || 0,
            parseFloat(prevMetrics.total_revenue) || 0
          ),
          customersGrowth: calculateGrowth(
            parseInt(currentMetrics.unique_customers) || 0,
            parseInt(prevMetrics.unique_customers) || 0
          )
        },
        staffPerformance: staffMetrics || [],
        servicePopularity: serviceData || [],
        chartData: chartData,
        revenueData: revenueData || []
      }

      logger.info('Analytics metrics fetched successfully', {
        totalAppointments: response.overview.totalAppointments,
        totalRevenue: response.overview.totalRevenue,
        staffCount: response.staffPerformance.length,
        serviceCount: response.servicePopularity.length
      })

      return createSuccessResponse(response)

    } catch (error) {
      logger.error('Analytics metrics operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to fetch analytics data',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  {
    requiredRoles: ['admin'],
    rateLimitKey: 'analytics-metrics',
    rateLimitMax: 20, // Allow 20 requests per minute for analytics
    rateLimitWindow: 60000
  }
)