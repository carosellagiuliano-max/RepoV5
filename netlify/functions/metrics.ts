/**
 * Basic Metrics Endpoint
 * 
 * Provides basic operational metrics for monitoring:
 * - Request counts and response times
 * - Error rates
 * - DLQ statistics
 * - Budget usage
 * - System resource usage
 */

import { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { withMonitoring, NetlifyEvent, createSuccessResponse, createErrorResponse, validateJWT } from '../../src/lib/monitoring/middleware'
import { alertManager } from '../../src/lib/monitoring/alerts'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface MetricsResponse {
  timestamp: string
  system: {
    uptime: number
    memoryUsage: {
      used: number
      total: number
      percentage: number
    }
    nodeVersion: string
    environment: string
  }
  alerts: {
    totalAlerts: number
    recentFingerprints: number
    throttledAlerts: number
  }
  queue?: {
    totalItems: number
    recentFailures: number
    retryEligible: number
    failureTypes: Record<string, number>
  }
  budget?: {
    totalAlerts: number
    criticalAlerts: number
    warningAlerts: number
    emailUsagePercent: number
    smsUsagePercent: number
  }
  thresholds: {
    dlqWarning: number
    dlqCritical: number
    budgetWarning: number
    budgetCritical: number
    responseTimeWarning: number
    responseTimeCritical: number
  }
}

export async function handler(event: NetlifyEvent, context: Context) {
  return withMonitoring(async (event, context, monitoring) => {
    const { logger, correlationId } = monitoring

    // Validate method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405, correlationId)
    }

    // Validate JWT token for security
    try {
      const auth = validateJWT(event)
      logger.info('Authenticated metrics request', {
        action: 'metrics-request',
        userId: auth.userId,
        role: auth.role
      })
    } catch (error) {
      logger.warn('Unauthorized metrics request attempt', error as Error, {
        action: 'metrics-unauthorized'
      })
      return createErrorResponse('Unauthorized', 401, correlationId)
    }

    const metricsResponse: MetricsResponse = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: getMemoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production'
      },
      alerts: alertManager.getAlertStats(),
      thresholds: {
        dlqWarning: parseInt(process.env.VITE_MONITORING_DLQ_WARNING || '5'),
        dlqCritical: parseInt(process.env.VITE_MONITORING_DLQ_CRITICAL || '20'),
        budgetWarning: 80,
        budgetCritical: 100,
        responseTimeWarning: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_WARNING || '2000'),
        responseTimeCritical: parseInt(process.env.VITE_MONITORING_RESPONSE_TIME_CRITICAL || '5000')
      }
    }

    try {
      // Get queue metrics if available
      try {
        const { DeadLetterQueueService } = await import('../../src/lib/notifications/dlq-service')
        const dlqService = new DeadLetterQueueService(supabaseUrl, supabaseServiceKey)
        const dlqStats = await dlqService.getDLQStats()
        
        metricsResponse.queue = {
          totalItems: dlqStats.totalItems,
          recentFailures: dlqStats.recentFailures,
          retryEligible: dlqStats.retryEligible,
          failureTypes: dlqStats.byFailureType
        }
      } catch (error) {
        logger.warn('Failed to get queue metrics', error as Error, {
          action: 'queue-metrics-failed'
        })
      }

      // Get budget metrics if available
      try {
        const { NotificationSettingsService } = await import('../../src/lib/notifications/settings-service')
        const settingsService = new NotificationSettingsService(supabaseUrl, supabaseServiceKey)
        
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth() + 1

        const budgetAlerts = await settingsService.getBudgetAlerts('global')
        const budgetTracking = await settingsService.getBudgetTracking('global', undefined, currentYear, currentMonth)
        
        const criticalAlerts = budgetAlerts.filter(a => a.type === 'limit_reached')
        const warningAlerts = budgetAlerts.filter(a => a.type === 'warning')

        metricsResponse.budget = {
          totalAlerts: budgetAlerts.length,
          criticalAlerts: criticalAlerts.length,
          warningAlerts: warningAlerts.length,
          emailUsagePercent: budgetTracking?.emailBudgetUsedPct || 0,
          smsUsagePercent: budgetTracking?.smsBudgetUsedPct || 0
        }
      } catch (error) {
        logger.warn('Failed to get budget metrics', error as Error, {
          action: 'budget-metrics-failed'
        })
      }

      logger.info('Metrics retrieved successfully', {
        action: 'metrics-success',
        metadata: {
          hasQueueMetrics: !!metricsResponse.queue,
          hasBudgetMetrics: !!metricsResponse.budget,
          alertCount: metricsResponse.alerts.totalAlerts
        }
      })

      return createSuccessResponse(metricsResponse)

    } catch (error) {
      logger.error('Failed to retrieve metrics', error as Error, {
        action: 'metrics-failed'
      })

      return createErrorResponse(
        'Failed to retrieve metrics',
        500,
        correlationId
      )
    }
  }, {
    enableLogging: true,
    enableErrorTracking: true,
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