/**
 * Enhanced Admin Audit System
 * Provides comprehensive audit logging with before/after diff tracking
 */

import { createAdminClient } from '../auth/netlify-auth'
import { AuthenticatedUser } from '../auth/netlify-auth'
import { HandlerEvent } from '@netlify/functions'

export interface AuditContext {
  user: AuthenticatedUser
  event: HandlerEvent
  correlationId?: string
}

export interface AuditAction {
  actionType: string
  resourceType: string
  resourceId: string
  beforeData?: unknown
  afterData?: unknown
  reason?: string
  metadata?: Record<string, unknown>
}

export interface AuditLog {
  id: string
  actionType: string
  resourceType: string
  resourceId: string
  adminId: string
  adminEmail: string
  actionData: Record<string, unknown>
  beforeData?: unknown
  afterData?: unknown
  diffData?: unknown
  reason?: string
  success: boolean
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  correlationId?: string
  createdAt: string
}

/**
 * Create comprehensive audit log entry
 */
export async function createAuditLog(
  context: AuditContext,
  action: AuditAction,
  success: boolean,
  error?: Error | string
): Promise<void> {
  try {
    const supabase = createAdminClient()
    
    // Extract IP and user agent from event
    const ipAddress = context.event.headers['x-forwarded-for'] || 
                     context.event.headers['x-real-ip'] || 
                     context.event.headers['cf-connecting-ip']
    const userAgent = context.event.headers['user-agent']
    const sessionId = context.event.headers['x-session-id']
    
    // Calculate diff if both before and after data exist
    let diffData: unknown = null
    if (action.beforeData && action.afterData) {
      diffData = calculateDiff(action.beforeData, action.afterData)
    }
    
    // Prepare audit data
    const auditEntry = {
      action_type: action.actionType,
      resource_type: action.resourceType,
      resource_id: action.resourceId,
      admin_id: context.user.id,
      admin_email: context.user.email,
      action_data: {
        endpoint: getEndpointFromEvent(context.event),
        method: context.event.httpMethod,
        timestamp: new Date().toISOString(),
        ...action.metadata
      },
      before_data: action.beforeData,
      after_data: action.afterData,
      diff_data: diffData,
      reason: action.reason,
      success,
      error_message: error ? (typeof error === 'string' ? error : error.message) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      session_id: sessionId,
      correlation_id: context.correlationId
    }
    
    const { error: insertError } = await supabase
      .from('admin_audit')
      .insert(auditEntry)
      
    if (insertError) {
      console.error('Failed to create audit log:', insertError)
    }
  } catch (error) {
    console.error('Error in createAuditLog:', error)
    // Don't throw to avoid breaking the main operation
  }
}

/**
 * Audit wrapper for admin operations
 */
export function withAudit<T>(
  operation: (context: AuditContext) => Promise<T>,
  auditAction: AuditAction | ((result: T) => AuditAction)
) {
  return async (context: AuditContext): Promise<T> => {
    let result: T
    let success = false
    let error: Error | undefined
    
    try {
      // Get before data if resource exists
      let beforeData: unknown = null
      if (auditAction && typeof auditAction === 'object' && auditAction.resourceId) {
        beforeData = await getResourceData(auditAction.resourceType, auditAction.resourceId)
      }
      
      // Execute the operation
      result = await operation(context)
      success = true
      
      // Get after data
      let afterData: unknown = null
      const finalAction = typeof auditAction === 'function' ? auditAction(result) : auditAction
      
      if (finalAction.resourceId) {
        afterData = await getResourceData(finalAction.resourceType, finalAction.resourceId)
      }
      
      // Create audit log with before/after data
      await createAuditLog(
        context,
        {
          ...finalAction,
          beforeData,
          afterData
        },
        success
      )
      
      return result
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
      success = false
      
      // Create audit log for failed operation
      const finalAction = typeof auditAction === 'function' ? 
        { actionType: 'unknown', resourceType: 'unknown', resourceId: 'unknown' } : 
        auditAction
      
      await createAuditLog(context, finalAction, success, error)
      throw error
    }
  }
}

/**
 * Get resource data for audit comparison
 */
async function getResourceData(resourceType: string, resourceId: string): Promise<unknown> {
  try {
    const supabase = createAdminClient()
    
    // Map resource types to their table names
    const tableMap: Record<string, string> = {
      'appointment': 'appointments',
      'customer': 'customers',
      'staff': 'staff',
      'service': 'services',
      'payment': 'payments',
      'setting': 'business_settings',
      'user': 'profiles',
      'media': 'media_files'
    }
    
    const tableName = tableMap[resourceType.toLowerCase()]
    if (!tableName) {
      return null
    }
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', resourceId)
      .single()
      
    if (error) {
      console.warn(`Could not fetch ${resourceType} ${resourceId} for audit:`, error.message)
      return null
    }
    
    return data
  } catch (error) {
    console.warn(`Error fetching resource data for audit:`, error)
    return null
  }
}

/**
 * Calculate diff between before and after data
 */
function calculateDiff(before: unknown, after: unknown): unknown {
  if (typeof before !== 'object' || typeof after !== 'object' || !before || !after) {
    return { before, after }
  }
  
  const diff: Record<string, unknown> = {}
  const beforeObj = before as Record<string, unknown>
  const afterObj = after as Record<string, unknown>
  
  // Find changed fields
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])
  
  for (const key of allKeys) {
    const beforeValue = beforeObj[key]
    const afterValue = afterObj[key]
    
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = {
        before: beforeValue,
        after: afterValue
      }
    }
  }
  
  return diff
}

/**
 * Extract endpoint from Netlify event
 */
function getEndpointFromEvent(event: HandlerEvent): string {
  // Extract endpoint from path or function name
  const path = event.path || ''
  const functionMatch = path.match(/\/\.netlify\/functions\/(.+)$/)
  
  if (functionMatch) {
    return `/${functionMatch[1]}`
  }
  
  return path
}

/**
 * Audit specific operations
 */
export const AuditOperations = {
  // Settings operations
  async settingsUpdate(context: AuditContext, settingKey: string, oldValue: unknown, newValue: unknown, reason?: string) {
    await createAuditLog(context, {
      actionType: 'settings_update',
      resourceType: 'setting',
      resourceId: settingKey,
      beforeData: { key: settingKey, value: oldValue },
      afterData: { key: settingKey, value: newValue },
      reason,
      metadata: { settingKey }
    }, true)
  },
  
  // Customer operations
  async customerDelete(context: AuditContext, customerId: string, customerData: unknown, reason?: string) {
    await createAuditLog(context, {
      actionType: 'customer_delete',
      resourceType: 'customer',
      resourceId: customerId,
      beforeData: customerData,
      afterData: null,
      reason,
      metadata: { isGdprDeletion: true }
    }, true)
  },
  
  // Payment operations
  async paymentRefund(context: AuditContext, paymentId: string, amount: number, reason?: string) {
    await createAuditLog(context, {
      actionType: 'payment_refund',
      resourceType: 'payment',
      resourceId: paymentId,
      reason,
      metadata: { refundAmount: amount }
    }, true)
  },
  
  async paymentCapture(context: AuditContext, paymentId: string, amount: number) {
    await createAuditLog(context, {
      actionType: 'payment_capture',
      resourceType: 'payment',
      resourceId: paymentId,
      metadata: { captureAmount: amount }
    }, true)
  },
  
  // Data access operations (GDPR compliance)
  async dataAccess(context: AuditContext, resourceType: string, resourceId: string, accessType: 'read' | 'export') {
    await createAuditLog(context, {
      actionType: `data_${accessType}`,
      resourceType,
      resourceId,
      metadata: { accessType, gdprAccess: true }
    }, true)
  }
}

/**
 * Get audit trail for a resource
 */
export async function getAuditTrail(
  resourceType: string, 
  resourceId: string, 
  limit: number = 100
): Promise<AuditLog[]> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('admin_audit')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit)
      
    if (error) {
      console.error('Error fetching audit trail:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getAuditTrail:', error)
    return []
  }
}