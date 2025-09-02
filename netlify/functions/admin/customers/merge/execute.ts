/**
 * Admin Customer Merge Execution API
 * Handles merging customers with preview and execution
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../../src/lib/auth/netlify-auth'
import { validateBody, schemas } from '../../../../src/lib/validation/schemas'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Customer merge execution request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      
      switch (event.httpMethod) {
        case 'POST':
          if (pathSegments.includes('preview')) {
            return await handleMergePreview(event, supabase, logger)
          } else if (pathSegments.includes('execute')) {
            return await handleMergeExecution(event, supabase, logger, context.user.id)
          } else {
            return createErrorResponse({
              statusCode: 404,
              message: 'Endpoint not found',
              code: 'ENDPOINT_NOT_FOUND'
            })
          }

        case 'GET':
          if (pathSegments.includes('history')) {
            return await handleMergeHistory(event, supabase, logger)
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
      logger.error('Merge execution operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 20, windowMs: 60 * 1000 }
)

async function handleMergePreview(event: any, supabase: SupabaseClient, logger: Logger) {
  const body = JSON.parse(event.body || '{}')
  const { primaryCustomerId, mergeCustomerId, mergeStrategy } = validateBody(schemas.mergePreview || {
    primaryCustomerId: 'string',
    mergeCustomerId: 'string',
    mergeStrategy: 'object'
  }, body)

  if (primaryCustomerId === mergeCustomerId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Cannot merge customer with itself',
      code: 'INVALID_MERGE'
    })
  }

  logger.info('Generating merge preview', { primaryCustomerId, mergeCustomerId })

  // Get both customers with full details
  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      *,
      profiles!inner (
        id,
        email,
        full_name,
        phone,
        role,
        created_at,
        updated_at
      )
    `)
    .in('id', [primaryCustomerId, mergeCustomerId])
    .eq('is_deleted', false)

  if (error) {
    logger.error('Failed to fetch customers for preview', { error })
    throw error
  }

  if (!customers || customers.length !== 2) {
    return createErrorResponse({
      statusCode: 400,
      message: 'One or both customers not found',
      code: 'CUSTOMERS_NOT_FOUND'
    })
  }

  const primaryCustomer = customers.find(c => c.id === primaryCustomerId)
  const mergeCustomer = customers.find(c => c.id === mergeCustomerId)

  if (!primaryCustomer || !mergeCustomer) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Customer assignment error',
      code: 'CUSTOMER_ASSIGNMENT_ERROR'
    })
  }

  // Get appointment counts for both customers
  const { data: appointmentCounts } = await supabase
    .from('appointments')
    .select('customer_id, status')
    .in('customer_id', [primaryCustomerId, mergeCustomerId])

  const primaryAppointments = appointmentCounts?.filter(a => a.customer_id === primaryCustomerId) || []
  const mergeAppointments = appointmentCounts?.filter(a => a.customer_id === mergeCustomerId) || []

  // Generate preview of merged result
  const previewResult = generateMergePreview(primaryCustomer, mergeCustomer, mergeStrategy)

  const preview = {
    primary_customer: {
      ...primaryCustomer,
      appointment_count: primaryAppointments.length,
      upcoming_appointments: primaryAppointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length
    },
    merge_customer: {
      ...mergeCustomer,
      appointment_count: mergeAppointments.length,
      upcoming_appointments: mergeAppointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length
    },
    merged_result: previewResult,
    transfer_summary: {
      appointments_to_transfer: mergeAppointments.length,
      total_appointments_after_merge: primaryAppointments.length + mergeAppointments.length
    },
    merge_strategy: mergeStrategy
  }

  logger.info('Merge preview generated successfully', { 
    primaryCustomerId, 
    mergeCustomerId,
    appointmentsToTransfer: mergeAppointments.length
  })

  return createSuccessResponse(preview)
}

async function handleMergeExecution(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const body = JSON.parse(event.body || '{}')
  const { primaryCustomerId, mergeCustomerId, mergeStrategy, notes } = validateBody(schemas.mergeExecution || {
    primaryCustomerId: 'string',
    mergeCustomerId: 'string',
    mergeStrategy: 'object',
    notes: 'string?'
  }, body)

  if (primaryCustomerId === mergeCustomerId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Cannot merge customer with itself',
      code: 'INVALID_MERGE'
    })
  }

  logger.info('Executing customer merge', { primaryCustomerId, mergeCustomerId, userId })

  // Execute the merge using the database function
  const { data: result, error } = await supabase.rpc('merge_customers', {
    primary_customer_id: primaryCustomerId,
    merge_customer_id: mergeCustomerId,
    merge_strategy: mergeStrategy,
    merging_user_id: userId,
    notes: notes || null
  })

  if (error) {
    logger.error('Failed to execute merge', { error })
    throw error
  }

  if (!result.success) {
    return createErrorResponse({
      statusCode: 400,
      message: result.error || 'Merge failed',
      code: 'MERGE_FAILED'
    })
  }

  logger.info('Customer merge executed successfully', { 
    primaryCustomerId, 
    mergeCustomerId,
    appointmentsTransferred: result.appointments_transferred
  })

  return createSuccessResponse(result)
}

async function handleMergeHistory(event: any, supabase: SupabaseClient, logger: Logger) {
  const queryParams = new URLSearchParams(event.queryStringParameters || {})
  const page = parseInt(queryParams.get('page') || '1')
  const limit = parseInt(queryParams.get('limit') || '20')
  const customerId = queryParams.get('customerId')

  let query = supabase
    .from('customer_merges')
    .select(`
      *,
      primary_customer:customers!customer_merges_primary_customer_id_fkey (
        id,
        customer_number,
        profiles!inner (
          full_name,
          email
        )
      ),
      merged_customer:customers!customer_merges_merged_customer_id_fkey (
        id,
        customer_number,
        profiles!inner (
          full_name,
          email
        )
      ),
      merged_by_profile:profiles!customer_merges_merged_by_fkey (
        id,
        full_name,
        email
      )
    `)

  if (customerId) {
    query = query.or(`primary_customer_id.eq.${customerId},merged_customer_id.eq.${customerId}`)
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data: merges, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('Failed to fetch merge history', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / limit) : 0

  logger.info('Merge history fetched successfully', { count: merges?.length })

  return createSuccessResponse({
    merges,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages
    }
  })
}

function generateMergePreview(primaryCustomer: any, mergeCustomer: any, mergeStrategy: any) {
  const merged = {
    id: primaryCustomer.id,
    customer_number: primaryCustomer.customer_number,
    // Profile fields
    full_name: mergeStrategy.full_name === 'merge' ? mergeCustomer.profiles.full_name : primaryCustomer.profiles.full_name,
    email: primaryCustomer.profiles.email, // Email stays with primary
    phone: mergeStrategy.phone === 'merge' ? mergeCustomer.profiles.phone : 
           mergeStrategy.phone === 'combine' ? (primaryCustomer.profiles.phone || mergeCustomer.profiles.phone) :
           primaryCustomer.profiles.phone,
    
    // Customer fields
    date_of_birth: mergeStrategy.date_of_birth === 'merge' ? mergeCustomer.date_of_birth : 
                   (primaryCustomer.date_of_birth || mergeCustomer.date_of_birth),
    address_street: mergeStrategy.address_street === 'merge' ? mergeCustomer.address_street :
                    (primaryCustomer.address_street || mergeCustomer.address_street),
    address_city: mergeStrategy.address_city === 'merge' ? mergeCustomer.address_city :
                  (primaryCustomer.address_city || mergeCustomer.address_city),
    address_postal_code: mergeStrategy.address_postal_code === 'merge' ? mergeCustomer.address_postal_code :
                         (primaryCustomer.address_postal_code || mergeCustomer.address_postal_code),
    emergency_contact_name: mergeStrategy.emergency_contact_name === 'merge' ? mergeCustomer.emergency_contact_name :
                           (primaryCustomer.emergency_contact_name || mergeCustomer.emergency_contact_name),
    emergency_contact_phone: mergeStrategy.emergency_contact_phone === 'merge' ? mergeCustomer.emergency_contact_phone :
                            (primaryCustomer.emergency_contact_phone || mergeCustomer.emergency_contact_phone),
    
    notes: mergeStrategy.notes === 'merge' ? mergeCustomer.notes :
           mergeStrategy.notes === 'combine' ? 
           (primaryCustomer.notes && mergeCustomer.notes ? 
            `${primaryCustomer.notes}\n\n--- Merged from ${mergeCustomer.customer_number} ---\n${mergeCustomer.notes}` :
            (primaryCustomer.notes || mergeCustomer.notes)) :
           primaryCustomer.notes,
    
    gdpr_consent_given: primaryCustomer.gdpr_consent_given || mergeCustomer.gdpr_consent_given,
    gdpr_consent_date: mergeCustomer.gdpr_consent_given && 
                       (!primaryCustomer.gdpr_consent_date || 
                        new Date(mergeCustomer.gdpr_consent_date) > new Date(primaryCustomer.gdpr_consent_date)) ?
                       mergeCustomer.gdpr_consent_date : primaryCustomer.gdpr_consent_date,
    
    created_at: primaryCustomer.created_at,
    updated_at: new Date().toISOString()
  }

  return merged
}