/**
 * Database Health Check Endpoint
 * 
 * Specific health check for database connectivity and performance
 * Returns detailed database metrics and status
 */

import { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createRequestLogger } from '../../../src/lib/monitoring/logger'
import { withMonitoring, NetlifyEvent, createSuccessResponse, createErrorResponse, RateLimiter } from '../../../src/lib/monitoring/middleware'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Rate limiter for database health endpoint
const dbHealthRateLimiter = new RateLimiter(30, 60000) // 30 requests per minute

interface DatabaseHealthResponse {
  status: 'healthy' | 'warning' | 'error'
  timestamp: string
  database: {
    status: 'connected' | 'disconnected' | 'slow'
    responseTime: number
    tablesAccessible: boolean
    lastConnection: string
  }
  thresholds: {
    warning: number
    critical: number
  }
  correlationId: string
}

export async function handler(event: NetlifyEvent, context: Context) {
  return withMonitoring(async (event, context, monitoring) => {
    const { logger, correlationId } = monitoring

    // Apply rate limiting
    const clientId = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    'unknown'
    
    if (!dbHealthRateLimiter.isAllowed(clientId)) {
      const resetTime = dbHealthRateLimiter.getResetTime(clientId)
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString()
        },
        body: JSON.stringify({
          status: 'rate_limited',
          message: 'Too many database health check requests',
          retryAfter,
          correlationId
        })
      }
    }

    logger.info('Database health check requested', {
      action: 'database-health-check-start',
      httpMethod: event.httpMethod
    })

    // Validate method
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Method not allowed',
          correlationId 
        })
      }
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // Measure database response time
      const startTime = Date.now()
      
      // Simple connectivity test
      const { data, error } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1)
        .single()
      
      const responseTime = Date.now() - startTime
      
      // Define thresholds
      const warningThreshold = parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_WARNING || '2000')
      const criticalThreshold = parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_CRITICAL || '5000')
      
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      let dbStatus: 'connected' | 'disconnected' | 'slow' = 'connected'
      
      if (error) {
        status = 'error'
        dbStatus = 'disconnected'
        logger.error('Database health check failed', {
          action: 'database-health-check-error',
          error: error.message,
          responseTime
        })
      } else if (responseTime > criticalThreshold) {
        status = 'error'
        dbStatus = 'slow'
        logger.warn('Database response time critical', {
          action: 'database-health-check-slow',
          responseTime,
          threshold: criticalThreshold
        })
      } else if (responseTime > warningThreshold) {
        status = 'warning'
        dbStatus = 'slow'
        logger.warn('Database response time warning', {
          action: 'database-health-check-warning',
          responseTime,
          threshold: warningThreshold
        })
      }

      const healthResponse: DatabaseHealthResponse = {
        status,
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          responseTime,
          tablesAccessible: !error,
          lastConnection: new Date().toISOString()
        },
        thresholds: {
          warning: warningThreshold,
          critical: criticalThreshold
        },
        correlationId
      }

      logger.info('Database health check completed', {
        action: 'database-health-check-complete',
        status,
        responseTime,
        tablesAccessible: !error
      })

      const statusCode = status === 'error' ? 503 : 200
      
      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-Id',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        },
        body: JSON.stringify(healthResponse)
      }

    } catch (error) {
      logger.error('Database health check exception', {
        action: 'database-health-check-exception',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      const errorResponse: DatabaseHealthResponse = {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          responseTime: -1,
          tablesAccessible: false,
          lastConnection: 'never'
        },
        thresholds: {
          warning: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_WARNING || '2000'),
          critical: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_CRITICAL || '5000')
        },
        correlationId
      }

      return {
        statusCode: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-Id',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        },
        body: JSON.stringify(errorResponse)
      }
    }
  }, {
    enableLogging: true,
    enableErrorTracking: true,
    enableCors: true
  })(event, context)
}