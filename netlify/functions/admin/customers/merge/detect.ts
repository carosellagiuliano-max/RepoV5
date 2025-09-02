/**
 * Admin Customer Merge Detection API
 * Handles finding and managing customer duplicates
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../../src/lib/auth/netlify-auth'
import { validateQuery, validateBody, schemas } from '../../../../src/lib/validation/schemas'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Customer merge detection request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      const pathSegments = event.path.split('/').filter(Boolean)
      
      switch (event.httpMethod) {
        case 'GET':
          if (pathSegments.includes('detect')) {
            return await handleDetectDuplicates(event, supabase, logger)
          } else if (pathSegments.includes('list')) {
            return await handleListDuplicates(event, supabase, logger)
          } else {
            return createErrorResponse({
              statusCode: 404,
              message: 'Endpoint not found',
              code: 'ENDPOINT_NOT_FOUND'
            })
          }

        case 'POST':
          if (pathSegments.includes('mark-reviewed')) {
            return await handleMarkReviewed(event, supabase, logger, context.user.id)
          } else if (pathSegments.includes('dismiss')) {
            return await handleDismissDuplicate(event, supabase, logger, context.user.id)
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
      logger.error('Merge detection operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 50, windowMs: 60 * 1000 }
)

async function handleDetectDuplicates(event: any, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.duplicateDetection || {
    customerId: 'string?',
    confidenceThreshold: 'number?',
    limit: 'number?'
  }, event.queryStringParameters || {})
  
  logger.info('Starting duplicate detection', { 
    customerId: query.customerId,
    threshold: query.confidenceThreshold,
    limit: query.limit
  })

  const { data: duplicates, error } = await supabase.rpc('detect_customer_duplicates', {
    customer_id_param: query.customerId || null,
    confidence_threshold: query.confidenceThreshold || 0.7,
    limit_results: query.limit || 100
  })

  if (error) {
    logger.error('Failed to detect duplicates', { error })
    throw error
  }

  // Enrich duplicates with customer details
  if (duplicates && duplicates.length > 0) {
    const customerIds = Array.from(new Set([
      ...duplicates.map((d: any) => d.customer_a_id),
      ...duplicates.map((d: any) => d.customer_b_id)
    ]))

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        customer_number,
        created_at,
        profiles!inner (
          id,
          email,
          full_name,
          phone
        )
      `)
      .in('id', customerIds)

    if (customerError) {
      logger.error('Failed to fetch customer details', { error: customerError })
      throw customerError
    }

    const customerMap = new Map(customers?.map(c => [c.id, c]))

    const enrichedDuplicates = duplicates.map((duplicate: any) => ({
      ...duplicate,
      customer_a: customerMap.get(duplicate.customer_a_id),
      customer_b: customerMap.get(duplicate.customer_b_id)
    }))

    logger.info('Duplicates detected successfully', { count: enrichedDuplicates.length })
    
    return createSuccessResponse({
      duplicates: enrichedDuplicates,
      total: enrichedDuplicates.length
    })
  }

  logger.info('No duplicates found')
  return createSuccessResponse({
    duplicates: [],
    total: 0
  })
}

async function handleListDuplicates(event: any, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.duplicateFilters || {
    page: 'number?',
    limit: 'number?',
    status: 'string?',
    matchType: 'string?',
    minConfidence: 'number?',
    sortBy: 'string?',
    sortOrder: 'string?'
  }, event.queryStringParameters || {})

  let dbQuery = supabase
    .from('customer_duplicates')
    .select(`
      *,
      customer_a:customers!customer_duplicates_customer_a_id_fkey (
        id,
        customer_number,
        created_at,
        profiles!inner (
          id,
          email,
          full_name,
          phone
        )
      ),
      customer_b:customers!customer_duplicates_customer_b_id_fkey (
        id,
        customer_number,
        created_at,
        profiles!inner (
          id,
          email,
          full_name,
          phone
        )
      ),
      reviewed_by_profile:profiles!customer_duplicates_reviewed_by_fkey (
        id,
        full_name,
        email
      )
    `)

  // Apply filters
  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.matchType) {
    dbQuery = dbQuery.eq('match_type', query.matchType)
  }

  if (query.minConfidence !== undefined) {
    dbQuery = dbQuery.gte('confidence_score', query.minConfidence)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'created_at'
  const sortOrder = query.sortOrder || 'desc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const page = query.page || 1
  const limit = query.limit || 20
  const from = (page - 1) * limit
  const to = from + limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: duplicates, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch duplicates', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / limit) : 0

  logger.info('Duplicates fetched successfully', { count: duplicates?.length })

  return createSuccessResponse({
    duplicates,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleMarkReviewed(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const body = JSON.parse(event.body || '{}')
  const { duplicateId } = validateBody(schemas.duplicateAction || {
    duplicateId: 'string'
  }, body)

  const { data, error } = await supabase
    .from('customer_duplicates')
    .update({
      status: 'reviewed',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', duplicateId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to mark duplicate as reviewed', { error })
    throw error
  }

  logger.info('Duplicate marked as reviewed', { duplicateId })

  return createSuccessResponse(data)
}

async function handleDismissDuplicate(event: any, supabase: SupabaseClient, logger: Logger, userId: string) {
  const body = JSON.parse(event.body || '{}')
  const { duplicateId, reason } = validateBody(schemas.duplicateDismiss || {
    duplicateId: 'string',
    reason: 'string?'
  }, body)

  // Get current match_details and add dismissal reason
  const { data: currentDuplicate } = await supabase
    .from('customer_duplicates')
    .select('match_details')
    .eq('id', duplicateId)
    .single()

  const updatedMatchDetails = {
    ...(currentDuplicate?.match_details || {}),
    dismissal_reason: reason || 'Manual dismissal',
    dismissed_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('customer_duplicates')
    .update({
      status: 'dismissed',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      match_details: updatedMatchDetails
    })
    .eq('id', duplicateId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to dismiss duplicate', { error })
    throw error
  }

  logger.info('Duplicate dismissed', { duplicateId, reason })

  return createSuccessResponse(data)
}