/**
 * Unified Idempotency System
 * Handles idempotency keys for all critical operations with consistent TTL and validation
 */

import { createAdminClient } from '../auth/netlify-auth'
import crypto from 'crypto'

export interface IdempotencyOptions {
  ttlHours?: number
  requireExactMatch?: boolean
}

export interface IdempotencyResult {
  exists: boolean
  response?: {
    statusCode: number
    body: unknown
  }
  error?: string
}

export interface IdempotencyStore {
  key: string
  requestHash: string
  endpoint: string
  method: string
  responseStatus?: number
  responseBody?: unknown
  expiresAt: string
}

/**
 * Check if request is idempotent and return cached response if exists
 */
export async function checkIdempotency(
  idempotencyKey: string,
  requestBody: string,
  endpoint: string,
  method: string,
  options: IdempotencyOptions = {}
): Promise<IdempotencyResult> {
  const { ttlHours = 24, requireExactMatch = true } = options
  
  try {
    const supabase = createAdminClient()
    const requestHash = crypto.createHash('sha256').update(requestBody).digest('hex')
    
    const { data, error } = await supabase
      .from('operations_idempotency')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking idempotency:', error)
      return { exists: false, error: 'Database error checking idempotency' }
    }

    if (data) {
      // Check if not expired
      if (new Date(data.expires_at) <= new Date()) {
        // Clean up expired entry
        await supabase
          .from('operations_idempotency')
          .delete()
          .eq('idempotency_key', idempotencyKey)
        
        return { exists: false }
      }

      // Check if request matches (if required)
      if (requireExactMatch && data.request_hash !== requestHash) {
        return { 
          exists: false, 
          error: 'Idempotency key reused with different request body' 
        }
      }

      // Return cached response
      return {
        exists: true,
        response: {
          statusCode: data.response_status || 200,
          body: data.response_body
        }
      }
    }

    return { exists: false }
  } catch (error) {
    console.error('Error in checkIdempotency:', error)
    return { exists: false, error: 'Internal error checking idempotency' }
  }
}

/**
 * Store idempotency response for future requests
 */
export async function storeIdempotencyResponse(
  idempotencyKey: string,
  requestBody: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseBody: unknown,
  options: IdempotencyOptions = {}
): Promise<void> {
  const { ttlHours = 24 } = options
  
  try {
    const supabase = createAdminClient()
    const requestHash = crypto.createHash('sha256').update(requestBody).digest('hex')
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
    
    await supabase
      .from('operations_idempotency')
      .insert({
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        endpoint,
        method,
        response_status: statusCode,
        response_body: responseBody,
        expires_at: expiresAt
      })
  } catch (error) {
    console.error('Error storing idempotency response:', error)
    // Don't throw here to avoid breaking the main flow
  }
}

/**
 * Generate a secure idempotency key for server-side operations
 */
export function generateIdempotencyKey(prefix: string = 'auto'): string {
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(16).toString('hex')
  return `${prefix}_${timestamp}_${randomBytes}`
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(key: string): boolean {
  // Key should be at least 16 characters and contain only alphanumeric chars, dashes, underscores
  const keyRegex = /^[a-zA-Z0-9_-]{16,128}$/
  return keyRegex.test(key)
}

/**
 * Clean up expired idempotency keys (should be run periodically)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('operations_idempotency')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('idempotency_key')
    
    if (error) {
      console.error('Error cleaning up expired idempotency keys:', error)
      return 0
    }
    
    const deletedCount = data?.length || 0
    console.log(`Cleaned up ${deletedCount} expired idempotency keys`)
    return deletedCount
  } catch (error) {
    console.error('Error in cleanupExpiredIdempotencyKeys:', error)
    return 0
  }
}