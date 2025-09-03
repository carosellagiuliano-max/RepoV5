/**
 * Comprehensive Health Check Endpoint
 * 
 * Provides detailed health status for all system dependencies:
 * - Supabase database connectivity
 * - SMTP service availability
 * - Twilio SMS service (if enabled)
 * - Build information and version
 * - System metrics and performance
 * - Dead Letter Queue status
 * - Budget and rate limiting status
 * 
 * Returns 200 for healthy, 503 for unhealthy with detailed diagnostics
 */

import { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createRequestLogger } from '../../src/lib/monitoring/logger'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body: string
}

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error'
  message: string
  responseTime?: number
  details?: Record<string, any>
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

export async function handler(event: NetlifyEvent, context: Context) {
  const requestLogger = createRequestLogger(event.headers)
  const correlationId = requestLogger.getCorrelationId()
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-Id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId
  }

  requestLogger.info('Health check requested', {
    action: 'health-check-start',
    httpMethod: event.httpMethod,
    userAgent: event.headers['user-agent'] || 'unknown'
  })

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  if (event.httpMethod !== 'GET') {
    requestLogger.warn('Invalid method for health check', {
      action: 'health-check-invalid-method',
      method: event.httpMethod
    })
    
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        correlationId 
      })
    }
  }

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
      checkDatabase(requestLogger),
      checkSMTP(requestLogger),
      checkSMS(requestLogger),
      checkStorage(requestLogger),
      checkQueue(requestLogger),
      checkBudget(requestLogger)
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
    requestLogger.performance('health-check-complete', responseTime, {
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

    requestLogger.info('Health check completed', {
      action: 'health-check-complete',
      overallStatus: healthResponse.status,
      statusCode,
      responseTimeMs: responseTime
    })

    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify(healthResponse, null, 2)
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    requestLogger.error('Health check failed catastrophically', error as Error, {
      action: 'health-check-failed',
      responseTimeMs: responseTime
    })

    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      }, null, 2)
    }
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

async function checkDatabase(requestLogger: any): Promise<HealthCheck> {
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
      requestLogger.warn('Database health check failed', error as Error, {
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

    requestLogger.debug('Database health check passed', {
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
    
    requestLogger.error('Database health check exception', error as Error, {
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

async function checkSMTP(requestLogger: any): Promise<HealthCheck> {
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

    requestLogger.debug('SMTP health check passed', {
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
    
    requestLogger.error('SMTP health check failed', error as Error, {
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

async function checkSMS(requestLogger: any): Promise<HealthCheck> {
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

    requestLogger.debug('SMS health check passed', {
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
    
    requestLogger.error('SMS health check failed', error as Error, {
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

async function checkStorage(requestLogger: any): Promise<HealthCheck> {
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
      requestLogger.warn('Storage health check failed', error as Error, {
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
          errorCode: (error as any).statusCode
        }
      }
    }

    requestLogger.debug('Storage health check passed', {
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
    
    requestLogger.error('Storage health check exception', error as Error, {
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

async function checkQueue(requestLogger: any): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Import existing DLQ service
    const { DeadLetterQueueService } = await import('../../src/lib/notifications/dlq-service')
    const dlqService = new DeadLetterQueueService(supabaseUrl, supabaseServiceKey)
    
    // Get DLQ statistics
    const dlqStats = await dlqService.getDLQStats()
    const responseTime = Date.now() - startTime

    requestLogger.debug('Queue health check completed', {
      component: 'health-check',
      action: 'queue-check-success',
      responseTimeMs: responseTime,
      metadata: {
        totalItems: dlqStats.totalItems,
        recentFailures: dlqStats.recentFailures
      }
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'Queue is healthy'

    // Determine status based on DLQ contents
    if (dlqStats.recentFailures > 10) {
      status = 'error'
      message = `High failure rate: ${dlqStats.recentFailures} recent failures`
    } else if (dlqStats.totalItems > 5) {
      status = 'warning'
      message = `Queue has ${dlqStats.totalItems} items in DLQ`
    } else if (dlqStats.totalItems > 0) {
      status = 'warning'
      message = `${dlqStats.totalItems} items in DLQ`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        totalItems: dlqStats.totalItems,
        recentFailures: dlqStats.recentFailures,
        retryEligible: dlqStats.retryEligible,
        failureTypes: dlqStats.byFailureType
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    requestLogger.error('Queue health check failed', error as Error, {
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

async function checkBudget(requestLogger: any): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Import existing notification settings service
    const { NotificationSettingsService } = await import('../../src/lib/notifications/settings-service')
    const settingsService = new NotificationSettingsService(supabaseUrl, supabaseServiceKey)
    
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    // Get budget alerts
    const budgetAlerts = await settingsService.getBudgetAlerts('global')
    const budgetTracking = await settingsService.getBudgetTracking('global', undefined, currentYear, currentMonth)
    
    const responseTime = Date.now() - startTime

    requestLogger.debug('Budget health check completed', {
      component: 'health-check',
      action: 'budget-check-success',
      responseTimeMs: responseTime,
      metadata: {
        alertsCount: budgetAlerts.length,
        emailUsagePercent: budgetTracking?.emailBudgetUsedPct || 0,
        smsUsagePercent: budgetTracking?.smsBudgetUsedPct || 0
      }
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'Budget is within limits'

    const criticalAlerts = budgetAlerts.filter(a => a.type === 'limit_reached')
    const warningAlerts = budgetAlerts.filter(a => a.type === 'warning')

    if (criticalAlerts.length > 0) {
      status = 'error'
      message = `Budget limits reached: ${criticalAlerts.length} critical alerts`
    } else if (warningAlerts.length > 0) {
      status = 'warning'
      message = `Budget warning: ${warningAlerts.length} alerts`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        totalAlerts: budgetAlerts.length,
        criticalAlerts: criticalAlerts.length,
        warningAlerts: warningAlerts.length,
        currentMonth: {
          emailUsagePercent: budgetTracking?.emailBudgetUsedPct || 0,
          smsUsagePercent: budgetTracking?.smsBudgetUsedPct || 0
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    requestLogger.error('Budget health check failed', error as Error, {
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