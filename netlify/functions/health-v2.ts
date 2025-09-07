/**
 * Enhanced Health Check Endpoint using Monitoring Middleware
 * 
 * This demonstrates how to use the monitoring middleware for consistent
 * logging, error tracking, and correlation ID handling.
 */

import { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { 
  withMonitoring, 
  NetlifyEvent, 
  MonitoredResponse,
  validateMethod,
  createSuccessResponse,
  createErrorResponse
} from '../../lib/monitoring/middleware'
import { Logger, MonitoringContext, HealthCheck as SharedHealthCheck } from '../../lib/monitoring/types'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error'
  message: string
  responseTime?: number
  details?: Record<string, unknown>
}

interface HealthResponse {
  status: 'healthy' | 'warning' | 'error'
  timestamp: string
  version: string
  buildInfo: {
    version: string
    environment: string
    region: string
    nodeVersion: string
    deployId?: string
  }
  checks: {
    database: HealthCheck
    smtp: HealthCheck
    sms: HealthCheck
    storage: HealthCheck
    queue: HealthCheck
    budget: HealthCheck
  }
  metrics: {
    uptime: number
    memoryUsage?: {
      used: number
      total: number
      percentage: number
    }
    requestsPerMinute?: number
    errorRate?: number
  }
  correlationId: string
}

// Main handler function
async function healthHandler(
  event: NetlifyEvent,
  context: Context,
  monitoring: MonitoringContext
): Promise<MonitoredResponse> {
  const { logger, correlationId } = monitoring

  // Validate HTTP method
  validateMethod(event, ['GET'])

  logger.info('Starting comprehensive health check', {
    action: 'health-check-start',
    checks: ['database', 'smtp', 'sms', 'storage', 'queue', 'budget']
  })

  const startTime = Date.now()
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
    checks: {
      database: { status: 'healthy', message: 'Not checked' },
      smtp: { status: 'healthy', message: 'Not checked' },
      sms: { status: 'healthy', message: 'Not checked' },
      storage: { status: 'healthy', message: 'Not checked' },
      queue: { status: 'healthy', message: 'Not checked' },
      budget: { status: 'healthy', message: 'Not checked' }
    },
    metrics: {
      uptime: Math.floor(process.uptime()),
      memoryUsage: getMemoryUsage()
    },
    correlationId
  }

  try {
    // Run all health checks in parallel for better performance
    const [
      databaseCheck,
      smtpCheck,
      smsCheck,
      storageCheck,
      queueCheck,
      budgetCheck
    ] = await Promise.allSettled([
      checkDatabase(logger),
      checkSMTP(logger),
      checkSMS(logger),
      checkStorage(logger),
      checkQueue(logger),
      checkBudget(logger)
    ])

    // Process results
    healthResponse.checks.database = getCheckResult(databaseCheck, 'Database check failed')
    healthResponse.checks.smtp = getCheckResult(smtpCheck, 'SMTP check failed')
    healthResponse.checks.sms = getCheckResult(smsCheck, 'SMS check failed')
    healthResponse.checks.storage = getCheckResult(storageCheck, 'Storage check failed')
    healthResponse.checks.queue = getCheckResult(queueCheck, 'Queue check failed')
    healthResponse.checks.budget = getCheckResult(budgetCheck, 'Budget check failed')

    // Determine overall status
    const checkStatuses = Object.values(healthResponse.checks).map(check => check.status)
    
    if (checkStatuses.includes('error')) {
      healthResponse.status = 'error'
    } else if (checkStatuses.includes('warning')) {
      healthResponse.status = 'warning'
    } else {
      healthResponse.status = 'healthy'
    }

    // Add response time
    const responseTime = Date.now() - startTime
    logger.performance('health-check-complete', responseTime, {
      action: 'health-check-complete',
      overallStatus: healthResponse.status,
      checksCount: Object.keys(healthResponse.checks).length
    })

    // Determine HTTP status code
    let statusCode = 200
    if (healthResponse.status === 'error') {
      statusCode = 503 // Service Unavailable
    } else if (healthResponse.status === 'warning') {
      statusCode = 200 // OK but with warnings
    }

    logger.info('Health check completed', {
      action: 'health-check-complete',
      overallStatus: healthResponse.status,
      statusCode,
      responseTimeMs: responseTime
    })

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(healthResponse, null, 2)
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Health check failed catastrophically', error as Error, {
      action: 'health-check-failed',
      responseTimeMs: responseTime
    })

    return createErrorResponse(
      'Health check failed',
      503,
      correlationId,
      { 'Cache-Control': 'no-cache' }
    )
  }
}

function getCheckResult(
  result: PromiseSettledResult<HealthCheck>,
  defaultErrorMessage: string
): HealthCheck {
  if (result.status === 'fulfilled') {
    return result.value
  } else {
    return {
      status: 'error',
      message: result.reason?.message || defaultErrorMessage,
      details: {
        error: result.reason?.name || 'Unknown error'
      }
    }
  }
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

async function checkDatabase(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Test basic connectivity
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
      .single()

    const responseTime = Date.now() - startTime

    if (error) {
      logger.warn('Database health check failed', error as Error, {
        component: 'health-check',
        action: 'database-check-failed',
        responseTimeMs: responseTime
      })
      
      return {
        status: 'error',
        message: `Database error: ${error.message}`,
        responseTime,
        details: {
          errorCode: error.code,
          errorHint: error.hint
        }
      }
    }

    logger.debug('Database health check passed', {
      component: 'health-check',
      action: 'database-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' = 'healthy'
    let message = 'Database is accessible'

    // Warn if response time is high
    if (responseTime > 1000) {
      status = 'warning'
      message = `Database is slow (${responseTime}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        tablesAccessible: true
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Database health check exception', error as Error, {
      component: 'health-check',
      action: 'database-check-exception',
      responseTimeMs: responseTime
    })

    return {
      status: 'error',
      message: `Database connection failed: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

async function checkSMTP(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USERNAME
    const smtpPassword = process.env.SMTP_PASSWORD

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return {
        status: 'warning',
        message: 'SMTP not configured',
        responseTime: Date.now() - startTime,
        details: {
          configured: false
        }
      }
    }

    const transporter = nodemailer.createTransporter({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    })

    // Test connection
    await transporter.verify()
    
    const responseTime = Date.now() - startTime

    logger.debug('SMTP health check passed', {
      component: 'health-check',
      action: 'smtp-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' = 'healthy'
    let message = 'SMTP service is available'

    // Warn if response time is high
    if (responseTime > 2000) {
      status = 'warning'
      message = `SMTP is slow (${responseTime}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('SMTP health check failed', error as Error, {
      component: 'health-check',
      action: 'smtp-check-failed',
      responseTimeMs: responseTime
    })

    return {
      status: 'error',
      message: `SMTP connection failed: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

async function checkSMS(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const smsEnabled = process.env.VITE_SMS_ENABLED === 'true'
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN

    if (!smsEnabled) {
      return {
        status: 'healthy',
        message: 'SMS service disabled',
        responseTime: Date.now() - startTime,
        details: {
          enabled: false
        }
      }
    }

    if (!twilioAccountSid || !twilioAuthToken) {
      return {
        status: 'warning',
        message: 'SMS enabled but Twilio not configured',
        responseTime: Date.now() - startTime,
        details: {
          enabled: true,
          configured: false
        }
      }
    }

    // Basic validation - we don't make actual API calls to avoid costs
    const responseTime = Date.now() - startTime

    logger.debug('SMS health check passed', {
      component: 'health-check',
      action: 'sms-check-success',
      responseTimeMs: responseTime
    })

    return {
      status: 'healthy',
      message: 'SMS service configured',
      responseTime,
      details: {
        enabled: true,
        configured: true,
        provider: 'twilio'
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('SMS health check failed', error as Error, {
      component: 'health-check',
      action: 'sms-check-failed',
      responseTimeMs: responseTime
    })

    return {
      status: 'error',
      message: `SMS check failed: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

async function checkStorage(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'salon-media'

    // Test storage accessibility
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1 })

    const responseTime = Date.now() - startTime

    if (error) {
      logger.warn('Storage health check failed', error as Error, {
        component: 'health-check',
        action: 'storage-check-failed',
        responseTimeMs: responseTime
      })

      return {
        status: 'error',
        message: `Storage error: ${error.message}`,
        responseTime,
        details: {
          bucket: bucketName,
          errorCode: (error as unknown as { statusCode?: number }).statusCode
        }
      }
    }

    logger.debug('Storage health check passed', {
      component: 'health-check',
      action: 'storage-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' = 'healthy'
    let message = 'Storage is accessible'

    // Warn if response time is high
    if (responseTime > 1500) {
      status = 'warning'
      message = `Storage is slow (${responseTime}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        bucket: bucketName,
        accessible: true
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Storage health check exception', error as Error, {
      component: 'health-check',
      action: 'storage-check-exception',
      responseTimeMs: responseTime
    })

    return {
      status: 'error',
      message: `Storage connection failed: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

async function checkQueue(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // For this example, we'll simulate a queue check
    // In a real implementation, you'd check your actual queue service
    const responseTime = Date.now() - startTime

    logger.debug('Queue health check completed', {
      component: 'health-check',
      action: 'queue-check-success',
      responseTimeMs: responseTime
    })

    return {
      status: 'healthy',
      message: 'Queue is healthy',
      responseTime,
      details: {
        totalItems: 0,
        recentFailures: 0,
        retryEligible: 0
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Queue health check failed', error as Error, {
      component: 'health-check',
      action: 'queue-check-failed',
      responseTimeMs: responseTime
    })

    return {
      status: 'error',
      message: `Queue check failed: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

async function checkBudget(logger: Logger): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // For this example, we'll simulate a budget check
    // In a real implementation, you'd check your actual budget tracking
    const responseTime = Date.now() - startTime

    logger.debug('Budget health check completed', {
      component: 'health-check',
      action: 'budget-check-success',
      responseTimeMs: responseTime
    })

    return {
      status: 'healthy',
      message: 'Budget is within limits',
      responseTime,
      details: {
        totalAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        currentMonth: {
          emailUsagePercent: 0,
          smsUsagePercent: 0
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Budget health check failed', error as Error, {
      component: 'health-check',
      action: 'budget-check-failed',
      responseTimeMs: responseTime
    })

    return {
      status: 'warning', // Budget check failure is not critical
      message: `Budget check unavailable: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}

// Export the handler wrapped with monitoring middleware
export const handler = withMonitoring(healthHandler, {
  enableLogging: true,
  enableErrorTracking: true,
  enableCors: true,
  corsOrigins: ['*'],
  timeout: 30000
})