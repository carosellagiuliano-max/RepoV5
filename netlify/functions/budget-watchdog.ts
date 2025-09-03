import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
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
}

interface BudgetAlert {
  scope: string
  scopeId?: string
  type: 'email' | 'sms'
  currentUsage: number
  limit: number
  usagePercentage: number
  alertType: 'warning' | 'limit_reached'
  behavior: 'skip' | 'delay'
}

export async function handler(event: NetlifyEvent, context: Context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  // This function can be triggered manually via POST or by scheduled job
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('Starting budget watchdog check...')
    
    const result = await runBudgetWatchdog()
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Budget watchdog completed successfully',
        timestamp: new Date().toISOString(),
        result
      })
    }

  } catch (error) {
    console.error('Budget watchdog error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Budget watchdog failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

async function runBudgetWatchdog(): Promise<{
  scopesChecked: number
  alertsGenerated: number
  warningsTriggered: number
  capsTriggered: number
  details: any[]
}> {
  const settingsService = new NotificationSettingsService(supabaseUrl, supabaseServiceKey)
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  let scopesChecked = 0
  let alertsGenerated = 0
  let warningsTriggered = 0
  let capsTriggered = 0
  const details: any[] = []

  // Get all notification settings to check different scopes
  const { data: allSettings, error: settingsError } = await supabase
    .from('notification_settings')
    .select('scope, scope_id, monthly_email_limit, monthly_sms_limit, budget_warning_threshold, budget_hard_cap')
    .not('monthly_email_limit', 'is', null)
    .not('monthly_sms_limit', 'is', null)

  if (settingsError) {
    console.error('Error fetching settings:', settingsError)
    throw new Error(`Failed to fetch settings: ${settingsError.message}`)
  }

  // Also check global settings if no specific limits are set
  if (!allSettings || allSettings.length === 0) {
    console.log('No specific budget settings found, checking global defaults')
    allSettings.push({
      scope: 'global',
      scope_id: null,
      monthly_email_limit: null,
      monthly_sms_limit: null,
      budget_warning_threshold: 0.80,
      budget_hard_cap: true
    })
  }

  for (const settings of allSettings) {
    scopesChecked++
    
    try {
      // Get current budget tracking
      const budgetTracking = await settingsService.getBudgetTracking(
        settings.scope as any,
        settings.scope_id,
        currentYear,
        currentMonth
      )

      // Check email budget
      if (settings.monthly_email_limit && settings.monthly_email_limit > 0) {
        const emailUsage = budgetTracking?.emailCount || 0
        const emailUsagePercentage = (emailUsage / settings.monthly_email_limit) * 100
        const warningThreshold = (settings.budget_warning_threshold || 0.80) * 100

        const emailAlert = await checkBudgetThreshold(
          settings,
          'email',
          emailUsage,
          settings.monthly_email_limit,
          emailUsagePercentage,
          warningThreshold,
          budgetTracking?.warningSentAt
        )

        if (emailAlert) {
          alertsGenerated++
          if (emailAlert.alertType === 'warning') warningsTriggered++
          if (emailAlert.alertType === 'limit_reached') capsTriggered++
          details.push(emailAlert)
        }
      }

      // Check SMS budget
      if (settings.monthly_sms_limit && settings.monthly_sms_limit > 0) {
        const smsUsage = budgetTracking?.smsCount || 0
        const smsUsagePercentage = (smsUsage / settings.monthly_sms_limit) * 100
        const warningThreshold = (settings.budget_warning_threshold || 0.80) * 100

        const smsAlert = await checkBudgetThreshold(
          settings,
          'sms',
          smsUsage,
          settings.monthly_sms_limit,
          smsUsagePercentage,
          warningThreshold,
          budgetTracking?.warningSentAt
        )

        if (smsAlert) {
          alertsGenerated++
          if (smsAlert.alertType === 'warning') warningsTriggered++
          if (smsAlert.alertType === 'limit_reached') capsTriggered++
          details.push(smsAlert)
        }
      }

    } catch (error) {
      console.error(`Error checking budget for scope ${settings.scope}:${settings.scope_id}:`, error)
      details.push({
        scope: settings.scope,
        scopeId: settings.scope_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Log summary metrics
  console.log(`Budget watchdog completed: ${scopesChecked} scopes checked, ${alertsGenerated} alerts generated`)
  
  // Store metrics for monitoring
  await logBudgetWatchdogMetrics(scopesChecked, alertsGenerated, warningsTriggered, capsTriggered)

  return {
    scopesChecked,
    alertsGenerated,
    warningsTriggered,
    capsTriggered,
    details
  }
}

async function checkBudgetThreshold(
  settings: any,
  type: 'email' | 'sms',
  currentUsage: number,
  limit: number,
  usagePercentage: number,
  warningThreshold: number,
  lastWarningSent?: string
): Promise<BudgetAlert | null> {
  
  // Check if we've reached 100% (hard cap)
  if (usagePercentage >= 100) {
    await handleBudgetCapReached(settings, type, currentUsage, limit, usagePercentage)
    return {
      scope: settings.scope,
      scopeId: settings.scope_id,
      type,
      currentUsage,
      limit,
      usagePercentage,
      alertType: 'limit_reached',
      behavior: settings.budget_hard_cap ? 'skip' : 'delay'
    }
  }

  // Check if we've reached warning threshold (e.g., 80%)
  if (usagePercentage >= warningThreshold) {
    // Only send warning once per month or if it's been more than 24 hours
    const shouldSendWarning = !lastWarningSent || 
      (new Date().getTime() - new Date(lastWarningSent).getTime()) > 24 * 60 * 60 * 1000

    if (shouldSendWarning) {
      await handleBudgetWarning(settings, type, currentUsage, limit, usagePercentage)
      return {
        scope: settings.scope,
        scopeId: settings.scope_id,
        type,
        currentUsage,
        limit,
        usagePercentage,
        alertType: 'warning',
        behavior: 'continue'
      }
    }
  }

  return null
}

async function handleBudgetWarning(
  settings: any,
  type: 'email' | 'sms',
  currentUsage: number,
  limit: number,
  usagePercentage: number
): Promise<void> {
  console.log(`BUDGET WARNING: ${settings.scope}:${settings.scope_id} ${type} usage at ${usagePercentage.toFixed(1)}%`)

  try {
    // Update budget tracking to record warning sent
    await supabase
      .from('notification_budget_tracking')
      .update({
        warning_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('year', new Date().getFullYear())
      .eq('month', new Date().getMonth() + 1)
      .eq('scope', settings.scope)
      .eq('scope_id', settings.scope_id)

    // Send notification to admins (if configured)
    await sendBudgetAlert('warning', settings, type, currentUsage, limit, usagePercentage)

    // Log the event for metrics
    await logBudgetEvent('warning_triggered', settings.scope, settings.scope_id, type, usagePercentage)

  } catch (error) {
    console.error('Error handling budget warning:', error)
  }
}

async function handleBudgetCapReached(
  settings: any,
  type: 'email' | 'sms',
  currentUsage: number,
  limit: number,
  usagePercentage: number
): Promise<void> {
  console.log(`BUDGET CAP REACHED: ${settings.scope}:${settings.scope_id} ${type} usage at ${usagePercentage.toFixed(1)}%`)

  try {
    // Update budget tracking to record cap reached
    await supabase
      .from('notification_budget_tracking')
      .update({
        hard_cap_reached_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('year', new Date().getFullYear())
      .eq('month', new Date().getMonth() + 1)
      .eq('scope', settings.scope)
      .eq('scope_id', settings.scope_id)

    // Send critical notification to admins
    await sendBudgetAlert('limit_reached', settings, type, currentUsage, limit, usagePercentage)

    // Log the event for metrics
    await logBudgetEvent('cap_triggered', settings.scope, settings.scope_id, type, usagePercentage)

  } catch (error) {
    console.error('Error handling budget cap reached:', error)
  }
}

async function sendBudgetAlert(
  alertType: 'warning' | 'limit_reached',
  settings: any,
  type: 'email' | 'sms',
  currentUsage: number,
  limit: number,
  usagePercentage: number
): Promise<void> {
  // In a real implementation, this would send email/SMS to admin users
  // For now, we'll just log and could integrate with the notification system
  
  const severity = alertType === 'limit_reached' ? 'CRITICAL' : 'WARNING'
  const message = `${severity}: ${type.toUpperCase()} budget ${alertType.replace('_', ' ')} for ${settings.scope}${settings.scope_id ? ':' + settings.scope_id : ''}`
  
  console.log(`${message} - ${currentUsage}/${limit} (${usagePercentage.toFixed(1)}%)`)

  // Could queue an admin notification here:
  /*
  await supabase
    .from('notification_queue')
    .insert({
      type: 'email',
      channel: 'budget_alert',
      recipient_id: 'admin', // Would need to get actual admin IDs
      template_name: 'budget_alert',
      template_data: {
        alertType,
        settings,
        type,
        currentUsage,
        limit,
        usagePercentage
      },
      priority: alertType === 'limit_reached' ? 'high' : 'normal',
      scheduled_for: new Date().toISOString()
    })
  */
}

async function logBudgetEvent(
  eventType: string,
  scope: string,
  scopeId: string | null,
  notificationType: string,
  usagePercentage: number
): Promise<void> {
  try {
    await supabase
      .from('notification_audit')
      .insert({
        notification_id: null, // System event
        event_type: 'budget_' + eventType,
        details: {
          scope,
          scope_id: scopeId,
          notification_type: notificationType,
          usage_percentage: usagePercentage,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.error('Error logging budget event:', error)
  }
}

async function logBudgetWatchdogMetrics(
  scopesChecked: number,
  alertsGenerated: number,
  warningsTriggered: number,
  capsTriggered: number
): Promise<void> {
  try {
    await supabase
      .from('notification_audit')
      .insert({
        notification_id: null,
        event_type: 'budget_watchdog_run',
        details: {
          scopes_checked: scopesChecked,
          alerts_generated: alertsGenerated,
          warnings_triggered: warningsTriggered,
          caps_triggered: capsTriggered,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.error('Error logging watchdog metrics:', error)
  }
}