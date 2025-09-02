/**
 * Comprehensive Security Middleware
 * Provides idempotency, rate limiting, audit logging, and correlation tracking
 */

import { createClient } from '@supabase/supabase-js'
import { Context, Handler, HandlerEvent } from '@netlify/functions'
import { createHash } from 'crypto'
import { Database } from '../types/database'

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create admin Supabase client for middleware operations
const createSecurityClient = () => {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Types
export interface SecurityContext extends Context {
  correlationId: string
  user?: {
    id: string
    email: string
    role: 'admin' | 'staff' | 'customer'
  }
  securityLogger: SecurityLogger
}

export interface SecurityOptions {
  // Rate limiting
  rateLimit?: {
    maxRequests: number
    windowSeconds: number
    skipForRoles?: Array<'admin' | 'staff' | 'customer'>
  }
  
  // Idempotency
  idempotency?: {
    enabled: boolean
    keyHeader?: string // Default: 'Idempotency-Key'
    expirationHours?: number // Default: 24
  }
  
  // Audit logging
  audit?: {
    enabled: boolean
    action: string
    resourceType: string
    logRequestBody?: boolean
    logResponseBody?: boolean
  }
  
  // Authentication
  auth?: {
    required: boolean
    allowedRoles?: Array<'admin' | 'staff' | 'customer'>
  }
}

// Security Logger
export class SecurityLogger {
  constructor(
    private correlationId: string,
    private supabase: ReturnType<typeof createSecurityClient>
  ) {}

  async logAudit(
    user: SecurityContext['user'],
    action: string,
    resourceType: string,
    options: {
      resourceId?: string
      oldValues?: Record<string, unknown>
      newValues?: Record<string, unknown>
      metadata?: Record<string, unknown>
      ipAddress?: string
      userAgent?: string
    } = {}
  ): Promise<void> {
    if (!user) return

    try {
      await this.supabase.rpc('log_audit_event', {
        p_correlation_id: this.correlationId,
        p_user_id: user.id,
        p_user_role: user.role,
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: options.resourceId || null,
        p_old_values: options.oldValues || null,
        p_new_values: options.newValues || null,
        p_metadata: options.metadata || {},
        p_ip_address: options.ipAddress || null,
        p_user_agent: options.userAgent || null
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta)
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      level,
      message,
      ...meta
    }))
  }
}

// Utility functions
export const generateCorrelationId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

export const getClientIP = (event: HandlerEvent): string => {
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         event.headers['cf-connecting-ip'] || 
         'unknown'
}

export const getUserAgent = (event: HandlerEvent): string => {
  return event.headers['user-agent'] || 'unknown'
}

export const createRequestHash = (event: HandlerEvent): string => {
  const hashInput = {
    method: event.httpMethod,
    path: event.path,
    query: event.queryStringParameters,
    body: event.body
  }
  return createHash('sha256').update(JSON.stringify(hashInput)).digest('hex')
}

// Rate limiting implementation
class RateLimiter {
  constructor(private supabase: ReturnType<typeof createSecurityClient>) {}

  async checkLimit(
    key: string,
    endpoint: string,
    userRole: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining?: number; resetTime?: Date }> {
    try {
      const { data } = await this.supabase.rpc('get_or_create_rate_limit', {
        p_key: key,
        p_endpoint: endpoint,
        p_user_role: userRole,
        p_window_seconds: windowSeconds
      })

      if (!data || data.length === 0) {
        return { allowed: true }
      }

      const record = data[0]
      const allowed = record.current_count <= maxRequests
      const remaining = Math.max(0, maxRequests - record.current_count)

      return {
        allowed,
        remaining,
        resetTime: new Date(record.window_end)
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail open - allow request if rate limiting system is down
      return { allowed: true }
    }
  }
}

// Idempotency implementation
class IdempotencyManager {
  constructor(private supabase: ReturnType<typeof createSecurityClient>) {}

  async checkIdempotency(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
    expirationHours: number
  ): Promise<{
    isDuplicate: boolean
    existingResponse?: { status: number; body: unknown }
  }> {
    try {
      const { data: existing, error } = await this.supabase
        .from('idempotency_keys')
        .select('response_status, response_body, expires_at')
        .eq('key', key)
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('request_hash', requestHash)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (existing) {
        return {
          isDuplicate: true,
          existingResponse: {
            status: existing.response_status,
            body: existing.response_body
          }
        }
      }

      // Store the idempotency key for this request
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expirationHours)

      await this.supabase
        .from('idempotency_keys')
        .insert({
          key,
          user_id: userId,
          endpoint,
          request_hash: requestHash,
          expires_at: expiresAt.toISOString()
        })

      return { isDuplicate: false }
    } catch (error) {
      console.error('Idempotency check failed:', error)
      // Fail open - allow request if idempotency system is down
      return { isDuplicate: false }
    }
  }

  async storeResponse(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
    status: number,
    body: unknown
  ): Promise<void> {
    try {
      await this.supabase
        .from('idempotency_keys')
        .update({
          response_status: status,
          response_body: body
        })
        .eq('key', key)
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('request_hash', requestHash)
    } catch (error) {
      console.error('Failed to store idempotency response:', error)
    }
  }
}

// Authentication helper
async function authenticateRequest(
  event: HandlerEvent,
  supabase: ReturnType<typeof createSecurityClient>,
  logger: SecurityLogger
): Promise<SecurityContext['user'] | null> {
  const authHeader = event.headers.authorization || event.headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      logger.warn('Invalid JWT token', { error: error?.message })
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_active) {
      logger.warn('User profile not found or inactive', { userId: user.id })
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      role: profile.role
    }
  } catch (error) {
    logger.error('Authentication failed', { error })
    return null
  }
}

// Main security middleware
export const withSecurity = (
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<{
    statusCode: number
    headers?: Record<string, string>
    body: string
  }>,
  options: SecurityOptions = {}
): Handler => {
  return async (event, context) => {
    const correlationId = generateCorrelationId()
    const supabase = createSecurityClient()
    const logger = new SecurityLogger(correlationId, supabase)
    const rateLimiter = new RateLimiter(supabase)
    const idempotencyManager = new IdempotencyManager(supabase)

    // CORS headers
    const defaultHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'X-Correlation-ID': correlationId
    }

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: ''
      }
    }

    // Create security context
    const securityContext: SecurityContext = {
      ...context,
      correlationId,
      securityLogger: logger
    }

    try {
      logger.info('Request started', {
        method: event.httpMethod,
        path: event.path,
        userAgent: getUserAgent(event),
        ip: getClientIP(event)
      })

      // Authentication
      if (options.auth?.required) {
        const user = await authenticateRequest(event, supabase, logger)
        if (!user) {
          logger.warn('Authentication required but not provided')
          return {
            statusCode: 401,
            headers: defaultHeaders,
            body: JSON.stringify({
              success: false,
              error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
              correlationId
            })
          }
        }

        if (options.auth.allowedRoles && !options.auth.allowedRoles.includes(user.role)) {
          logger.warn('Insufficient permissions', { userRole: user.role, requiredRoles: options.auth.allowedRoles })
          return {
            statusCode: 403,
            headers: defaultHeaders,
            body: JSON.stringify({
              success: false,
              error: { message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' },
              correlationId
            })
          }
        }

        securityContext.user = user
      }

      // Rate limiting
      if (options.rateLimit) {
        const shouldSkip = options.rateLimit.skipForRoles?.includes(securityContext.user?.role as any)
        if (!shouldSkip) {
          const rateLimitKey = securityContext.user 
            ? `user:${securityContext.user.id}:${event.path}`
            : `ip:${getClientIP(event)}:${event.path}`

          const rateLimit = await rateLimiter.checkLimit(
            rateLimitKey,
            event.path,
            securityContext.user?.role || 'anonymous',
            options.rateLimit.maxRequests,
            options.rateLimit.windowSeconds
          )

          if (!rateLimit.allowed) {
            logger.warn('Rate limit exceeded', { key: rateLimitKey })
            return {
              statusCode: 429,
              headers: {
                ...defaultHeaders,
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': rateLimit.resetTime?.toISOString() || '',
                'Retry-After': Math.ceil((rateLimit.resetTime?.getTime() || Date.now()) / 1000 - Date.now() / 1000).toString()
              },
              body: JSON.stringify({
                success: false,
                error: { message: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
                correlationId
              })
            }
          }

          // Add rate limit headers to response
          defaultHeaders['X-RateLimit-Remaining'] = rateLimit.remaining?.toString() || '0'
          if (rateLimit.resetTime) {
            defaultHeaders['X-RateLimit-Reset'] = rateLimit.resetTime.toISOString()
          }
        }
      }

      // Idempotency check
      if (options.idempotency?.enabled && securityContext.user && ['POST', 'PUT'].includes(event.httpMethod)) {
        const idempotencyKey = event.headers[options.idempotency.keyHeader || 'idempotency-key'] ||
                              event.headers[options.idempotency.keyHeader?.toLowerCase() || 'idempotency-key']
        
        if (idempotencyKey) {
          const requestHash = createRequestHash(event)
          const idempotencyCheck = await idempotencyManager.checkIdempotency(
            idempotencyKey,
            securityContext.user.id,
            event.path,
            requestHash,
            options.idempotency.expirationHours || 24
          )

          if (idempotencyCheck.isDuplicate && idempotencyCheck.existingResponse) {
            logger.info('Returning cached idempotent response', { idempotencyKey })
            return {
              statusCode: idempotencyCheck.existingResponse.status,
              headers: { ...defaultHeaders, 'X-Idempotent-Replay': 'true' },
              body: JSON.stringify(idempotencyCheck.existingResponse.body)
            }
          }
        }
      }

      // Call the actual handler
      const startTime = Date.now()
      const response = await handler(event, securityContext)
      const duration = Date.now() - startTime

      // Store idempotency response if applicable
      if (options.idempotency?.enabled && securityContext.user && ['POST', 'PUT'].includes(event.httpMethod)) {
        const idempotencyKey = event.headers[options.idempotency.keyHeader || 'idempotency-key'] ||
                              event.headers[options.idempotency.keyHeader?.toLowerCase() || 'idempotency-key']
        
        if (idempotencyKey && response.statusCode >= 200 && response.statusCode < 300) {
          const requestHash = createRequestHash(event)
          await idempotencyManager.storeResponse(
            idempotencyKey,
            securityContext.user.id,
            event.path,
            requestHash,
            response.statusCode,
            JSON.parse(response.body)
          )
        }
      }

      // Audit logging
      if (options.audit?.enabled && securityContext.user) {
        const auditMetadata: Record<string, unknown> = {
          httpMethod: event.httpMethod,
          path: event.path,
          statusCode: response.statusCode,
          duration
        }

        if (options.audit.logRequestBody && event.body) {
          auditMetadata.requestBody = JSON.parse(event.body)
        }

        if (options.audit.logResponseBody && response.body) {
          try {
            auditMetadata.responseBody = JSON.parse(response.body)
          } catch {
            auditMetadata.responseBody = response.body
          }
        }

        await logger.logAudit(
          securityContext.user,
          options.audit.action,
          options.audit.resourceType,
          {
            metadata: auditMetadata,
            ipAddress: getClientIP(event),
            userAgent: getUserAgent(event)
          }
        )
      }

      logger.info('Request completed', {
        statusCode: response.statusCode,
        duration
      })

      return {
        ...response,
        headers: {
          ...defaultHeaders,
          ...response.headers
        }
      }

    } catch (error) {
      logger.error('Request failed', { error: error instanceof Error ? error.message : error })
      
      return {
        statusCode: 500,
        headers: defaultHeaders,
        body: JSON.stringify({
          success: false,
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
          correlationId
        })
      }
    }
  }
}

// Convenience functions for common security patterns
export const withCriticalOperationSecurity = (
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<{
    statusCode: number
    headers?: Record<string, string>
    body: string
  }>,
  auditAction: string,
  auditResourceType: string
) => {
  return withSecurity(handler, {
    auth: { required: true },
    rateLimit: {
      maxRequests: 10, // Stricter limit for critical operations
      windowSeconds: 60,
      skipForRoles: ['admin'] // Admins get higher limits
    },
    idempotency: {
      enabled: true,
      expirationHours: 24
    },
    audit: {
      enabled: true,
      action: auditAction,
      resourceType: auditResourceType,
      logRequestBody: true,
      logResponseBody: false // Don't log sensitive response data
    }
  })
}

export const withAdminSecurity = (
  handler: (event: HandlerEvent, context: SecurityContext) => Promise<{
    statusCode: number
    headers?: Record<string, string>
    body: string
  }>,
  auditAction: string,
  auditResourceType: string
) => {
  return withSecurity(handler, {
    auth: { 
      required: true,
      allowedRoles: ['admin']
    },
    rateLimit: {
      maxRequests: 100, // Higher limits for admin operations
      windowSeconds: 60
    },
    audit: {
      enabled: true,
      action: auditAction,
      resourceType: auditResourceType,
      logRequestBody: true,
      logResponseBody: true
    }
  })
}