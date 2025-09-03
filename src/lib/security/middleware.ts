/**
 * Unified Security Middleware
 * Combines JWT auth, rate limiting, idempotency, and audit logging
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { 
  withAuth, 
  AuthenticatedUser, 
  AuthenticatedContext,
  createErrorResponse,
  createSuccessResponse,
  generateCorrelationId,
  createLogger
} from '../auth/netlify-auth'
import { 
  checkIdempotency, 
  storeIdempotencyResponse,
  validateIdempotencyKey,
  IdempotencyOptions 
} from './idempotency'
import { 
  getRateLimitConfig,
  getRateLimitKey,
  checkRateLimit,
  createRateLimitExceededResponse,
  createRateLimitHeaders 
} from './rate-limiter'
import { createAuditLog, AuditContext, AuditAction } from './audit'

export interface SecurityOptions {
  // Authentication options
  requireAuth?: boolean
  allowedRoles?: string[]
  
  // Rate limiting options
  rateLimit?: {
    enabled?: boolean
    maxRequests?: number
    windowMs?: number
    endpoint?: string
  }
  
  // Idempotency options
  idempotency?: {
    enabled?: boolean
    required?: boolean
    ttlHours?: number
  } & IdempotencyOptions
  
  // Audit options
  audit?: {
    enabled?: boolean
    actionType?: string
    resourceType?: string
    resourceId?: string | ((body: unknown) => string)
    captureRequest?: boolean
    captureResponse?: boolean
  }
  
  // CORS options
  cors?: {
    origin?: string
    headers?: string[]
    methods?: string[]
  }
}

export interface SecurityContext extends AuthenticatedContext {
  correlationId: string
  logger: ReturnType<typeof createLogger>
  startTime: number
  rateLimitHeaders?: Record<string, string>
}

/**
 * Main security middleware function
 */
export function withSecurity(
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<Response>,
  options: SecurityOptions = {}
): Handler {
  return async (event: HandlerEvent, context: HandlerContext) => {
    const startTime = Date.now()
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    
    logger.info('Request started', {
      method: event.httpMethod,
      path: event.path,
      userAgent: event.headers['user-agent']
    })
    
    try {
      // 1. Handle preflight OPTIONS requests
      if (event.httpMethod === 'OPTIONS') {
        return createCorsResponse(options.cors)
      }
      
      // 2. Authentication (if required)
      let user: AuthenticatedUser | null = null
      if (options.requireAuth !== false) {
        try {
          const authResult = await withAuth(async (e, c) => c, {
            allowedRoles: options.allowedRoles
          })(event, context)
          
          if (authResult.statusCode !== 200) {
            return authResult
          }
          
          // Extract user from successful auth
          user = (authResult as unknown as { user: AuthenticatedUser }).user || null
        } catch (error) {
          logger.error('Authentication failed', { error: error instanceof Error ? error.message : error })
          return createErrorResponse({
            statusCode: 401,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          })
        }
      }
      
      // 3. Rate limiting
      if (options.rateLimit?.enabled !== false) {
        const endpoint = options.rateLimit?.endpoint || extractEndpoint(event)
        const rateLimitConfig = getRateLimitConfig(endpoint, user?.role || 'anonymous')
        
        // Override with custom limits if provided
        if (options.rateLimit?.maxRequests) {
          rateLimitConfig.maxRequests = options.rateLimit.maxRequests
        }
        if (options.rateLimit?.windowMs) {
          rateLimitConfig.windowMs = options.rateLimit.windowMs
        }
        
        const rateLimitKey = getRateLimitKey(event, user, endpoint)
        const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitConfig)
        
        if (!rateLimitResult.allowed) {
          logger.warn('Rate limit exceeded', {
            key: rateLimitKey,
            limit: rateLimitResult.info.limit,
            endpoint
          })
          
          return createRateLimitExceededResponse(rateLimitResult.info)
        }
        
        // Add rate limit headers to successful responses
        context.rateLimitHeaders = createRateLimitHeaders(rateLimitResult.info)
      }
      
      // 4. Idempotency check (for POST, PUT, PATCH methods)
      const isModifyingMethod = ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)
      let idempotencyKey: string | null = null
      let idempotencyResult: { exists: boolean; response?: { statusCode: number; body: unknown }; error?: string } | null = null
      
      if (options.idempotency?.enabled !== false && isModifyingMethod) {
        idempotencyKey = event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key']
        
        if (options.idempotency?.required && !idempotencyKey) {
          return createErrorResponse({
            statusCode: 400,
            message: 'X-Idempotency-Key header is required for this operation',
            code: 'IDEMPOTENCY_KEY_REQUIRED'
          })
        }
        
        if (idempotencyKey) {
          if (!validateIdempotencyKey(idempotencyKey)) {
            return createErrorResponse({
              statusCode: 400,
              message: 'Invalid idempotency key format',
              code: 'INVALID_IDEMPOTENCY_KEY'
            })
          }
          
          const endpoint = extractEndpoint(event)
          idempotencyResult = await checkIdempotency(
            idempotencyKey,
            event.body || '',
            endpoint,
            event.httpMethod,
            options.idempotency
          )
          
          if (idempotencyResult.error) {
            return createErrorResponse({
              statusCode: 400,
              message: idempotencyResult.error,
              code: 'IDEMPOTENCY_ERROR'
            })
          }
          
          if (idempotencyResult.exists && idempotencyResult.response) {
            logger.info('Returning cached idempotent response', { idempotencyKey })
            return {
              statusCode: idempotencyResult.response.statusCode,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Idempotency-Cache': 'HIT',
                ...(context.rateLimitHeaders || {})
              },
              body: JSON.stringify(idempotencyResult.response.body)
            }
          }
        }
      }
      
      // 5. Create enhanced security context
      const securityContext: SecurityContext = {
        ...context,
        user: user!,
        correlationId,
        logger,
        startTime
      }
      
      // 6. Execute the main handler
      logger.info('Executing main handler')
      const response = await handler(event, securityContext)
      
      // 7. Store idempotency response (if applicable)
      if (idempotencyKey && !idempotencyResult?.exists) {
        const endpoint = extractEndpoint(event)
        await storeIdempotencyResponse(
          idempotencyKey,
          event.body || '',
          endpoint,
          event.httpMethod,
          response.statusCode,
          response.body ? JSON.parse(response.body) : null,
          options.idempotency
        )
      }
      
      // 8. Audit logging (for successful operations)
      if (options.audit?.enabled && user) {
        const auditContext: AuditContext = {
          user,
          event,
          correlationId
        }
        
        const auditAction: AuditAction = {
          actionType: options.audit.actionType || `${event.httpMethod.toLowerCase()}_${extractEndpoint(event)}`,
          resourceType: options.audit.resourceType || 'unknown',
          resourceId: options.audit.resourceId || 'unknown'
        }
        
        // Extract resource ID from request body if function provided
        if (typeof options.audit.resourceId === 'function' && event.body) {
          try {
            const body = JSON.parse(event.body)
            auditAction.resourceId = options.audit.resourceId(body)
          } catch (error) {
            logger.warn('Failed to extract resource ID from body', { error })
          }
        }
        
        // Add request/response data if enabled
        if (options.audit.captureRequest) {
          auditAction.metadata = {
            ...auditAction.metadata,
            requestData: event.body ? JSON.parse(event.body) : null
          }
        }
        
        if (options.audit.captureResponse) {
          auditAction.metadata = {
            ...auditAction.metadata,
            responseData: response.body ? JSON.parse(response.body) : null
          }
        }
        
        await createAuditLog(auditContext, auditAction, response.statusCode < 400)
      }
      
      // 9. Add security headers to response
      const securityHeaders = {
        'X-Correlation-ID': correlationId,
        'X-Response-Time': `${Date.now() - startTime}ms`,
        ...(context.rateLimitHeaders || {}),
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {})
      }
      
      const finalResponse = {
        ...response,
        headers: {
          ...response.headers,
          ...securityHeaders
        }
      }
      
      logger.info('Request completed', {
        statusCode: response.statusCode,
        duration: Date.now() - startTime
      })
      
      return finalResponse
      
    } catch (error) {
      logger.error('Security middleware error', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}

/**
 * Create CORS preflight response
 */
function createCorsResponse(corsOptions?: SecurityOptions['cors']) {
  const defaultOrigin = '*'
  const defaultHeaders = ['Content-Type', 'Authorization', 'X-Idempotency-Key']
  const defaultMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOptions?.origin || defaultOrigin,
      'Access-Control-Allow-Headers': corsOptions?.headers?.join(', ') || defaultHeaders.join(', '),
      'Access-Control-Allow-Methods': corsOptions?.methods?.join(', ') || defaultMethods.join(', '),
      'Access-Control-Max-Age': '86400' // 24 hours
    },
    body: ''
  }
}

/**
 * Extract endpoint name from event
 */
function extractEndpoint(event: HandlerEvent): string {
  const path = event.path || ''
  const functionMatch = path.match(/\/\.netlify\/functions\/(.+)$/)
  
  if (functionMatch) {
    return `/${functionMatch[1]}`
  }
  
  return path || '/unknown'
}

/**
 * Convenience function for critical operations (booking, payments)
 */
export function withCriticalSecurity(
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<Response>,
  options: Partial<SecurityOptions> = {}
): Handler {
  return withSecurity(handler, {
    requireAuth: true,
    allowedRoles: ['admin', 'staff', 'customer'],
    rateLimit: { enabled: true },
    idempotency: { enabled: true, required: true },
    audit: { enabled: true },
    ...options
  })
}

/**
 * Convenience function for admin operations
 */
export function withAdminSecurity(
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<Response>,
  options: Partial<SecurityOptions> = {}
): Handler {
  return withSecurity(handler, {
    requireAuth: true,
    allowedRoles: ['admin'],
    rateLimit: { enabled: true },
    idempotency: { enabled: true },
    audit: { enabled: true, captureRequest: true, captureResponse: true },
    ...options
  })
}