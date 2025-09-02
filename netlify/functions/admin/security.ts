/**
 * Enhanced Admin Security Logs Endpoint
 * Demonstrates admin-only security with comprehensive audit logging
 */

import { z } from 'zod'
import { withAdminSecurity, SecurityContext } from '../../src/lib/security/middleware'
import { HandlerEvent } from '@netlify/functions'

// Validation schema for security log queries
const SecurityLogQuerySchema = z.object({
  action: z.string().optional(),
  user_role: z.enum(['admin', 'staff', 'customer']).optional(),
  resource_type: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
})

type SecurityLogQuery = z.infer<typeof SecurityLogQuerySchema>

async function getSecurityLogsHandler(event: HandlerEvent, context: SecurityContext) {
  const { securityLogger: logger } = context
  
  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {}
    
    // Convert query parameters to proper types
    const queryData: Partial<SecurityLogQuery> = {
      action: queryParams.action,
      user_role: queryParams.user_role as any,
      resource_type: queryParams.resource_type,
      start_date: queryParams.start_date,
      end_date: queryParams.end_date,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      offset: queryParams.offset ? parseInt(queryParams.offset) : undefined
    }

    // Validate query parameters
    const validation = SecurityLogQuerySchema.safeParse(queryData)
    if (!validation.success) {
      logger.warn('Invalid query parameters for security logs', { 
        errors: validation.error.errors,
        queryParams 
      })
      
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: { 
            message: 'Invalid query parameters',
            code: 'VALIDATION_ERROR',
            details: validation.error.errors
          },
          correlationId: context.correlationId
        })
      }
    }

    const validatedQuery = validation.data

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Build query
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        correlation_id,
        user_id,
        user_role,
        action,
        resource_type,
        resource_id,
        metadata,
        ip_address,
        created_at
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (validatedQuery.action) {
      query = query.eq('action', validatedQuery.action)
    }
    
    if (validatedQuery.user_role) {
      query = query.eq('user_role', validatedQuery.user_role)
    }
    
    if (validatedQuery.resource_type) {
      query = query.eq('resource_type', validatedQuery.resource_type)
    }
    
    if (validatedQuery.start_date) {
      query = query.gte('created_at', validatedQuery.start_date)
    }
    
    if (validatedQuery.end_date) {
      query = query.lte('created_at', validatedQuery.end_date)
    }

    // Apply pagination
    query = query.range(validatedQuery.offset, validatedQuery.offset + validatedQuery.limit - 1)

    // Execute query
    const { data: auditLogs, error: queryError } = await query

    if (queryError) {
      logger.error('Failed to query audit logs', { 
        error: queryError,
        query: validatedQuery 
      })
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Failed to retrieve audit logs', code: 'QUERY_FAILED' },
          correlationId: context.correlationId
        })
      }
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })

    // Apply same filters for count
    if (validatedQuery.action) {
      countQuery = countQuery.eq('action', validatedQuery.action)
    }
    if (validatedQuery.user_role) {
      countQuery = countQuery.eq('user_role', validatedQuery.user_role)
    }
    if (validatedQuery.resource_type) {
      countQuery = countQuery.eq('resource_type', validatedQuery.resource_type)
    }
    if (validatedQuery.start_date) {
      countQuery = countQuery.gte('created_at', validatedQuery.start_date)
    }
    if (validatedQuery.end_date) {
      countQuery = countQuery.lte('created_at', validatedQuery.end_date)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      logger.warn('Failed to get audit log count', { error: countError })
    }

    // Log admin access to audit logs
    logger.info('Admin accessed security audit logs', {
      adminUserId: context.user!.id,
      queryFilters: validatedQuery,
      resultsCount: auditLogs?.length || 0,
      totalCount: count || 'unknown'
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          logs: auditLogs,
          pagination: {
            offset: validatedQuery.offset,
            limit: validatedQuery.limit,
            total: count || 0,
            hasMore: count ? (validatedQuery.offset + validatedQuery.limit) < count : false
          },
          filters: validatedQuery
        },
        correlationId: context.correlationId
      })
    }

  } catch (error) {
    logger.error('Unexpected error in security logs endpoint', { 
      error: error instanceof Error ? error.message : error 
    })
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        correlationId: context.correlationId
      })
    }
  }
}

// Additional endpoint for security statistics
async function getSecurityStatsHandler(event: HandlerEvent, context: SecurityContext) {
  const { securityLogger: logger } = context
  
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get various security statistics
    const statsQueries = await Promise.allSettled([
      // Audit log stats (last 24 hours)
      supabase
        .from('audit_logs')
        .select('action, user_role', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Rate limiting stats (last hour)
      supabase
        .from('rate_limits')
        .select('endpoint, user_role, count')
        .gte('window_start', new Date(Date.now() - 60 * 60 * 1000).toISOString()),

      // Data retention job stats (last 7 days)
      supabase
        .from('data_retention_jobs')
        .select('resource_type, status, records_processed, records_deleted')
        .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Idempotency key stats
      supabase
        .from('idempotency_keys')
        .select('endpoint', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ])

    const [auditResult, rateLimitResult, retentionResult, idempotencyResult] = statsQueries

    logger.info('Admin accessed security statistics', {
      adminUserId: context.user!.id
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          audit_logs_24h: auditResult.status === 'fulfilled' ? {
            total_events: auditResult.value.count || 0,
            data: auditResult.value.data || []
          } : { error: 'Failed to fetch audit log stats' },
          
          rate_limits_1h: rateLimitResult.status === 'fulfilled' ? {
            records: rateLimitResult.value.data || []
          } : { error: 'Failed to fetch rate limit stats' },
          
          retention_jobs_7d: retentionResult.status === 'fulfilled' ? {
            jobs: retentionResult.value.data || []
          } : { error: 'Failed to fetch retention job stats' },
          
          idempotency_keys_24h: idempotencyResult.status === 'fulfilled' ? {
            total_keys: idempotencyResult.value.count || 0
          } : { error: 'Failed to fetch idempotency stats' }
        },
        correlationId: context.correlationId
      })
    }

  } catch (error) {
    logger.error('Unexpected error in security stats endpoint', { 
      error: error instanceof Error ? error.message : error 
    })
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        correlationId: context.correlationId
      })
    }
  }
}

// Main handler that routes based on the specific endpoint
export const handler = withAdminSecurity(
  async (event, context) => {
    if (event.path.includes('/security-logs')) {
      return getSecurityLogsHandler(event, context)
    } else if (event.path.includes('/security-stats')) {
      return getSecurityStatsHandler(event, context)
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
          correlationId: context.correlationId
        })
      }
    }
  },
  'security_data_access',
  'audit_logs'
)