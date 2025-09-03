/**
 * Data Retention System
 * Handles GDPR-compliant data retention with dry-run and backout capabilities
 */

import { createAdminClient } from '../auth/netlify-auth'

export interface RetentionPolicy {
  id: string
  resourceType: string
  retentionDays: number
  isActive: boolean
  deletionCriteria: Record<string, unknown>
  archiveBeforeDelete: boolean
  archiveTableName?: string
  gdprCategory: string
  legalBasis: string
}

export interface RetentionExecution {
  id: string
  policyId: string
  executionType: 'dry_run' | 'execute' | 'rollback'
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  recordsIdentified: number
  recordsArchived: number
  recordsDeleted: number
  executionSummary: Record<string, unknown>
  dryRunResults?: Record<string, unknown>
}

export interface DryRunResult {
  resourceCount: number
  oldestRecord?: string
  sampleRecords: Record<string, unknown>[]
  affectedTables: string[]
  estimatedExecutionTime: number
}

/**
 * Data Retention Service
 */
export class DataRetentionService {
  private supabase = createAdminClient()
  
  /**
   * Get all active retention policies
   */
  async getActivePolicies(): Promise<RetentionPolicy[]> {
    const { data, error } = await this.supabase
      .from('data_retention_policies')
      .select('*')
      .eq('is_active', true)
      .order('resource_type')
    
    if (error) {
      throw new Error(`Failed to fetch retention policies: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Execute dry run for a specific policy
   */
  async executeDryRun(policyId: string): Promise<DryRunResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('execute_data_retention_dry_run', { p_policy_id: policyId })
        .single()
      
      if (error) {
        throw new Error(`Dry run failed: ${error.message}`)
      }
      
      // Parse the dry run results
      const result: DryRunResult = {
        resourceCount: data.resource_count || 0,
        oldestRecord: data.oldest_record,
        sampleRecords: this.parseSampleRecords(data.sample_records),
        affectedTables: this.getAffectedTables(data.sample_records),
        estimatedExecutionTime: this.estimateExecutionTime(data.resource_count)
      }
      
      console.log(`Dry run completed for policy ${policyId}:`, result)
      return result
    } catch (error) {
      console.error(`Dry run failed for policy ${policyId}:`, error)
      throw error
    }
  }
  
  /**
   * Execute retention policy (actual deletion)
   */
  async executeRetention(policyId: string, force: boolean = false): Promise<RetentionExecution> {
    const policy = await this.getPolicy(policyId)
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`)
    }
    
    if (!force) {
      // Require explicit confirmation for destructive operations
      throw new Error('Retention execution requires force=true flag for safety')
    }
    
    // Create execution record
    const executionId = await this.createExecutionRecord(policyId, 'execute')
    
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays)
      
      let recordsArchived = 0
      let recordsDeleted = 0
      
      // Archive data if required
      if (policy.archiveBeforeDelete && policy.archiveTableName) {
        recordsArchived = await this.archiveData(policy, cutoffDate)
      }
      
      // Delete data
      recordsDeleted = await this.deleteData(policy, cutoffDate)
      
      // Update execution record
      await this.updateExecutionRecord(executionId, {
        status: 'completed',
        recordsArchived,
        recordsDeleted,
        executionSummary: {
          cutoffDate: cutoffDate.toISOString(),
          archivingEnabled: policy.archiveBeforeDelete,
          deletionCriteria: policy.deletionCriteria
        }
      })
      
      return await this.getExecutionRecord(executionId)
    } catch (error) {
      await this.updateExecutionRecord(executionId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  /**
   * Execute all active retention policies
   */
  async executeAllPolicies(dryRun: boolean = true): Promise<Record<string, DryRunResult | RetentionExecution>> {
    const policies = await this.getActivePolicies()
    const results: Record<string, DryRunResult | RetentionExecution | { error: string }> = {}
    
    console.log(`Executing ${dryRun ? 'dry run' : 'retention'} for ${policies.length} policies`)
    
    for (const policy of policies) {
      try {
        if (dryRun) {
          results[policy.resourceType] = await this.executeDryRun(policy.id)
        } else {
          results[policy.resourceType] = await this.executeRetention(policy.id, true)
        }
      } catch (error) {
        console.error(`Failed to process policy ${policy.resourceType}:`, error)
        results[policy.resourceType] = {
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
    
    return results
  }
  
  /**
   * Get retention execution history
   */
  async getExecutionHistory(limit: number = 50): Promise<RetentionExecution[]> {
    const { data, error } = await this.supabase
      .from('data_retention_executions')
      .select(`
        *,
        data_retention_policies!inner(resource_type, retention_days)
      `)
      .order('started_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      throw new Error(`Failed to fetch execution history: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Create rollback capability for recent executions
   */
  async createRollback(executionId: string): Promise<string> {
    const execution = await this.getExecutionRecord(executionId)
    
    if (!execution || execution.executionType !== 'execute') {
      throw new Error('Can only rollback actual executions')
    }
    
    if (execution.status !== 'completed') {
      throw new Error('Can only rollback completed executions')
    }
    
    // Check if rollback is possible (within 24 hours)
    const executionDate = new Date(execution.started_at)
    const now = new Date()
    const hoursSinceExecution = (now.getTime() - executionDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceExecution > 24) {
      throw new Error('Rollback is only available within 24 hours of execution')
    }
    
    // Create rollback execution record
    const rollbackId = await this.createExecutionRecord(execution.policyId, 'rollback')
    
    try {
      // Implement rollback logic here
      // This would restore data from archive tables
      const restoredRecords = await this.restoreFromArchive(execution.policyId)
      
      await this.updateExecutionRecord(rollbackId, {
        status: 'completed',
        recordsArchived: 0,
        recordsDeleted: -restoredRecords, // Negative to indicate restoration
        executionSummary: {
          originalExecutionId: executionId,
          restoredRecords
        }
      })
      
      return rollbackId
    } catch (error) {
      await this.updateExecutionRecord(rollbackId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  // Private helper methods
  
  private async getPolicy(policyId: string): Promise<RetentionPolicy | null> {
    const { data, error } = await this.supabase
      .from('data_retention_policies')
      .select('*')
      .eq('id', policyId)
      .single()
    
    if (error) {
      return null
    }
    
    return data
  }
  
  private async createExecutionRecord(
    policyId: string, 
    executionType: 'dry_run' | 'execute' | 'rollback'
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('data_retention_executions')
      .insert({
        policy_id: policyId,
        execution_type: executionType,
        status: 'running'
      })
      .select('id')
      .single()
    
    if (error) {
      throw new Error(`Failed to create execution record: ${error.message}`)
    }
    
    return data.id
  }
  
  private async updateExecutionRecord(
    executionId: string, 
    updates: Partial<RetentionExecution>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('data_retention_executions')
      .update({
        ...updates,
        completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined
      })
      .eq('id', executionId)
    
    if (error) {
      throw new Error(`Failed to update execution record: ${error.message}`)
    }
  }
  
  private async getExecutionRecord(executionId: string): Promise<RetentionExecution> {
    const { data, error } = await this.supabase
      .from('data_retention_executions')
      .select('*')
      .eq('id', executionId)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch execution record: ${error.message}`)
    }
    
    return data
  }
  
  private async archiveData(policy: RetentionPolicy, cutoffDate: Date): Promise<number> {
    // Implementation would depend on the specific resource type
    // This is a placeholder for the archiving logic
    console.log(`Archiving ${policy.resourceType} data before ${cutoffDate.toISOString()}`)
    return 0
  }
  
  private async deleteData(policy: RetentionPolicy, cutoffDate: Date): Promise<number> {
    // Implementation would depend on the specific resource type
    // This is a placeholder for the deletion logic
    console.log(`Deleting ${policy.resourceType} data before ${cutoffDate.toISOString()}`)
    return 0
  }
  
  private async restoreFromArchive(policyId: string): Promise<number> {
    // Implementation would restore data from archive tables
    // This is a placeholder for the restoration logic
    console.log(`Restoring data for policy ${policyId}`)
    return 0
  }
  
  private parseSampleRecords(sampleRecords: unknown): Record<string, unknown>[] {
    if (typeof sampleRecords === 'object' && sampleRecords !== null) {
      return [sampleRecords as Record<string, unknown>]
    }
    return []
  }
  
  private getAffectedTables(sampleRecords: unknown): string[] {
    // Extract table names from sample records
    // This is a simplified implementation
    return ['appointments', 'customers', 'payments']
  }
  
  private estimateExecutionTime(recordCount: number): number {
    // Estimate execution time based on record count
    // ~1000 records per second as a rough estimate
    return Math.max(1, Math.ceil(recordCount / 1000))
  }
}