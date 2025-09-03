/**
 * Scheduled Data Retention Job
 * Runs daily to execute data retention policies with dry-run and monitoring
 */

import { Handler } from '@netlify/functions'
import { DataRetentionService } from '../../src/lib/security/data-retention'
import { cleanupExpiredIdempotencyKeys } from '../../src/lib/security/idempotency'
import { cleanupExpiredRateLimits } from '../../src/lib/security/rate-limiter'

const cronSecret = process.env.NETLIFY_CRON_SECRET!
// By default, run in dry-run mode unless DATA_RETENTION_EXECUTE_REAL_DELETIONS is set to 'true'
const isDryRun = String(process.env.DATA_RETENTION_EXECUTE_REAL_DELETIONS).toLowerCase() !== 'true'

if (!cronSecret) {
  throw new Error('Missing NETLIFY_CRON_SECRET environment variable')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

export const handler: Handler = async (event, context) => {
  console.log('Data retention job started', {
    timestamp: new Date().toISOString(),
    isDryRun,
    functionVersion: context.awsRequestId
  })

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'OK' })
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Verify cron secret for security
    const authHeader = event.headers.authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized retention job attempt', {
        authHeader: authHeader ? 'present' : 'missing',
        ip: event.headers['x-forwarded-for']
      })
      
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' })
      }
    }

    const startTime = Date.now()
    const retentionService = new DataRetentionService()
    
    console.log('Starting data retention execution', { isDryRun })
    
    // 1. Execute retention policies
    const retentionResults = await retentionService.executeAllPolicies(isDryRun)
    
    // 2. Clean up expired idempotency keys
    const cleanedIdempotencyKeys = await cleanupExpiredIdempotencyKeys()
    
    // 3. Clean up expired rate limit records
    const cleanedRateLimits = cleanupExpiredRateLimits()
    
    // 4. Prepare execution summary
    const executionSummary = {
      timestamp: new Date().toISOString(),
      executionType: isDryRun ? 'dry_run' : 'execute',
      duration: Date.now() - startTime,
      retentionPolicies: Object.keys(retentionResults).length,
      cleanedIdempotencyKeys,
      cleanedRateLimits,
      results: retentionResults
    }
    
    // 5. Log results
    if (isDryRun) {
      console.log('Data retention dry run completed', executionSummary)
      
      // Log detailed dry run results
      for (const [resourceType, result] of Object.entries(retentionResults)) {
        if ('resourceCount' in result) {
          console.log(`Dry run result for ${resourceType}:`, {
            recordsToDelete: result.resourceCount,
            oldestRecord: result.oldestRecord,
            estimatedTime: result.estimatedExecutionTime
          })
        }
      }
    } else {
      console.log('Data retention execution completed', executionSummary)
      
      // Log actual execution results
      for (const [resourceType, result] of Object.entries(retentionResults)) {
        if ('recordsDeleted' in result) {
          console.log(`Execution result for ${resourceType}:`, {
            recordsArchived: result.recordsArchived,
            recordsDeleted: result.recordsDeleted,
            status: result.status
          })
        }
      }
    }
    
    // 6. Send alerts if needed
    await sendAlertsIfNeeded(executionSummary, isDryRun)
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        summary: executionSummary
      })
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      isDryRun
    }
    
    console.error('Data retention job failed', errorDetails)
    
    // Send error alert
    await sendErrorAlert(errorDetails)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Data retention job failed',
        details: isDryRun ? errorDetails : { message: errorMessage }
      })
    }
  }
}

/**
 * Send alerts based on retention execution results
 */
async function sendAlertsIfNeeded(
  summary: Record<string, unknown>, 
  isDryRun: boolean
): Promise<void> {
  try {
    // Alert conditions
    const shouldAlert = (
      summary.duration as number > 300000 || // > 5 minutes
      Object.values(summary.results as Record<string, Record<string, unknown>>).some(result => 
        'error' in result || ('resourceCount' in result && typeof result.resourceCount === 'number' && result.resourceCount > 10000)
      )
    )
    
    if (!shouldAlert) {
      return
    }
    
    console.warn('Data retention alert triggered', {
      reason: 'Long execution time or large dataset',
      summary
    })
    
    // In a production environment, you would send this to your alerting system
    // For now, we'll just log it
    console.log('ALERT: Data retention requires attention', {
      type: isDryRun ? 'dry_run_alert' : 'execution_alert',
      summary
    })
    
  } catch (error) {
    console.error('Failed to send retention alerts', error)
  }
}

/**
 * Send error alert
 */
async function sendErrorAlert(errorDetails: Record<string, unknown>): Promise<void> {
  try {
    console.error('CRITICAL ALERT: Data retention job failed', errorDetails)
    
    // In a production environment, you would send this to your alerting system
    // This could be integrated with PagerDuty, Slack, email notifications, etc.
    
  } catch (error) {
    console.error('Failed to send error alert', error)
  }
}

// For scheduled execution, you would configure this in netlify.toml:
/*
[[plugins]]
package = "@netlify/plugin-functions-install-core"

[build]
functions = "netlify/functions"

# Schedule in netlify.toml (example):
# This function should be called daily at 2 AM UTC
# You would set up a cron job or use Netlify's scheduled functions feature
*/