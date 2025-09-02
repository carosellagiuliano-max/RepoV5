/**
 * Analytics Export API
 * Exports analytics data as CSV files
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { validateQuery } from '../../../src/lib/validation/schemas'
import { z } from 'zod'

// Validation schema for export queries
const exportQuerySchema = z.object({
  type: z.enum(['appointments', 'staff', 'services', 'revenue']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  staffId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  format: z.enum(['csv']).default('csv')
})

// Helper function to convert JSON to CSV
function jsonToCSV(data: any[], headers: string[]): string {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n'
  }

  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value == null) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })

  return csvHeaders + '\n' + csvRows.join('\n')
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount)
}

// Helper function to format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE')
}

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Analytics export request', {
      method: event.httpMethod,
      userId: context.user.id,
      role: context.user.role
    })

    // Ensure user is admin
    if (context.user.role !== 'admin') {
      logger.warn('Unauthorized analytics export attempt', { userId: context.user.id, role: context.user.role })
      return createErrorResponse({
        statusCode: 403,
        message: 'Admin access required for analytics export',
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
      const queryValidation = validateQuery(event, exportQuerySchema)
      if (!queryValidation.success) {
        return createErrorResponse({
          statusCode: 400,
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: queryValidation.error
        })
      }

      const { type, startDate, endDate, staffId, serviceId, format } = queryValidation.data

      // Set default date range if not provided
      const defaultEndDate = new Date().toISOString().split('T')[0]
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const finalStartDate = startDate || defaultStartDate
      const finalEndDate = endDate || defaultEndDate

      logger.info('Exporting analytics data', {
        type,
        startDate: finalStartDate,
        endDate: finalEndDate,
        staffId,
        serviceId,
        format
      })

      // Get export data from database
      const { data: exportData, error: exportError } = await supabase
        .rpc('get_analytics_export_data', {
          export_type: type,
          start_date: finalStartDate,
          end_date: finalEndDate,
          staff_filter: staffId || null,
          service_filter: serviceId || null
        })

      if (exportError) {
        logger.error('Failed to fetch export data', { error: exportError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch export data',
          code: 'DATABASE_ERROR'
        })
      }

      // Process data based on export type
      let csvData: string
      let filename: string
      const timestamp = new Date().toISOString().split('T')[0]

      switch (type) {
        case 'appointments': {
          const appointmentRows = exportData.map(row => {
            const data = row.export_row
            return {
              'Datum': formatDate(data.date),
              'Mitarbeiter': data.staff_name || '',
              'Service': data.service_name || '',
              'Kategorie': data.service_category || '',
              'Status': data.status || '',
              'Preis': formatCurrency(data.price || 0),
              'Dauer (Min)': data.duration_minutes || ''
            }
          })
          
          csvData = jsonToCSV(appointmentRows, [
            'Datum', 'Mitarbeiter', 'Service', 'Kategorie', 'Status', 'Preis', 'Dauer (Min)'
          ])
          filename = `termine_export_${timestamp}.csv`
          break
        }

        case 'staff': {
          const staffRows = exportData.map(row => {
            const data = row.export_row
            return {
              'Mitarbeiter': data.staff_name || '',
              'Termine Gesamt': data.total_appointments || 0,
              'Termine Abgeschlossen': data.completed_appointments || 0,
              'Umsatz Gesamt': formatCurrency(data.total_revenue || 0),
              'Durchschnittspreis': formatCurrency(data.average_ticket || 0),
              'Auslastung (%)': `${data.utilization_rate || 0}%`
            }
          })
          
          csvData = jsonToCSV(staffRows, [
            'Mitarbeiter', 'Termine Gesamt', 'Termine Abgeschlossen', 'Umsatz Gesamt', 'Durchschnittspreis', 'Auslastung (%)'
          ])
          filename = `mitarbeiter_export_${timestamp}.csv`
          break
        }

        case 'services': {
          const serviceRows = exportData.map(row => {
            const data = row.export_row
            return {
              'Service': data.service_name || '',
              'Kategorie': data.service_category || '',
              'Buchungen Gesamt': data.total_bookings || 0,
              'Abgeschlossen': data.completed_bookings || 0,
              'Umsatz Gesamt': formatCurrency(data.total_revenue || 0),
              'Durchschnittspreis': formatCurrency(data.average_price || 0),
              'Letzte 30 Tage': data.bookings_last_30_days || 0
            }
          })
          
          csvData = jsonToCSV(serviceRows, [
            'Service', 'Kategorie', 'Buchungen Gesamt', 'Abgeschlossen', 'Umsatz Gesamt', 'Durchschnittspreis', 'Letzte 30 Tage'
          ])
          filename = `services_export_${timestamp}.csv`
          break
        }

        case 'revenue': {
          const revenueRows = exportData.map(row => {
            const data = row.export_row
            return {
              'Datum': formatDate(data.date),
              'Termine Gesamt': data.total_appointments || 0,
              'Abgeschlossen': data.completed_appointments || 0,
              'Tagesumsatz': formatCurrency(data.daily_revenue || 0),
              'Durchschnittspreis': formatCurrency(data.average_ticket || 0),
              'Unique Kunden': data.unique_customers || 0
            }
          })
          
          csvData = jsonToCSV(revenueRows, [
            'Datum', 'Termine Gesamt', 'Abgeschlossen', 'Tagesumsatz', 'Durchschnittspreis', 'Unique Kunden'
          ])
          filename = `umsatz_export_${timestamp}.csv`
          break
        }

        default:
          return createErrorResponse({
            statusCode: 400,
            message: 'Invalid export type',
            code: 'INVALID_EXPORT_TYPE'
          })
      }

      logger.info('Analytics export completed', {
        type,
        filename,
        rowCount: exportData.length,
        csvSize: csvData.length
      })

      // Return CSV data with appropriate headers
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: csvData
      }

    } catch (error) {
      logger.error('Analytics export operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to export analytics data',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  {
    requiredRoles: ['admin'],
    rateLimitKey: 'analytics-export',
    rateLimitMax: 5, // Limit exports to 5 per minute
    rateLimitWindow: 60000
  }
)