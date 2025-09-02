/**
 * Admin Customer CSV Import API
 * Handles CSV import with validation, mapping, and dry-run support
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../../src/lib/auth/netlify-auth'
import { validateBody, schemas } from '../../../../src/lib/validation/schemas'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

interface ImportRow {
  rowNumber: number
  data: Record<string, string>
  processedData?: Record<string, any>
  errors: string[]
  warnings: string[]
  status: 'pending' | 'valid' | 'invalid' | 'duplicate' | 'success' | 'error'
  customerId?: string
}

interface FieldMapping {
  csvColumn: string
  databaseField: string
  required: boolean
  transform?: string // 'date', 'boolean', 'phone', 'email'
}

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Customer CSV import request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      
      switch (event.httpMethod) {
        case 'POST':
          if (pathSegments.includes('validate')) {
            return await handleValidateImport(event, supabase, logger, context.user.id)
          } else if (pathSegments.includes('execute')) {
            return await handleExecuteImport(event, supabase, logger, context.user.id)
          } else {
            return createErrorResponse({
              statusCode: 404,
              message: 'Endpoint not found',
              code: 'ENDPOINT_NOT_FOUND'
            })
          }

        case 'GET':
          if (pathSegments.includes('logs')) {
            return await handleGetImportLogs(event, supabase, logger)
          } else if (pathSegments.includes('template')) {
            return await handleGetImportTemplate(event, supabase, logger)
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
      logger.error('CSV import operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 5, windowMs: 60 * 1000 } // Very low rate limit for imports
)

async function handleValidateImport(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const body = JSON.parse(event.body || '{}')
  const { 
    csvData, 
    filename, 
    fieldMapping, 
    importMode, 
    duplicateHandling 
  } = validateBody(schemas.importValidate || {
    csvData: 'string',
    filename: 'string',
    fieldMapping: 'array',
    importMode: 'string?',
    duplicateHandling: 'string?'
  }, body)

  logger.info('Starting import validation', { 
    filename, 
    importMode: importMode || 'create_only',
    duplicateHandling: duplicateHandling || 'skip'
  })

  try {
    // Parse CSV data
    const rows = parseCSV(csvData)
    if (rows.length === 0) {
      return createErrorResponse({
        statusCode: 400,
        message: 'CSV file is empty or invalid',
        code: 'EMPTY_CSV'
      })
    }

    const headers = rows[0]
    const dataRows = rows.slice(1)

    logger.info('CSV parsed', { 
      totalRows: dataRows.length, 
      headers: headers.length 
    })

    // Validate field mapping
    const mappingErrors = validateFieldMapping(fieldMapping, headers)
    if (mappingErrors.length > 0) {
      return createErrorResponse({
        statusCode: 400,
        message: 'Invalid field mapping',
        code: 'INVALID_MAPPING',
        details: mappingErrors
      })
    }

    // Process and validate each row
    const processedRows: ImportRow[] = []
    const emailSet = new Set<string>()
    const phoneSet = new Set<string>()

    for (let i = 0; i < dataRows.length; i++) {
      const rowData = mapRowData(dataRows[i], headers, fieldMapping)
      const row: ImportRow = {
        rowNumber: i + 2, // +2 because we skip header and array is 0-indexed
        data: rowData,
        errors: [],
        warnings: [],
        status: 'pending'
      }

      // Validate row data
      validateRowData(row, emailSet, phoneSet)
      processedRows.push(row)
    }

    // Check for duplicates against existing customers
    await checkExistingDuplicates(processedRows, supabase, logger)

    // Calculate summary
    const summary = {
      total_rows: processedRows.length,
      valid_rows: processedRows.filter(r => r.status === 'valid').length,
      invalid_rows: processedRows.filter(r => r.status === 'invalid').length,
      duplicate_rows: processedRows.filter(r => r.status === 'duplicate').length,
      warning_rows: processedRows.filter(r => r.warnings.length > 0).length
    }

    // Create import log entry for validation
    const { data: importLog, error: logError } = await supabase
      .from('customer_import_logs')
      .insert({
        filename,
        total_rows: processedRows.length,
        status: 'pending',
        import_mode: importMode || 'create_only',
        field_mapping: fieldMapping,
        duplicate_handling: duplicateHandling || 'skip',
        dry_run: true,
        imported_by: userId
      })
      .select()
      .single()

    if (logError) {
      logger.error('Failed to create import log', { error: logError })
      throw logError
    }

    logger.info('Import validation completed', summary)

    return createSuccessResponse({
      import_log_id: importLog.id,
      summary,
      rows: processedRows,
      field_mapping: fieldMapping,
      ready_for_import: summary.invalid_rows === 0
    })

  } catch (error) {
    logger.error('Import validation failed', { error })
    throw error
  }
}

async function handleExecuteImport(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const body = JSON.parse(event.body || '{}')
  const { 
    importLogId,
    csvData,
    fieldMapping,
    importMode,
    duplicateHandling
  } = validateBody(schemas.importExecute || {
    importLogId: 'string?',
    csvData: 'string',
    fieldMapping: 'array',
    importMode: 'string?',
    duplicateHandling: 'string?'
  }, body)

  logger.info('Starting import execution', { 
    importLogId,
    importMode: importMode || 'create_only'
  })

  try {
    // Update import log status
    let importLog
    if (importLogId) {
      const { data, error } = await supabase
        .from('customer_import_logs')
        .update({
          status: 'processing',
          dry_run: false,
          started_at: new Date().toISOString()
        })
        .eq('id', importLogId)
        .select()
        .single()

      if (error) throw error
      importLog = data
    } else {
      // Create new import log
      const { data, error } = await supabase
        .from('customer_import_logs')
        .insert({
          filename: `import-${Date.now()}.csv`,
          total_rows: 0, // Will be updated
          status: 'processing',
          import_mode: importMode || 'create_only',
          field_mapping: fieldMapping,
          duplicate_handling: duplicateHandling || 'skip',
          dry_run: false,
          imported_by: userId
        })
        .select()
        .single()

      if (error) throw error
      importLog = data
    }

    // Parse and process CSV
    const rows = parseCSV(csvData)
    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Update total rows count
    await supabase
      .from('customer_import_logs')
      .update({ total_rows: dataRows.length })
      .eq('id', importLog.id)

    let successCount = 0
    let errorCount = 0
    let skipCount = 0

    // Set audit context
    await supabase.rpc('set_config', {
      parameter: 'app.current_user_id',
      value: userId
    })

    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const rowData = mapRowData(dataRows[i], headers, fieldMapping)
      const row: ImportRow = {
        rowNumber: i + 2,
        data: rowData,
        errors: [],
        warnings: [],
        status: 'pending'
      }

      // Validate row
      validateRowData(row, new Set(), new Set())

      let detailStatus = 'error'
      let customerId = null
      const errorMessages: string[] = []

      if (row.status === 'valid') {
        try {
          // Check for existing customer
          const existingCustomer = await findExistingCustomer(row.processedData!, supabase)
          
          if (existingCustomer) {
            if (duplicateHandling === 'skip') {
              detailStatus = 'skipped'
              skipCount++
            } else if (duplicateHandling === 'update') {
              // Update existing customer
              customerId = await updateCustomer(existingCustomer.id, row.processedData!, supabase)
              detailStatus = 'success'
              successCount++
            } else {
              // create_new - create anyway
              customerId = await createNewCustomer(row.processedData!, supabase)
              detailStatus = 'success'
              successCount++
            }
          } else {
            // Create new customer
            customerId = await createNewCustomer(row.processedData!, supabase)
            detailStatus = 'success'
            successCount++
          }
        } catch (error: any) {
          detailStatus = 'error'
          errorMessages.push(error.message || 'Unknown error')
          errorCount++
        }
      } else {
        detailStatus = 'error'
        errorMessages.push(...row.errors)
        errorCount++
      }

      // Record import detail
      await supabase
        .from('customer_import_details')
        .insert({
          import_log_id: importLog.id,
          row_number: row.rowNumber,
          status: detailStatus,
          customer_id: customerId,
          input_data: rowData,
          processed_data: row.processedData,
          error_messages: errorMessages,
          warnings: row.warnings
        })
    }

    // Update import log with final status
    await supabase
      .from('customer_import_logs')
      .update({
        status: errorCount === 0 ? 'completed' : 'completed',
        processed_rows: dataRows.length,
        successful_imports: successCount,
        failed_imports: errorCount,
        skipped_rows: skipCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', importLog.id)

    logger.info('Import execution completed', {
      importLogId: importLog.id,
      successCount,
      errorCount,
      skipCount
    })

    return createSuccessResponse({
      import_log_id: importLog.id,
      summary: {
        total_rows: dataRows.length,
        successful_imports: successCount,
        failed_imports: errorCount,
        skipped_rows: skipCount
      }
    })

  } catch (error) {
    logger.error('Import execution failed', { error })
    throw error
  }
}

async function handleGetImportLogs(event: any, supabase: SupabaseClient, logger: Logger) {
  const queryParams = new URLSearchParams(event.queryStringParameters || {})
  const page = parseInt(queryParams.get('page') || '1')
  const limit = parseInt(queryParams.get('limit') || '20')
  const status = queryParams.get('status')

  let query = supabase
    .from('customer_import_logs')
    .select(`
      *,
      imported_by_profile:profiles!customer_import_logs_imported_by_fkey (
        id,
        full_name,
        email
      )
    `)

  if (status) {
    query = query.eq('status', status)
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data: logs, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('Failed to fetch import logs', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / limit) : 0

  return createSuccessResponse({
    logs,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleGetImportTemplate(event: any, supabase: SupabaseClient, logger: Logger) {
  const template = {
    headers: [
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'address_street',
      'address_city',
      'address_postal_code',
      'emergency_contact_name',
      'emergency_contact_phone',
      'notes',
      'gdpr_consent_given'
    ],
    sample_data: [
      {
        full_name: 'Max Mustermann',
        email: 'max.mustermann@example.com',
        phone: '+49 123 456789',
        date_of_birth: '1985-06-15',
        address_street: 'Musterstraße 123',
        address_city: 'Musterstadt',
        address_postal_code: '12345',
        emergency_contact_name: 'Maria Mustermann',
        emergency_contact_phone: '+49 123 456790',
        notes: 'Preferred appointment time: afternoons',
        gdpr_consent_given: 'true'
      }
    ],
    field_mappings: [
      { csvColumn: 'full_name', databaseField: 'full_name', required: true },
      { csvColumn: 'email', databaseField: 'email', required: true, transform: 'email' },
      { csvColumn: 'phone', databaseField: 'phone', required: false, transform: 'phone' },
      { csvColumn: 'date_of_birth', databaseField: 'date_of_birth', required: false, transform: 'date' },
      { csvColumn: 'gdpr_consent_given', databaseField: 'gdpr_consent_given', required: false, transform: 'boolean' }
    ]
  }

  const csvContent = generateCSVTemplate(template.headers, template.sample_data)

  return createSuccessResponse({
    template,
    csv_template: csvContent
  })
}

// Helper functions

function parseCSV(csvData: string): string[][] {
  const lines = csvData.split('\n').filter(line => line.trim() !== '')
  const rows: string[][] = []

  for (const line of lines) {
    const row: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    row.push(current.trim())
    rows.push(row)
  }

  return rows
}

function validateFieldMapping(fieldMapping: FieldMapping[], headers: string[]): string[] {
  const errors: string[] = []
  const mappedColumns = new Set<string>()

  for (const mapping of fieldMapping) {
    if (!headers.includes(mapping.csvColumn)) {
      errors.push(`CSV column '${mapping.csvColumn}' not found in headers`)
    }

    if (mappedColumns.has(mapping.csvColumn)) {
      errors.push(`CSV column '${mapping.csvColumn}' is mapped multiple times`)
    }
    mappedColumns.add(mapping.csvColumn)
  }

  // Check required mappings
  const requiredFields = ['full_name', 'email']
  const mappedFields = fieldMapping.map(m => m.databaseField)
  
  for (const field of requiredFields) {
    if (!mappedFields.includes(field)) {
      errors.push(`Required field '${field}' is not mapped`)
    }
  }

  return errors
}

function mapRowData(row: string[], headers: string[], fieldMapping: FieldMapping[]): Record<string, string> {
  const data: Record<string, string> = {}
  
  for (const mapping of fieldMapping) {
    const columnIndex = headers.indexOf(mapping.csvColumn)
    if (columnIndex !== -1 && columnIndex < row.length) {
      data[mapping.databaseField] = row[columnIndex]
    }
  }

  return data
}

function validateRowData(row: ImportRow, emailSet: Set<string>, phoneSet: Set<string>) {
  const data = row.data
  const processedData: Record<string, any> = {}

  // Validate required fields
  if (!data.full_name || data.full_name.trim() === '') {
    row.errors.push('Full name is required')
  } else {
    processedData.full_name = data.full_name.trim()
  }

  if (!data.email || data.email.trim() === '') {
    row.errors.push('Email is required')
  } else {
    const email = data.email.trim().toLowerCase()
    if (!isValidEmail(email)) {
      row.errors.push('Invalid email format')
    } else if (emailSet.has(email)) {
      row.errors.push('Duplicate email in CSV')
    } else {
      emailSet.add(email)
      processedData.email = email
    }
  }

  // Validate optional fields
  if (data.phone && data.phone.trim() !== '') {
    const phone = data.phone.trim()
    if (phoneSet.has(phone)) {
      row.warnings.push('Duplicate phone in CSV')
    } else {
      phoneSet.add(phone)
    }
    processedData.phone = phone
  }

  if (data.date_of_birth && data.date_of_birth.trim() !== '') {
    const date = new Date(data.date_of_birth.trim())
    if (isNaN(date.getTime())) {
      row.errors.push('Invalid date of birth format')
    } else {
      processedData.date_of_birth = date.toISOString().split('T')[0]
    }
  }

  if (data.gdpr_consent_given && data.gdpr_consent_given.trim() !== '') {
    const consent = data.gdpr_consent_given.trim().toLowerCase()
    if (['true', 'yes', '1', 'ja'].includes(consent)) {
      processedData.gdpr_consent_given = true
      processedData.gdpr_consent_date = new Date().toISOString()
    } else if (['false', 'no', '0', 'nein'].includes(consent)) {
      processedData.gdpr_consent_given = false
    } else {
      row.errors.push('Invalid GDPR consent value (use true/false, yes/no, ja/nein)')
    }
  }

  // Copy other fields
  const otherFields = ['address_street', 'address_city', 'address_postal_code', 'emergency_contact_name', 'emergency_contact_phone', 'notes']
  for (const field of otherFields) {
    if (data[field] && data[field].trim() !== '') {
      processedData[field] = data[field].trim()
    }
  }

  row.processedData = processedData
  row.status = row.errors.length === 0 ? 'valid' : 'invalid'
}

async function checkExistingDuplicates(rows: ImportRow[], supabase: SupabaseClient, logger: Logger) {
  const emails = rows
    .filter(r => r.status === 'valid' && r.processedData?.email)
    .map(r => r.processedData!.email)

  if (emails.length === 0) return

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('profiles!inner(email)')
    .in('profiles.email', emails)
    .eq('is_deleted', false)

  const existingEmails = new Set(existingCustomers?.map(c => c.profiles.email) || [])

  for (const row of rows) {
    if (row.status === 'valid' && row.processedData?.email && existingEmails.has(row.processedData.email)) {
      row.status = 'duplicate'
      row.warnings.push('Customer with this email already exists')
    }
  }
}

async function findExistingCustomer(data: Record<string, any>, supabase: SupabaseClient) {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, profiles!inner(email)')
    .eq('profiles.email', data.email)
    .eq('is_deleted', false)
    .single()

  return customer
}

async function createNewCustomer(data: Record<string, any>, supabase: SupabaseClient): Promise<string> {
  // Create user account
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      role: 'customer'
    }
  })

  if (authError) throw authError

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authUser.user.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: 'customer'
    })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw profileError
  }

  // Generate customer number
  const year = new Date().getFullYear()
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  const customerNumber = `C${year}${randomNum}`

  // Create customer record
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      profile_id: authUser.user.id,
      customer_number: customerNumber,
      date_of_birth: data.date_of_birth,
      address_street: data.address_street,
      address_city: data.address_city,
      address_postal_code: data.address_postal_code,
      emergency_contact_name: data.emergency_contact_name,
      emergency_contact_phone: data.emergency_contact_phone,
      notes: data.notes,
      gdpr_consent_given: data.gdpr_consent_given || false,
      gdpr_consent_date: data.gdpr_consent_date
    })
    .select('id')
    .single()

  if (customerError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw customerError
  }

  return customer.id
}

async function updateCustomer(customerId: string, data: Record<string, any>, supabase: SupabaseClient): Promise<string> {
  // Get customer with profile
  const { data: customer } = await supabase
    .from('customers')
    .select('profile_id')
    .eq('id', customerId)
    .single()

  if (!customer) throw new Error('Customer not found')

  // Update profile
  const profileUpdates: Record<string, any> = {}
  if (data.full_name) profileUpdates.full_name = data.full_name
  if (data.phone) profileUpdates.phone = data.phone

  if (Object.keys(profileUpdates).length > 0) {
    await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', customer.profile_id)
  }

  // Update customer
  const customerUpdates: Record<string, any> = {}
  const fields = ['date_of_birth', 'address_street', 'address_city', 'address_postal_code', 'emergency_contact_name', 'emergency_contact_phone', 'notes']
  
  for (const field of fields) {
    if (data[field] !== undefined) {
      customerUpdates[field] = data[field]
    }
  }

  if (data.gdpr_consent_given === true) {
    customerUpdates.gdpr_consent_given = true
    customerUpdates.gdpr_consent_date = data.gdpr_consent_date || new Date().toISOString()
  }

  if (Object.keys(customerUpdates).length > 0) {
    await supabase
      .from('customers')
      .update(customerUpdates)
      .eq('id', customerId)
  }

  return customerId
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function generateCSVTemplate(headers: string[], sampleData: Record<string, any>[]): string {
  const csvLines = [headers.join(',')]
  
  sampleData.forEach(row => {
    const csvRow = headers.map(header => {
      const value = row[header] || ''
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
    })
    csvLines.push(csvRow.join(','))
  })
  
  return csvLines.join('\n')
}