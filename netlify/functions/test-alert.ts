/**
 * Alert Simulation Test Function
 * 
 * Creates a test endpoint to verify alert system functionality
 */

import { Context } from '@netlify/functions'
import { withMonitoring, NetlifyEvent, createSuccessResponse, createErrorResponse, validateJWT } from '../../src/lib/monitoring/middleware'
import { simulateAlert } from '../../src/lib/monitoring/alerts'

export async function handler(event: NetlifyEvent, context: Context) {
  return withMonitoring(async (event, context, monitoring) => {
    const { logger, correlationId } = monitoring

    // Validate method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse('Method not allowed', 405, correlationId)
    }

    // Validate JWT token for security
    try {
      const auth = validateJWT(event)
      logger.info('Authenticated alert test request', {
        action: 'alert-test-request',
        userId: auth.userId,
        role: auth.role
      })
    } catch (error) {
      logger.warn('Unauthorized alert test request', error as Error, {
        action: 'alert-test-unauthorized'
      })
      return createErrorResponse('Unauthorized', 401, correlationId)
    }

    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const severity = body.severity || 'medium'

      // Validate severity
      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        return createErrorResponse('Invalid severity level', 400, correlationId)
      }

      logger.info('Simulating alert', {
        action: 'alert-simulation',
        metadata: { severity }
      })

      // Simulate the alert
      const testCorrelationId = await simulateAlert(severity)

      logger.info('Alert simulation completed', {
        action: 'alert-simulation-complete',
        metadata: { 
          severity,
          testCorrelationId
        }
      })

      return createSuccessResponse({
        message: `Alert simulation completed for severity: ${severity}`,
        testCorrelationId,
        severity,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Alert simulation failed', error as Error, {
        action: 'alert-simulation-failed'
      })

      return createErrorResponse(
        'Alert simulation failed',
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