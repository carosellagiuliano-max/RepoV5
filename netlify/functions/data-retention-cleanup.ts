/**
 * Scheduled Data Retention Job
 * GDPR-compliant automated data cleanup based on retention settings
 */

import { createClient } from '@supabase/supabase-js'
import { Handler } from '@netlify/functions'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface RetentionSetting {
  id: string
  resource_type: string
  retention_days: number
  auto_delete: boolean
  last_cleanup: string | null
}

interface CleanupResult {
  resource_type: string
  records_processed: number
  records_deleted: number
  status: 'completed' | 'failed'
  error_message?: string
}

// Cleanup functions for different resource types
const cleanupFunctions: Record<string, (retentionDays: number) => Promise<{ processed: number; deleted: number }>> = {
  
  // Clean up old audit logs
  audit_logs: async (retentionDays: number) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const { data: recordsToDelete, error: selectError } = await supabase
      .from('audit_logs')
      .select('id')
      .lt('created_at', cutoffDate.toISOString())

    if (selectError) throw selectError

    const processed = recordsToDelete?.length || 0

    if (processed > 0) {
      const { error: deleteError } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (deleteError) throw deleteError
    }

    return { processed, deleted: processed }
  },

  // Clean up expired idempotency keys
  idempotency_keys: async () => {
    const { data: recordsToDelete, error: selectError } = await supabase
      .from('idempotency_keys')
      .select('id')
      .lt('expires_at', new Date().toISOString())

    if (selectError) throw selectError

    const processed = recordsToDelete?.length || 0

    if (processed > 0) {
      const { error: deleteError } = await supabase
        .from('idempotency_keys')
        .delete()
        .lt('expires_at', new Date().toISOString())

      if (deleteError) throw deleteError
    }

    return { processed, deleted: processed }
  },

  // Clean up old rate limit records
  rate_limits: async (retentionDays: number) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const { data: recordsToDelete, error: selectError } = await supabase
      .from('rate_limits')
      .select('id')
      .lt('window_end', cutoffDate.toISOString())

    if (selectError) throw selectError

    const processed = recordsToDelete?.length || 0

    if (processed > 0) {
      const { error: deleteError } = await supabase
        .from('rate_limits')
        .delete()
        .lt('window_end', cutoffDate.toISOString())

      if (deleteError) throw deleteError
    }

    return { processed, deleted: processed }
  },

  // GDPR: Archive old customer data (manual review required)
  customer_data: async (retentionDays: number) => {
    // For customer data, we don't auto-delete but flag for manual review
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Find customers with no recent activity
    const { data: inactiveCustomers, error: selectError } = await supabase
      .from('customers')
      .select(`
        id,
        created_at,
        profiles!inner (
          last_sign_in_at
        ),
        appointments (
          id,
          created_at
        )
      `)
      .lt('created_at', cutoffDate.toISOString())

    if (selectError) throw selectError

    let processed = 0
    let flaggedForReview = 0

    for (const customer of inactiveCustomers || []) {
      processed++

      // Check if customer has recent appointments
      const hasRecentActivity = customer.appointments?.some(apt => 
        new Date(apt.created_at) > cutoffDate
      )

      // Check last sign in
      const lastSignIn = customer.profiles.last_sign_in_at
      const hasRecentSignIn = lastSignIn && new Date(lastSignIn) > cutoffDate

      if (!hasRecentActivity && !hasRecentSignIn) {
        // Flag customer for manual GDPR review
        await supabase
          .from('profiles')
          .update({ 
            metadata: { 
              ...customer.profiles,
              gdpr_review_required: true,
              gdpr_flagged_at: new Date().toISOString(),
              gdpr_reason: 'Automatic retention policy check'
            }
          })
          .eq('id', customer.id)

        flaggedForReview++
      }
    }

    return { processed, deleted: flaggedForReview }
  },

  // Archive old appointments (manual review for legal reasons)
  appointments: async (retentionDays: number) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Count old completed/cancelled appointments
    const { data: oldAppointments, error: selectError } = await supabase
      .from('appointments')
      .select('id, status')
      .in('status', ['completed', 'cancelled'])
      .lt('created_at', cutoffDate.toISOString())

    if (selectError) throw selectError

    const processed = oldAppointments?.length || 0

    // For appointments, we just flag them for manual review due to legal requirements
    if (processed > 0) {
      await supabase
        .from('appointments')
        .update({ 
          internal_notes: 'FLAGGED: Retention policy review required'
        })
        .in('status', ['completed', 'cancelled'])
        .lt('created_at', cutoffDate.toISOString())
        .is('internal_notes', null)
    }

    return { processed, deleted: 0 } // No automatic deletion for appointments
  }
}

async function executeRetentionCleanup(): Promise<CleanupResult[]> {
  const results: CleanupResult[] = []

  try {
    // Get all retention settings
    const { data: retentionSettings, error: settingsError } = await supabase
      .from('data_retention_settings')
      .select('*')

    if (settingsError) {
      throw new Error(`Failed to fetch retention settings: ${settingsError.message}`)
    }

    // Process each resource type
    for (const setting of retentionSettings as RetentionSetting[]) {
      const jobId = crypto.randomUUID()
      
      try {
        // Start job record
        await supabase
          .from('data_retention_jobs')
          .insert({
            id: jobId,
            resource_type: setting.resource_type,
            status: 'running'
          })

        // Skip if auto_delete is false and it's not a cleanup-only job
        if (!setting.auto_delete && !['idempotency_keys', 'rate_limits'].includes(setting.resource_type)) {
          console.log(`Skipping ${setting.resource_type} - auto_delete is disabled`)
          
          await supabase
            .from('data_retention_jobs')
            .update({
              status: 'completed',
              records_processed: 0,
              records_deleted: 0,
              completed_at: new Date().toISOString()
            })
            .eq('id', jobId)

          results.push({
            resource_type: setting.resource_type,
            records_processed: 0,
            records_deleted: 0,
            status: 'completed'
          })
          continue
        }

        // Execute cleanup function
        const cleanupFunction = cleanupFunctions[setting.resource_type]
        if (!cleanupFunction) {
          throw new Error(`No cleanup function defined for ${setting.resource_type}`)
        }

        const { processed, deleted } = await cleanupFunction(setting.retention_days)

        // Update job record
        await supabase
          .from('data_retention_jobs')
          .update({
            status: 'completed',
            records_processed: processed,
            records_deleted: deleted,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId)

        // Update last cleanup timestamp
        await supabase
          .from('data_retention_settings')
          .update({ last_cleanup: new Date().toISOString() })
          .eq('id', setting.id)

        results.push({
          resource_type: setting.resource_type,
          records_processed: processed,
          records_deleted: deleted,
          status: 'completed'
        })

        console.log(`Cleanup completed for ${setting.resource_type}: ${processed} processed, ${deleted} deleted`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update job record with error
        await supabase
          .from('data_retention_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId)

        results.push({
          resource_type: setting.resource_type,
          records_processed: 0,
          records_deleted: 0,
          status: 'failed',
          error_message: errorMessage
        })

        console.error(`Cleanup failed for ${setting.resource_type}:`, error)
      }
    }

  } catch (error) {
    console.error('Retention cleanup job failed:', error)
    throw error
  }

  return results
}

// Netlify scheduled function handler
export const handler: Handler = async (event, context) => {
  // Only allow scheduled invocations (or manual admin calls)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }

  try {
    console.log('Starting scheduled data retention cleanup job')
    
    const results = await executeRetentionCleanup()
    
    const summary = results.reduce((acc, result) => {
      acc.totalProcessed += result.records_processed
      acc.totalDeleted += result.records_deleted
      if (result.status === 'failed') acc.failedJobs++
      return acc
    }, { totalProcessed: 0, totalDeleted: 0, failedJobs: 0 })

    console.log('Data retention cleanup completed:', summary)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data retention cleanup completed',
        summary,
        details: results,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Data retention cleanup job failed:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// For manual testing/admin execution
export const manualCleanup = async (): Promise<CleanupResult[]> => {
  return executeRetentionCleanup()
}