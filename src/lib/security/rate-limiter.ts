/**
 * Enhanced Rate Limiting System
 * Provides granular rate limiting by endpoint, role, and IP with proper 429 responses
 */

import { HandlerEvent } from '@netlify/functions'
import { AuthenticatedUser } from '../auth/netlify-auth'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  endpoint?: string
  role?: string
  skipSuccessfulAuth?: boolean
  skipOnError?: boolean
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: number
  retryAfter: number
}

export interface RateLimitStore {
  count: number
  resetTime: number
}

// In-memory store for rate limits (in production, consider Redis)
const rateLimitStore = new Map<string, RateLimitStore>()

// Default rate limit configurations per endpoint and role
const DEFAULT_RATE_LIMITS: Record<string, Record<string, RateLimitConfig>> = {
  // Booking endpoints - critical operations
  '/booking/enhanced': {
    'customer': { maxRequests: 10, windowMs: 60 * 1000 }, // 10/min for customers
    'staff': { maxRequests: 30, windowMs: 60 * 1000 },    // 30/min for staff
    'admin': { maxRequests: 100, windowMs: 60 * 1000 }    // 100/min for admin
  },
  '/booking/cancel': {
    'customer': { maxRequests: 5, windowMs: 60 * 1000 },
    'staff': { maxRequests: 20, windowMs: 60 * 1000 },
    'admin': { maxRequests: 50, windowMs: 60 * 1000 }
  },
  
  // Payment endpoints - very sensitive
  '/admin/payments/create': {
    'admin': { maxRequests: 20, windowMs: 60 * 1000 },
    'staff': { maxRequests: 10, windowMs: 60 * 1000 }
  },
  '/admin/payments/manage': {
    'admin': { maxRequests: 30, windowMs: 60 * 1000 },
    'staff': { maxRequests: 15, windowMs: 60 * 1000 }
  },
  
  // Admin endpoints - moderate protection
  '/admin/settings': {
    'admin': { maxRequests: 60, windowMs: 60 * 1000 }
  },
  '/admin/customers': {
    'admin': { maxRequests: 100, windowMs: 60 * 1000 },
    'staff': { maxRequests: 50, windowMs: 60 * 1000 }
  },
  
  // Auth endpoints - prevent brute force
  '/auth/login': {
    'anonymous': { maxRequests: 5, windowMs: 15 * 60 * 1000 } // 5 per 15 minutes
  },
  
  // Default fallback
  'default': {
    'customer': { maxRequests: 60, windowMs: 60 * 1000 },
    'staff': { maxRequests: 120, windowMs: 60 * 1000 },
    'admin': { maxRequests: 300, windowMs: 60 * 1000 },
    'anonymous': { maxRequests: 20, windowMs: 60 * 1000 }
  }
}

/**
 * Get rate limit configuration for a specific endpoint and role
 */
export function getRateLimitConfig(endpoint: string, role: string): RateLimitConfig {
  const endpointConfig = DEFAULT_RATE_LIMITS[endpoint]
  if (endpointConfig && endpointConfig[role]) {
    return { ...endpointConfig[role], endpoint, role }
  }
  
  // Fallback to default configuration
  const defaultConfig = DEFAULT_RATE_LIMITS.default[role] || DEFAULT_RATE_LIMITS.default.anonymous
  return { ...defaultConfig, endpoint, role }
}

/**
 * Generate rate limit key
 */
export function getRateLimitKey(
  event: HandlerEvent, 
  user: AuthenticatedUser | null, 
  endpoint: string
): string {
  const ip = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
  const userId = user?.id || 'anonymous'
  const role = user?.role || 'anonymous'
  
  // Create compound key: endpoint:role:ip:user
  return `${endpoint}:${role}:${ip}:${userId}`
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; info: RateLimitInfo } {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    const newRecord: RateLimitStore = {
      count: 1,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, newRecord)
    
    return {
      allowed: true,
      info: {
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: newRecord.resetTime,
        retryAfter: Math.ceil(config.windowMs / 1000)
      }
    }
  }
  
  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      info: {
        limit: config.maxRequests,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      }
    }
  }
  
  // Increment counter
  record.count++
  
  return {
    allowed: true,
    info: {
      limit: config.maxRequests,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    }
  }
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(info.resetTime / 1000).toString(),
    'Retry-After': info.retryAfter.toString()
  }
}

/**
 * Create 429 Too Many Requests response
 */
export function createRateLimitExceededResponse(info: RateLimitInfo) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...createRateLimitHeaders(info)
    },
    body: JSON.stringify({
      success: false,
      error: {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: info.retryAfter,
        limit: info.limit,
        resetTime: new Date(info.resetTime).toISOString()
      }
    })
  }
}

/**
 * Cleanup expired rate limit records (should be run periodically)
 */
export function cleanupExpiredRateLimits(): number {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
      cleaned++
    }
  }
  
  return cleaned
}

/**
 * Get current rate limit statistics
 */
export function getRateLimitStats(): {
  totalKeys: number
  expiredKeys: number
  activeEndpoints: string[]
} {
  const now = Date.now()
  let expiredKeys = 0
  const activeEndpoints = new Set<string>()
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      expiredKeys++
    } else {
      const endpoint = key.split(':')[0]
      activeEndpoints.add(endpoint)
    }
  }
  
  return {
    totalKeys: rateLimitStore.size,
    expiredKeys,
    activeEndpoints: Array.from(activeEndpoints)
  }
}