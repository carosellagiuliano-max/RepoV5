/**
 * Lightweight Health Check Endpoint (Liveness Probe)
 * 
 * Provides fast basic health status without heavy I/O operations:
 * - Build information and version
 * - Basic system metrics
 * - Service availability (without actual connectivity tests)
 * 
 * Always returns 200 unless service is completely down.
 * For comprehensive dependency checks, use /api/ready instead.
 */

import { Context } from '@netlify/functions'
import { createRequestLogger } from '../../src/lib/monitoring/logger'
import { withMonitoring, NetlifyEvent, createSuccessResponse, RateLimiter } from '../../src/lib/monitoring/middleware'

// Rate limiter for health endpoint (public, so needs protection)
const healthRateLimiter = new RateLimiter(60, 60000) // 60 requests per minute

interface HealthResponse {
  status: 'healthy'
  timestamp: string
  version: string
  buildInfo: {
    version: string
    environment: string
    region: string
    nodeVersion: string
    deployId?: string
  }
  metrics: {
    uptime: number
    memoryUsage?: {
      used: number
      total: number
      percentage: number
    }
  }
  correlationId: string
}

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body: string
}

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body: string
}

export async function handler(event: NetlifyEvent, context: Context) {
  // Check if we're in mock mode - return simple response
  const mockMode = process.env.DB_MOCK_MODE === 'true' || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.MOCK_MODE === 'true'

  if (mockMode) {
    // Simple mock response for testing
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        ok: true,
        status: 'healthy',
        mode: 'mock',
        timestamp: new Date().toISOString(),
        version: process.env.VITE_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'test',
        uptime: Math.floor(process.uptime()),
        correlationId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    }
  }

  return withMonitoring(async (event, context, monitoring) => {
    const { logger, correlationId } = monitoring

    // Apply rate limiting
    const clientId = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    'unknown'
    
    if (!healthRateLimiter.isAllowed(clientId)) {
      const resetTime = healthRateLimiter.getResetTime(clientId)
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString()
        },
        body: JSON.stringify({
          status: 'rate_limited',
          message: 'Too many health check requests',
          retryAfter,
          correlationId
        })
      }
    }

    logger.info('Lightweight health check requested', {
      action: 'health-check-start',
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

    const healthResponse: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VITE_APP_VERSION || '1.0.0',
      buildInfo: {
        version: process.env.VITE_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        region: process.env.AWS_REGION || 'us-east-1',
        nodeVersion: process.version,
        deployId: process.env.DEPLOY_ID
      },
      metrics: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: getMemoryUsage()
      },
      correlationId
    }

    logger.info('Health check completed', {
      action: 'health-check-complete',
      status: 'healthy'
    })

    return createSuccessResponse(healthResponse)
  }, {
    enableLogging: true,
    enableErrorTracking: false, // Don't track health check errors as alerts
    enableCors: true
  })(event, context)
}

function getMemoryUsage() {
  const usage = process.memoryUsage()
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024)
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024)
  
  return {
    used: usedMB,
    total: totalMB,
    percentage: Math.round((usedMB / totalMB) * 100)
  }
}