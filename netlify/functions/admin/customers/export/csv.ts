/**
 * Admin Customer CSV Export API
 * Handles GDPR-compliant CSV export of customer data
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, schemas } from '../../../../src/lib/validation/schemas'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Customer CSV export request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleExportCustomers(event, supabase, logger, context.user.id)

        case 'POST':
          const pathSegments = event.path.split('/').filter(Boolean)
          if (pathSegments.includes('preview')) {
            return await handleExportPreview(event, supabase, logger)
          } else {
            return createErrorResponse({
              statusCode: 404,
              message: 'Endpoint not found',
              code: 'ENDPOINT_NOT_FOUND'
            })
          }

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('CSV export operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 10, windowMs: 60 * 1000 } // Lower rate limit for exports
)

async function handleExportCustomers(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const query = validateQuery(schemas.exportFilters || {
    format: 'string?',
    hasGdprConsent: 'boolean?',
    city: 'string?',
    postalCode: 'string?',
    registeredAfter: 'string?',
    registeredBefore: 'string?',
    includeDeleted: 'boolean?'
  }, event.queryStringParameters || {})

  const exportFormat = query.format || 'basic'
  const filters = {
    hasGdprConsent: query.hasGdprConsent,
    city: query.city,
    postalCode: query.postalCode,
    registeredAfter: query.registeredAfter,
    registeredBefore: query.registeredBefore,
    includeDeleted: query.includeDeleted
  }

  // Remove undefined/null values from filters
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== undefined && value !== null && value !== '')
  )

  logger.info('Starting CSV export', { 
    format: exportFormat, 
    filters: cleanFilters,
    userId 
  })

  // Validate export format
  if (!['basic', 'detailed', 'gdpr_full'].includes(exportFormat)) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Invalid export format. Must be basic, detailed, or gdpr_full',
      code: 'INVALID_FORMAT'
    })
  }

  // For detailed and gdpr_full exports, require GDPR consent
  if (exportFormat !== 'basic') {
    cleanFilters.hasGdprConsent = true
  }

  try {
    // Use the database function to get customer data
    const { data: customerData, error } = await supabase.rpc('export_customers_csv', {
      filters: cleanFilters,
      export_format: exportFormat
    })

    if (error) {
      logger.error('Failed to export customer data', { error })
      throw error
    }

    if (!customerData || customerData.length === 0) {
      logger.info('No customers found for export criteria')
      return createSuccessResponse({
        csv: '',
        filename: `customers-export-${new Date().toISOString().split('T')[0]}.csv`,
        count: 0,
        message: 'No customers match the export criteria'
      })
    }

    // Convert JSON data to CSV
    const csvContent = jsonToCsv(customerData.map(row => row.customer_data), exportFormat)
    const filename = `customers-${exportFormat}-${new Date().toISOString().split('T')[0]}.csv`

    // Log the export activity
    await supabase
      .from('customer_audit_log')
      .insert({
        customer_id: null, // Bulk export, no specific customer
        action: 'csv_export',
        performed_by: userId,
        reason: `CSV export (${exportFormat}) with filters: ${JSON.stringify(cleanFilters)}`,
        data_after: {
          export_format: exportFormat,
          filters: cleanFilters,
          record_count: customerData.length,
          exported_at: new Date().toISOString()
        }
      })

    logger.info('CSV export completed successfully', { 
      count: customerData.length,
      format: exportFormat
    })

    return createSuccessResponse({
      csv: csvContent,
      filename,
      count: customerData.length,
      format: exportFormat,
      filters: cleanFilters
    })

  } catch (error) {
    logger.error('Export failed', { error })
    throw error
  }
}

async function handleExportPreview(event: any, supabase: SupabaseClient, logger: Logger) {
  const body = JSON.parse(event.body || '{}')
  const { filters, format } = validateBody(schemas.exportPreview || {
    filters: 'object',
    format: 'string'
  }, body)

  const exportFormat = format || 'basic'

  logger.info('Generating export preview', { format: exportFormat, filters })

  // Build count query based on filters
  let countQuery = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)

  // Apply filters for counting
  if (filters.hasGdprConsent === true) {
    countQuery = countQuery.eq('gdpr_consent_given', true)
  }

  if (filters.city) {
    countQuery = countQuery.ilike('address_city', `%${filters.city}%`)
  }

  if (filters.postalCode) {
    countQuery = countQuery.eq('address_postal_code', filters.postalCode)
  }

  if (filters.registeredAfter) {
    countQuery = countQuery.gte('created_at', filters.registeredAfter)
  }

  if (filters.registeredBefore) {
    countQuery = countQuery.lte('created_at', filters.registeredBefore)
  }

  if (filters.includeDeleted === true) {
    countQuery = countQuery.neq('is_deleted', false) // Include all
  }

  const { count, error } = await countQuery

  if (error) {
    logger.error('Failed to get export preview count', { error })
    throw error
  }

  // Get sample of first 5 records for preview
  const { data: sampleData, error: sampleError } = await supabase.rpc('export_customers_csv', {
    filters: {
      ...filters,
      hasGdprConsent: exportFormat !== 'basic' ? true : filters.hasGdprConsent
    },
    export_format: exportFormat
  })

  if (sampleError) {
    logger.error('Failed to get sample data', { error: sampleError })
    throw sampleError
  }

  const sampleRecords = sampleData?.slice(0, 5).map(row => row.customer_data) || []
  const sampleCsv = sampleRecords.length > 0 ? jsonToCsv(sampleRecords, exportFormat) : ''

  const preview = {
    total_records: count || 0,
    format: exportFormat,
    filters,
    sample_csv: sampleCsv,
    sample_records: sampleRecords,
    estimated_file_size: estimateFileSize(count || 0, exportFormat),
    gdpr_compliance: {
      consent_required: exportFormat !== 'basic',
      consent_filtered: filters.hasGdprConsent === true || exportFormat !== 'basic'
    }
  }

  logger.info('Export preview generated', { 
    totalRecords: count,
    sampleCount: sampleRecords.length
  })

  return createSuccessResponse(preview)
}

function jsonToCsv(data: any[], format: string): string {
  if (!data || data.length === 0) {
    return ''
  }

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach(obj => {
    Object.keys(obj).forEach(key => allKeys.add(key))
  })

  const headers = Array.from(allKeys).sort()
  
  // Create CSV header
  const csvLines = [headers.map(escapeCSVField).join(',')]
  
  // Create CSV rows
  data.forEach(obj => {
    const row = headers.map(header => {
      const value = obj[header]
      return escapeCSVField(formatCSVValue(value))
    })
    csvLines.push(row.join(','))
  })
  
  return csvLines.join('\n')
}

function escapeCSVField(field: string): string {
  if (field == null) return ''
  
  const stringField = String(field)
  
  // If field contains comma, newline, or quote, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
    return '"' + stringField.replace(/"/g, '""') + '"'
  }
  
  return stringField
}

function formatCSVValue(value: any): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function estimateFileSize(recordCount: number, format: string): string {
  // Rough estimates based on format
  let bytesPerRecord = 100 // basic format
  
  if (format === 'detailed') {
    bytesPerRecord = 300
  } else if (format === 'gdpr_full') {
    bytesPerRecord = 500
  }
  
  const totalBytes = recordCount * bytesPerRecord
  
  if (totalBytes < 1024) return `${totalBytes} B`
  if (totalBytes < 1024 * 1024) return `${Math.round(totalBytes / 1024)} KB`
  if (totalBytes < 1024 * 1024 * 1024) return `${Math.round(totalBytes / (1024 * 1024))} MB`
  return `${Math.round(totalBytes / (1024 * 1024 * 1024))} GB`
}