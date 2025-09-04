/**
 * Comprehensive Readiness Check Endpoint (Readiness Probe)
 * 
 * Provides detailed health status for all system dependencies:
 * - Supabase database connectivity and performance
 * - SMTP service availability and response time
 * - Twilio SMS service validation (if enabled)
 * - Storage bucket accessibility
 * - Dead Letter Queue status with thresholds
 * - Budget tracking with alerting thresholds
 * 
 * Returns 200 for ready, 503 for not ready with detailed diagnostics.
 * Requires JWT authentication for security.
 */

import { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createRequestLogger } from '../../src/lib/monitoring/logger'
import { withMonitoring, NetlifyEvent, createSuccessResponse, createErrorResponse, validateJWT, RateLimiter } from '../../src/lib/monitoring/middleware'
import { Logger, MonitoringContext } from '../../src/lib/monitoring/types'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Rate limiter for readiness endpoint (protected, but still needs basic protection)
const readinessRateLimiter = new RateLimiter(30, 60000) // 30 requests per minute

// Define thresholds from environment variables
const THRESHOLDS = {
  DLQ_WARNING: parseInt(process.env.VITE_MONITORING_DLQ_WARNING || '5'),
  DLQ_CRITICAL: parseInt(process.env.VITE_MONITORING_DLQ_CRITICAL || '20'),
  BUDGET_WARNING_PCT: 80, // 80% of budget
  BUDGET_CRITICAL_PCT: 100, // 100% of budget (with grace)
  RESPONSE_TIME_WARNING: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_WARNING || '2000'),
  RESPONSE_TIME_CRITICAL: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_CRITICAL || '5000')
}

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error'
  message: string
  responseTime?: number
  details?: Record<string, unknown>
}

interface ReadinessResponse {
  status: 'ready' | 'warning' | 'not_ready'
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
    overallResponseTime: number
  }
  correlationId: string
  thresholds: typeof THRESHOLDS
}

export async function handler(event: NetlifyEvent, context: Context) {
  return withMonitoring(async (event, context, monitoring) => {
    const { logger, correlationId } = monitoring

    // Apply rate limiting
    const clientId = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    'unknown'
    
    if (!readinessRateLimiter.isAllowed(clientId)) {
      const resetTime = readinessRateLimiter.getResetTime(clientId)
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
          message: 'Too many readiness check requests',
          retryAfter,
          correlationId
        })
      }
    }

    // Validate method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405, correlationId)
    }

    // Validate JWT token for security
    try {
      const auth = validateJWT(event)
      logger.info('Authenticated readiness check requested', {
        action: 'readiness-check-start',
        userId: auth.userId,
        role: auth.role
      })
    } catch (error) {
      logger.warn('Unauthorized readiness check attempt', error as Error, {
        action: 'readiness-check-unauthorized'
      })
      return createErrorResponse('Unauthorized', 401, correlationId)
    }

    const startTime = Date.now()
    const readinessResponse: ReadinessResponse = {
      status: 'ready',
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
        memoryUsage: getMemoryUsage(),
        overallResponseTime: 0
      },
      correlationId,
      thresholds: THRESHOLDS
    }

    try {
      // Run all readiness checks in parallel for better performance
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
      readinessResponse.checks.database = getCheckResult(databaseCheck, 'Database check failed')
      readinessResponse.checks.smtp = getCheckResult(smtpCheck, 'SMTP check failed')
      readinessResponse.checks.sms = getCheckResult(smsCheck, 'SMS check failed')
      readinessResponse.checks.storage = getCheckResult(storageCheck, 'Storage check failed')
      readinessResponse.checks.queue = getCheckResult(queueCheck, 'Queue check failed')
      readinessResponse.checks.budget = getCheckResult(budgetCheck, 'Budget check failed')

      // Determine overall status
      const checkStatuses = Object.values(readinessResponse.checks).map(check => check.status)
      
      if (checkStatuses.includes('error')) {
        readinessResponse.status = 'not_ready'
      } else if (checkStatuses.includes('warning')) {
        readinessResponse.status = 'warning'
      } else {
        readinessResponse.status = 'ready'
      }

      // Add response time
      const responseTime = Date.now() - startTime
      readinessResponse.metrics.overallResponseTime = responseTime

      logger.performance('readiness-check-complete', responseTime, {
        action: 'readiness-check-complete',
        overallStatus: readinessResponse.status,
        checksCount: Object.keys(readinessResponse.checks).length
      })

      // Determine HTTP status code
      let statusCode = 200
      if (readinessResponse.status === 'not_ready') {
        statusCode = 503 // Service Unavailable
      } else if (readinessResponse.status === 'warning') {
        statusCode = 200 // OK but with warnings
      }

      logger.info('Readiness check completed', {
        action: 'readiness-check-complete',
        overallStatus: readinessResponse.status,
        statusCode,
        responseTimeMs: responseTime
      })

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readinessResponse, null, 2)
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      
      logger.error('Readiness check failed catastrophically', error as Error, {
        action: 'readiness-check-failed',
        responseTimeMs: responseTime
      })

      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          error: 'Readiness check failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          correlationId
        }, null, 2)
      }
    }
  }, {
    enableLogging: true,
    enableErrorTracking: true,
    enableCors: true
  })(event, context)
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
      logger.warn('Database readiness check failed', error as Error, {
        component: 'readiness-check',
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

    logger.debug('Database readiness check passed', {
      component: 'readiness-check',
      action: 'database-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'Database is accessible'

    // Apply thresholds
    if (responseTime > THRESHOLDS.RESPONSE_TIME_CRITICAL) {
      status = 'error'
      message = `Database is critically slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_CRITICAL}ms)`
    } else if (responseTime > THRESHOLDS.RESPONSE_TIME_WARNING) {
      status = 'warning'
      message = `Database is slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_WARNING}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        tablesAccessible: true,
        thresholds: {
          warning: THRESHOLDS.RESPONSE_TIME_WARNING,
          critical: THRESHOLDS.RESPONSE_TIME_CRITICAL
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Database readiness check exception', error as Error, {
      component: 'readiness-check',
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

    logger.debug('SMTP readiness check passed', {
      component: 'readiness-check',
      action: 'smtp-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'SMTP service is available'

    // Apply thresholds
    if (responseTime > THRESHOLDS.RESPONSE_TIME_CRITICAL) {
      status = 'error'
      message = `SMTP is critically slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_CRITICAL}ms)`
    } else if (responseTime > THRESHOLDS.RESPONSE_TIME_WARNING) {
      status = 'warning'
      message = `SMTP is slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_WARNING}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        thresholds: {
          warning: THRESHOLDS.RESPONSE_TIME_WARNING,
          critical: THRESHOLDS.RESPONSE_TIME_CRITICAL
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('SMTP readiness check failed', error as Error, {
      component: 'readiness-check',
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

    logger.debug('SMS readiness check passed', {
      component: 'readiness-check',
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
    
    logger.error('SMS readiness check failed', error as Error, {
      component: 'readiness-check',
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
      logger.warn('Storage readiness check failed', error as Error, {
        component: 'readiness-check',
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

    logger.debug('Storage readiness check passed', {
      component: 'readiness-check',
      action: 'storage-check-success',
      responseTimeMs: responseTime
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'Storage is accessible'

    // Apply thresholds
    if (responseTime > THRESHOLDS.RESPONSE_TIME_CRITICAL) {
      status = 'error'
      message = `Storage is critically slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_CRITICAL}ms)`
    } else if (responseTime > THRESHOLDS.RESPONSE_TIME_WARNING) {
      status = 'warning'
      message = `Storage is slow (${responseTime}ms > ${THRESHOLDS.RESPONSE_TIME_WARNING}ms)`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        bucket: bucketName,
        accessible: true,
        thresholds: {
          warning: THRESHOLDS.RESPONSE_TIME_WARNING,
          critical: THRESHOLDS.RESPONSE_TIME_CRITICAL
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Storage readiness check exception', error as Error, {
      component: 'readiness-check',
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
    // Import existing DLQ service
    const { DeadLetterQueueService } = await import('../../src/lib/notifications/dlq-service')
    const dlqService = new DeadLetterQueueService(supabaseUrl, supabaseServiceKey)
    
    // Get DLQ statistics
    const dlqStats = await dlqService.getDLQStats()
    const responseTime = Date.now() - startTime

    logger.debug('Queue readiness check completed', {
      component: 'readiness-check',
      action: 'queue-check-success',
      responseTimeMs: responseTime,
      metadata: {
        totalItems: dlqStats.totalItems,
        recentFailures: dlqStats.recentFailures
      }
    })

    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    let message = 'Queue is healthy'

    // Apply thresholds
    if (dlqStats.totalItems >= THRESHOLDS.DLQ_CRITICAL || dlqStats.recentFailures >= THRESHOLDS.DLQ_CRITICAL) {
      status = 'error'
      message = `Queue critical: ${dlqStats.totalItems} items (>${THRESHOLDS.DLQ_CRITICAL}), ${dlqStats.recentFailures} recent failures`
    } else if (dlqStats.totalItems >= THRESHOLDS.DLQ_WARNING || dlqStats.recentFailures >= THRESHOLDS.DLQ_WARNING) {
      status = 'warning'
      message = `Queue warning: ${dlqStats.totalItems} items (>${THRESHOLDS.DLQ_WARNING}), ${dlqStats.recentFailures} recent failures`
    }

    return {
      status,
      message,
      responseTime,
      details: {
        totalItems: dlqStats.totalItems,
        recentFailures: dlqStats.recentFailures,
        retryEligible: dlqStats.retryEligible,
        failureTypes: dlqStats.byFailureType,
        thresholds: {
          warning: THRESHOLDS.DLQ_WARNING,
          critical: THRESHOLDS.DLQ_CRITICAL
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Queue readiness check failed', error as Error, {
      component: 'readiness-check',
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

    logger.debug('Budget readiness check completed', {
      component: 'readiness-check',
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

    const emailUsagePct = budgetTracking?.emailBudgetUsedPct || 0
    const smsUsagePct = budgetTracking?.smsBudgetUsedPct || 0
    const maxUsagePct = Math.max(emailUsagePct, smsUsagePct)

    const criticalAlerts = budgetAlerts.filter(a => a.type === 'limit_reached')
    const warningAlerts = budgetAlerts.filter(a => a.type === 'warning')

    // Apply thresholds
    if (criticalAlerts.length > 0 || maxUsagePct >= THRESHOLDS.BUDGET_CRITICAL_PCT) {
      status = 'error'
      message = `Budget critical: ${criticalAlerts.length} limits reached, max usage ${maxUsagePct}%`
    } else if (warningAlerts.length > 0 || maxUsagePct >= THRESHOLDS.BUDGET_WARNING_PCT) {
      status = 'warning'
      message = `Budget warning: ${warningAlerts.length} alerts, max usage ${maxUsagePct}%`
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
          emailUsagePercent: emailUsagePct,
          smsUsagePercent: smsUsagePct,
          maxUsagePercent: maxUsagePct
        },
        thresholds: {
          warning: THRESHOLDS.BUDGET_WARNING_PCT,
          critical: THRESHOLDS.BUDGET_CRITICAL_PCT
        }
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Budget readiness check failed', error as Error, {
      component: 'readiness-check',
      action: 'budget-check-failed',
      responseTimeMs: responseTime
    })

    return {
      status: 'warning', // Budget check failure is not critical for readiness
      message: `Budget check unavailable: ${(error as Error).message}`,
      responseTime,
      details: {
        exception: (error as Error).name
      }
    }
  }
}