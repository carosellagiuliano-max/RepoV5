/**
 * Analytics CSV Export API
 * Exports analytics data in CSV format
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../../src/lib/validation/schemas'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Analytics CSV export request', {
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

      return await handleCSVExport(event, supabase, logger)
    } catch (error) {
      logger.error('CSV export operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 20, windowMs: 60 * 1000 } // Lower rate limit for exports
)

async function handleCSVExport(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.csvExportFilters, event.queryStringParameters || {})
  
  // Set default date range to current month
  const now = new Date()
  const startDate = query.startDate || format(startOfMonth(now), 'yyyy-MM-dd')
  const endDate = query.endDate || format(endOfMonth(now), 'yyyy-MM-dd')

  logger.info('Generating CSV export', { 
    type: query.type, 
    startDate, 
    endDate, 
    staffId: query.staffId, 
    serviceId: query.serviceId 
  })

  let csvContent: string
  let filename: string

  switch (query.type) {
    case 'appointments': {
      const result = await generateAppointmentsCSV(supabase, startDate, endDate, query.staffId, query.serviceId)
      csvContent = result.csv
      filename = `appointments_${startDate}_${endDate}.csv`
      break
    }

    case 'staff-utilization': {
      const staffResult = await generateStaffUtilizationCSV(supabase, startDate, endDate, query.staffId)
      csvContent = staffResult.csv
      filename = `staff_utilization_${startDate}_${endDate}.csv`
      break
    }

    case 'services-revenue': {
      const servicesResult = await generateServicesRevenueCSV(supabase, startDate, endDate, query.serviceId)
      csvContent = servicesResult.csv
      filename = `services_revenue_${startDate}_${endDate}.csv`
      break
    }

    default:
      return createErrorResponse({
        statusCode: 400,
        message: 'Invalid export type',
        code: 'INVALID_EXPORT_TYPE'
      })
  }

  logger.info('CSV export generated successfully', { 
    type: query.type,
    size: csvContent.length,
    filename
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    body: csvContent
  }
}

async function generateAppointmentsCSV(
  supabase: SupabaseClient, 
  startDate: string, 
  endDate: string, 
  staffId?: string, 
  serviceId?: string
): Promise<{ csv: string }> {
  let query = supabase
    .from('appointments_with_details')
    .select('*')
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('start_time', `${endDate}T23:59:59Z`)
    .order('start_time', { ascending: true })

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  if (serviceId) {
    query = query.eq('service_id', serviceId)
  }

  const { data: appointments, error } = await query

  if (error) {
    throw error
  }

  // CSV Headers
  const headers = [
    'Datum',
    'Zeit',
    'Kunde Name',
    'Kunde Email',
    'Mitarbeiter',
    'Service',
    'Dauer (Min)',
    'Preis (CHF)',
    'Status',
    'Notizen'
  ]

  // CSV Rows
  const rows = appointments?.map(apt => [
    format(new Date(apt.start_time), 'dd.MM.yyyy'),
    format(new Date(apt.start_time), 'HH:mm'),
    apt.customer_first_name && apt.customer_last_name 
      ? `${apt.customer_first_name} ${apt.customer_last_name}` 
      : apt.customer_email || 'N/A',
    apt.customer_email || 'N/A',
    apt.staff_first_name && apt.staff_last_name 
      ? `${apt.staff_first_name} ${apt.staff_last_name}` 
      : 'N/A',
    apt.service_name || 'N/A',
    apt.service_duration_minutes || 0,
    ((apt.service_price_cents || 0) / 100).toFixed(2),
    translateStatus(apt.status),
    (apt.notes || '').replace(/"/g, '""') // Escape quotes
  ]) || []

  // Generate CSV content
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return { csv: csvContent }
}

interface StaffStatistics {
  name: string
  totalAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  totalRevenue: number
  totalWorkingMinutes: number
}

interface ServiceStatistics {
  name: string
  category: string
  bookingCount: number
  totalRevenue: number
  averagePrice: number
}

async function generateStaffUtilizationCSV(
  supabase: SupabaseClient, 
  startDate: string, 
  endDate: string, 
  staffId?: string
): Promise<{ csv: string }> {
  let query = supabase
    .from('appointments_with_details')
    .select('*')
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('start_time', `${endDate}T23:59:59Z`)

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  const { data: appointments, error } = await query

  if (error) {
    throw error
  }

  // Calculate staff utilization
  const staffStats = appointments?.reduce((acc, apt) => {
    const staffKey = apt.staff_id
    const staffName = apt.staff_first_name && apt.staff_last_name 
      ? `${apt.staff_first_name} ${apt.staff_last_name}`
      : 'Unbekannt'

    if (!acc[staffKey]) {
      acc[staffKey] = {
        name: staffName,
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        totalRevenue: 0,
        totalWorkingMinutes: 0
      }
    }

    acc[staffKey].totalAppointments += 1

    const duration = apt.service_duration_minutes || 0
    acc[staffKey].totalWorkingMinutes += duration

    if (apt.status === 'completed') {
      acc[staffKey].completedAppointments += 1
      acc[staffKey].totalRevenue += (apt.service_price_cents || 0) / 100
    } else if (apt.status === 'cancelled') {
      acc[staffKey].cancelledAppointments += 1
    }

    return acc
  }, {} as Record<string, StaffStatistics>) || {}

  // CSV Headers
  const headers = [
    'Mitarbeiter',
    'Termine Gesamt',
    'Termine Abgeschlossen',
    'Termine Storniert',
    'Auslastung (%)',
    'Arbeitszeit (Stunden)',
    'Umsatz (CHF)'
  ]

  // CSV Rows
  const rows = Object.values(staffStats).map((staff) => {
    const utilizationRate = staff.totalAppointments > 0 
      ? ((staff.completedAppointments / staff.totalAppointments) * 100).toFixed(1)
      : '0.0'
    
    const workingHours = (staff.totalWorkingMinutes / 60).toFixed(1)

    return [
      staff.name,
      staff.totalAppointments,
      staff.completedAppointments,
      staff.cancelledAppointments,
      utilizationRate,
      workingHours,
      staff.totalRevenue.toFixed(2)
    ]
  })

  // Generate CSV content
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return { csv: csvContent }
}

async function generateServicesRevenueCSV(
  supabase: SupabaseClient, 
  startDate: string, 
  endDate: string, 
  serviceId?: string
): Promise<{ csv: string }> {
  let query = supabase
    .from('appointments_with_details')
    .select('*')
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('start_time', `${endDate}T23:59:59Z`)
    .eq('status', 'completed') // Only completed appointments for revenue

  if (serviceId) {
    query = query.eq('service_id', serviceId)
  }

  const { data: appointments, error } = await query

  if (error) {
    throw error
  }

  // Calculate service revenue
  const serviceStats = appointments?.reduce((acc, apt) => {
    const serviceKey = apt.service_id
    const serviceName = apt.service_name || 'Unbekannt'
    const serviceCategory = apt.service_category || 'Allgemein'

    if (!acc[serviceKey]) {
      acc[serviceKey] = {
        name: serviceName,
        category: serviceCategory,
        bookingCount: 0,
        totalRevenue: 0,
        averagePrice: 0
      }
    }

    acc[serviceKey].bookingCount += 1
    const price = (apt.service_price_cents || 0) / 100
    acc[serviceKey].totalRevenue += price

    return acc
  }, {} as Record<string, ServiceStatistics>) || {}

  // Calculate average prices
  Object.values(serviceStats).forEach((service) => {
    service.averagePrice = service.bookingCount > 0 
      ? service.totalRevenue / service.bookingCount 
      : 0
  })

  // CSV Headers
  const headers = [
    'Service',
    'Kategorie',
    'Anzahl Buchungen',
    'Gesamtumsatz (CHF)',
    'Durchschnittspreis (CHF)'
  ]

  // CSV Rows - sorted by revenue
  const rows = Object.values(serviceStats)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((service) => [
      service.name,
      service.category,
      service.bookingCount,
      service.totalRevenue.toFixed(2),
      service.averagePrice.toFixed(2)
    ])

  // Generate CSV content
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return { csv: csvContent }
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Ausstehend',
    'confirmed': 'Bestätigt',
    'completed': 'Abgeschlossen',
    'cancelled': 'Storniert',
    'no_show': 'Nicht erschienen'
  }

  return statusMap[status] || status
}