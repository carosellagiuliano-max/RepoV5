import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { DeadLetterQueueService } from '../../src/lib/notifications/dlq-service'
import { NotificationSettingsService } from '../../src/lib/notifications/settings-service'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body: string
  path: string
}

export async function handler(event: NetlifyEvent, context: Context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  try {
    // Verify admin access
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify JWT and check role
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid authorization' })
      }
    }

    // Check if user is admin/staff
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'staff'].includes(profile.role)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Admin access required' })
      }
    }

    // Route based on path and method
    const dlqService = new DeadLetterQueueService(supabaseUrl, supabaseServiceKey)
    const settingsService = new NotificationSettingsService(supabaseUrl, supabaseServiceKey)

    // Parse path to determine the operation
    const pathParts = event.path.split('/').filter(p => p)
    const resource = pathParts[pathParts.length - 1] // notifications-admin

    const action = event.queryStringParameters?.action
    const method = event.httpMethod

    if (method === 'GET') {
      return await handleGetRequest(action, event.queryStringParameters, dlqService, settingsService, corsHeaders)
    } else if (method === 'POST') {
      return await handlePostRequest(action, JSON.parse(event.body || '{}'), dlqService, settingsService, corsHeaders, user.id)
    } else if (method === 'PUT') {
      return await handlePutRequest(action, JSON.parse(event.body || '{}'), dlqService, settingsService, corsHeaders, user.id)
    } else if (method === 'DELETE') {
      return await handleDeleteRequest(action, event.queryStringParameters, dlqService, settingsService, corsHeaders, user.id)
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Admin API error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleGetRequest(
  action: string | undefined,
  params: Record<string, string> | undefined,
  dlqService: DeadLetterQueueService,
  settingsService: NotificationSettingsService,
  corsHeaders: Record<string, string>
) {
  switch (action) {
    case 'dlq-stats':
      const dlqStats = await dlqService.getDLQStats()
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: dlqStats })
      }

    case 'dlq-items':
      const filters = {
        failureType: params?.failureType,
        notificationChannel: params?.notificationChannel,
        resolved: params?.resolved ? params.resolved === 'true' : undefined,
        retryEligible: params?.retryEligible ? params.retryEligible === 'true' : undefined
      }
      const limit = parseInt(params?.limit || '50')
      const offset = parseInt(params?.offset || '0')
      
      const dlqItems = await dlqService.getDLQItems(filters, limit, offset)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: dlqItems })
      }

    case 'budget-tracking':
      const scope = (params?.scope as any) || 'global'
      const scopeId = params?.scopeId
      const year = parseInt(params?.year || new Date().getFullYear().toString())
      const month = parseInt(params?.month || (new Date().getMonth() + 1).toString())
      
      const budgetTracking = await settingsService.getBudgetTracking(scope, scopeId, year, month)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: budgetTracking })
      }

    case 'budget-alerts':
      const alertScope = (params?.scope as any) || 'global'
      const alertScopeId = params?.scopeId
      
      const budgetAlerts = await settingsService.getBudgetAlerts(alertScope, alertScopeId)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: budgetAlerts })
      }

    case 'webhook-events':
      const webhookFilters = {
        provider: params?.provider,
        eventType: params?.eventType,
        processed: params?.processed ? params.processed === 'true' : undefined,
        notificationId: params?.notificationId
      }
      const webhookLimit = parseInt(params?.limit || '50')
      const webhookOffset = parseInt(params?.offset || '0')
      
      const webhookEvents = await dlqService.getWebhookEvents(webhookFilters, webhookLimit, webhookOffset)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: webhookEvents })
      }

    case 'cost-tracking':
      const costYear = parseInt(params?.year || new Date().getFullYear().toString())
      const costMonth = parseInt(params?.month || (new Date().getMonth() + 1).toString())
      const costLimit = parseInt(params?.limit || '100')
      const costOffset = parseInt(params?.offset || '0')
      
      const costTracking = await settingsService.getCostTracking(costYear, costMonth, costLimit, costOffset)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: costTracking })
      }

    default:
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid action parameter' })
      }
  }
}

async function handlePostRequest(
  action: string | undefined,
  body: any,
  dlqService: DeadLetterQueueService,
  settingsService: NotificationSettingsService,
  corsHeaders: Record<string, string>,
  userId: string
) {
  switch (action) {
    case 'retry-dlq-item':
      const { dlqId, updateRecipient, notes } = body
      if (!dlqId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'dlqId is required' })
        }
      }
      
      const retryResult = await dlqService.retryDLQItem(dlqId, {
        updateRecipient,
        notes,
        retryBy: userId
      })
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: retryResult.success, data: retryResult })
      }

    case 'resolve-dlq-item':
      const { dlqId: resolveDlqId, resolution } = body
      if (!resolveDlqId || !resolution) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'dlqId and resolution are required' })
        }
      }
      
      const resolveResult = await dlqService.resolveDLQItem(resolveDlqId, {
        ...resolution,
        resolvedBy: userId
      })
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: resolveResult.success, data: resolveResult })
      }

    case 'reprocess-webhook':
      const { eventId } = body
      if (!eventId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'eventId is required' })
        }
      }
      
      const reprocessResult = await dlqService.reprocessWebhookEvent(eventId)
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: reprocessResult.success, data: reprocessResult })
      }

    default:
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid action parameter' })
      }
  }
}

async function handlePutRequest(
  action: string | undefined,
  body: any,
  dlqService: DeadLetterQueueService,
  settingsService: NotificationSettingsService,
  corsHeaders: Record<string, string>,
  userId: string
) {
  switch (action) {
    case 'notification-settings':
      const { scope, scopeId, settings } = body
      if (!scope || !settings) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'scope and settings are required' })
        }
      }
      
      const updateResult = await settingsService.updateSettings(settings, scope, scopeId, userId)
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: !!updateResult, data: updateResult })
      }

    case 'retry-config':
      const { retryScope, retryConfig, scopeValue } = body
      if (!retryScope || !retryConfig) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'retryScope and retryConfig are required' })
        }
      }
      
      const retryConfigResult = await dlqService.updateRetryConfig(retryScope, retryConfig, scopeValue, userId)
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: !!retryConfigResult, data: retryConfigResult })
      }

    default:
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid action parameter' })
      }
  }
}

async function handleDeleteRequest(
  action: string | undefined,
  params: Record<string, string> | undefined,
  dlqService: DeadLetterQueueService,
  settingsService: NotificationSettingsService,
  corsHeaders: Record<string, string>,
  userId: string
) {
  switch (action) {
    case 'cleanup-dlq':
      const olderThanDays = parseInt(params?.olderThanDays || '30')
      
      const cleanupResult = await dlqService.cleanupResolvedItems(olderThanDays)
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data: cleanupResult })
      }

    default:
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid action parameter' })
      }
  }
}