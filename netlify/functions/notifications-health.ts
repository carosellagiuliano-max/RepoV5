import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { NotificationSettingsService } from '../../src/lib/notifications/settings-service'

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

export async function handler(event: NetlifyEvent, context: Context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const settingsService = new NotificationSettingsService(supabaseUrl, supabaseServiceKey)
    
    // Perform comprehensive health check
    const healthStatus = await settingsService.performHealthCheck()
    
    // Determine HTTP status code based on health
    let statusCode = 200
    if (healthStatus.overall === 'warning') {
      statusCode = 200 // Still OK, but with warnings
    } else if (healthStatus.overall === 'error') {
      statusCode = 503 // Service unavailable
    }

    // Add additional system metrics
    const metrics = await getSystemMetrics(settingsService)
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        status: healthStatus.overall,
        timestamp: new Date().toISOString(),
        checks: healthStatus.checks,
        metrics,
        version: process.env.VITE_APP_VERSION || '1.0.0'
      })
    }

  } catch (error) {
    console.error('Health check error:', error)
    
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function getSystemMetrics(settingsService: NotificationSettingsService) {
  try {
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    // Get current month's budget tracking
    const budgetTracking = await settingsService.getBudgetTracking('global', undefined, currentYear, currentMonth)
    
    // Get budget alerts
    const budgetAlerts = await settingsService.getBudgetAlerts('global')
    
    // Get cost tracking for current month
    const costTracking = await settingsService.getCostTracking(currentYear, currentMonth, 10)
    
    return {
      budget: {
        currentMonth: {
          emailsSent: budgetTracking?.emailCount || 0,
          smsSent: budgetTracking?.smsCount || 0,
          emailCostCents: budgetTracking?.emailCostCents || 0,
          smsCostCents: budgetTracking?.smsCostCents || 0,
          emailUsagePercent: budgetTracking?.emailBudgetUsedPct || 0,
          smsUsagePercent: budgetTracking?.smsBudgetUsedPct || 0
        },
        alerts: budgetAlerts.length,
        criticalAlerts: budgetAlerts.filter(a => a.type === 'limit_reached').length
      },
      costs: {
        totalTransactions: costTracking.length,
        totalCostCents: costTracking.reduce((sum, c) => sum + c.costCents, 0),
        averageCostCents: costTracking.length > 0 
          ? Math.round(costTracking.reduce((sum, c) => sum + c.costCents, 0) / costTracking.length)
          : 0
      },
      system: {
        timezone: 'Europe/Zurich',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'unknown'
      }
    }
  } catch (error) {
    console.error('Error getting system metrics:', error)
    return {
      budget: null,
      costs: null,
      system: {
        timezone: 'Europe/Zurich',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'unknown'
      },
      error: 'Failed to retrieve metrics'
    }
  }
}