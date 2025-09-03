/**
 * Monitoring Middleware for Netlify Functions
 * 
 * Provides consistent logging, error tracking, and correlation ID handling
 * across all Netlify functions.
 */

import { Context } from '@netlify/functions'
import { createRequestLogger } from '../../src/lib/monitoring/logger'
import { errorTracker } from '../../src/hooks/use-error-tracking'

export interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string> | null
  body: string | null
  path?: string
  multiValueQueryStringParameters?: Record<string, string[]> | null
  pathParameters?: Record<string, string> | null
  stageVariables?: Record<string, string> | null
  requestContext?: any
  isBase64Encoded?: boolean
}

export interface MonitoredResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  isBase64Encoded?: boolean
}

export interface MonitoringConfig {
  enableLogging?: boolean
  enableErrorTracking?: boolean
  enableCors?: boolean
  corsOrigins?: string[]
  timeout?: number
}

interface MonitoringContext {
  correlationId: string
  logger: any
  startTime: number
  functionName: string
}

/**
 * Monitoring middleware wrapper for Netlify functions
 */
export function withMonitoring(
  handler: (event: NetlifyEvent, context: Context, monitoring: MonitoringContext) => Promise<MonitoredResponse>,
  config: MonitoringConfig = {}
) {
  const defaultConfig: MonitoringConfig = {
    enableLogging: true,
    enableErrorTracking: true,
    enableCors: true,
    corsOrigins: ['*'],
    timeout: 30000,
    ...config
  }

  return async (event: NetlifyEvent, context: Context): Promise<MonitoredResponse> => {
    const startTime = Date.now()
    const functionName = context.functionName || 'unknown-function'
    
    // Create request logger with correlation ID
    const logger = createRequestLogger(event.headers)
    const correlationId = logger.getCorrelationId()
    
    // Create monitoring context
    const monitoringContext: MonitoringContext = {
      correlationId,
      logger,
      startTime,
      functionName
    }

    // Default CORS headers
    const corsHeaders = defaultConfig.enableCors ? {
      'Access-Control-Allow-Origin': defaultConfig.corsOrigins?.[0] || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '3600',
      'X-Correlation-Id': correlationId
    } : {
      'X-Correlation-Id': correlationId
    }

    // Log incoming request
    if (defaultConfig.enableLogging) {
      logger.info('Function invocation started', {
        action: 'function-invocation-start',
        httpMethod: event.httpMethod,
        path: event.path,
        userAgent: event.headers['user-agent'] || 'unknown',
        ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown',
        metadata: {
          functionName,
          hasBody: !!event.body,
          queryParams: Object.keys(event.queryStringParameters || {}).length
        }
      })
    }

    try {
      // Handle CORS preflight requests
      if (event.httpMethod === 'OPTIONS' && defaultConfig.enableCors) {
        logger.debug('CORS preflight request handled', {
          action: 'cors-preflight',
          origin: event.headers.origin || 'unknown'
        })

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: ''
        }
      }

      // Set up timeout handling
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (defaultConfig.timeout) {
          setTimeout(() => {
            reject(new Error(`Function timeout after ${defaultConfig.timeout}ms`))
          }, defaultConfig.timeout)
        }
      })

      // Execute the handler with timeout
      const handlerPromise = handler(event, context, monitoringContext)
      const response = await Promise.race([handlerPromise, timeoutPromise])

      // Merge CORS headers with response headers
      const finalResponse: MonitoredResponse = {
        ...response,
        headers: {
          ...corsHeaders,
          ...response.headers
        }
      }

      // Log successful completion
      const duration = Date.now() - startTime
      if (defaultConfig.enableLogging) {
        logger.performance('function-completion', duration, {
          action: 'function-completion',
          statusCode: response.statusCode,
          responseSize: response.body?.length || 0
        })
      }

      return finalResponse

    } catch (error) {
      const duration = Date.now() - startTime
      const errorObj = error as Error

      // Log error
      if (defaultConfig.enableLogging) {
        logger.error('Function execution failed', errorObj, {
          action: 'function-error',
          duration,
          httpMethod: event.httpMethod,
          path: event.path
        })
      }

      // Track error
      if (defaultConfig.enableErrorTracking) {
        await errorTracker.trackError(errorObj, {
          component: functionName,
          action: 'function-execution',
          correlationId,
          severity: 'high',
          userFacing: false,
          metadata: {
            httpMethod: event.httpMethod,
            path: event.path,
            duration
          }
        })
      }

      // Determine error response
      let statusCode = 500
      let errorMessage = 'Internal Server Error'

      if (errorObj.message.includes('timeout')) {
        statusCode = 504
        errorMessage = 'Gateway Timeout'
      } else if (errorObj.message.includes('unauthorized')) {
        statusCode = 401
        errorMessage = 'Unauthorized'
      } else if (errorObj.message.includes('forbidden')) {
        statusCode = 403
        errorMessage = 'Forbidden'
      } else if (errorObj.message.includes('not found')) {
        statusCode = 404
        errorMessage = 'Not Found'
      } else if (errorObj.message.includes('validation')) {
        statusCode = 400
        errorMessage = 'Bad Request'
      }

      return {
        statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: errorMessage,
          message: process.env.NODE_ENV === 'development' ? errorObj.message : undefined,
          correlationId,
          timestamp: new Date().toISOString()
        })
      }
    }
  }
}

/**
 * Helper function to validate request method
 */
export function validateMethod(event: NetlifyEvent, allowedMethods: string[]): void {
  if (!allowedMethods.includes(event.httpMethod)) {
    throw new Error(`Method ${event.httpMethod} not allowed. Allowed methods: ${allowedMethods.join(', ')}`)
  }
}

/**
 * Helper function to validate required headers
 */
export function validateHeaders(event: NetlifyEvent, requiredHeaders: string[]): void {
  const missingHeaders = requiredHeaders.filter(header => 
    !event.headers[header] && !event.headers[header.toLowerCase()]
  )
  
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
  }
}

/**
 * Helper function to parse JSON body safely
 */
export function parseJsonBody<T = any>(event: NetlifyEvent): T {
  if (!event.body) {
    throw new Error('Request body is required')
  }

  try {
    return JSON.parse(event.body) as T
  } catch (error) {
    throw new Error('Invalid JSON in request body')
  }
}

/**
 * Helper function to validate JWT token
 */
export function validateJWT(event: NetlifyEvent): { userId: string; role: string } {
  const authHeader = event.headers.authorization || event.headers.Authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  const token = authHeader.substring(7)
  
  try {
    // For now, accept any well-formed JWT-like token for testing
    // In production, this would use proper JWT verification with secret
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    // Basic validation - in production, use proper JWT library
    // and verify signature with secret
    return { 
      userId: 'test-user', 
      role: 'admin' // For testing purposes
    }
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}

/**
 * Helper function to create standardized success response
 */
export function createSuccessResponse<T = any>(
  data: T,
  statusCode: number = 200,
  additionalHeaders: Record<string, string> = {}
): MonitoredResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Helper function to create standardized error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 400,
  correlationId?: string,
  additionalHeaders: Record<string, string> = {}
): MonitoredResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    },
    body: JSON.stringify({
      success: false,
      error: message,
      correlationId,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }

    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    const validRequests = requests.filter(time => now - time < this.windowMs)
    
    return Math.max(0, this.maxRequests - validRequests.length)
  }

  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    return oldestRequest + this.windowMs
  }
}

// Export a default rate limiter instance
export const defaultRateLimiter = new RateLimiter()

/**
 * Helper to apply rate limiting
 */
export function applyRateLimit(
  event: NetlifyEvent,
  rateLimiter: RateLimiter = defaultRateLimiter,
  identifier?: string
): void {
  const clientId = identifier || 
    event.headers['x-forwarded-for'] || 
    event.headers['x-real-ip'] || 
    'unknown'

  if (!rateLimiter.isAllowed(clientId)) {
    const resetTime = rateLimiter.getResetTime(clientId)
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
    
    const error = new Error('Rate limit exceeded') as any
    error.statusCode = 429
    error.headers = {
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': rateLimiter['maxRequests'].toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': resetTime.toString()
    }
    
    throw error
  }
}