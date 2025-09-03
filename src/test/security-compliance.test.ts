/**
 * Security & Compliance Hardening Tests
 * Comprehensive test suite for idempotency, rate limiting, and audit systems
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  checkIdempotency, 
  storeIdempotencyResponse, 
  validateIdempotencyKey,
  generateIdempotencyKey 
} from '../lib/security/idempotency'
import { 
  getRateLimitConfig,
  checkRateLimit,
  createRateLimitHeaders 
} from '../lib/security/rate-limiter'
import { DataRetentionService } from '../lib/security/data-retention'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    delete: vi.fn(() => ({
      lt: vi.fn(() => ({
        select: vi.fn()
      }))
    }))
  })),
  rpc: vi.fn()
}

vi.mock('../lib/auth/netlify-auth', () => ({
  createAdminClient: () => mockSupabase
}))

describe('Security & Compliance Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Idempotency System', () => {
    it('should validate idempotency key format correctly', () => {
      // Valid keys
      expect(validateIdempotencyKey('booking_1234567890123456')).toBe(true)
      expect(validateIdempotencyKey('payment-abc123-def456-ghi789')).toBe(true)
      expect(validateIdempotencyKey('a'.repeat(32))).toBe(true)
      
      // Invalid keys
      expect(validateIdempotencyKey('short')).toBe(false)
      expect(validateIdempotencyKey('invalid@key')).toBe(false)
      expect(validateIdempotencyKey('spaces in key')).toBe(false)
      expect(validateIdempotencyKey('a'.repeat(129))).toBe(false) // Too long
    })

    it('should generate valid idempotency keys', () => {
      const key1 = generateIdempotencyKey('booking')
      const key2 = generateIdempotencyKey('payment')
      
      expect(validateIdempotencyKey(key1)).toBe(true)
      expect(validateIdempotencyKey(key2)).toBe(true)
      expect(key1).toMatch(/^booking_\d+_[a-f0-9]{32}$/)
      expect(key2).toMatch(/^payment_\d+_[a-f0-9]{32}$/)
      expect(key1).not.toBe(key2)
    })

    it('should check idempotency correctly for new request', async () => {
      // Mock database response for non-existent key
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      })

      const result = await checkIdempotency(
        'test_key_123',
        '{"test": "data"}',
        '/test/endpoint',
        'POST'
      )

      expect(result.exists).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('should return cached response for existing idempotency key', async () => {
      const cachedResponse = {
        idempotency_key: 'test_key_123',
        request_hash: 'hash123',
        response_status: 201,
        response_body: { id: 'booking_123' },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: cachedResponse,
        error: null
      })

      const result = await checkIdempotency(
        'test_key_123',
        '{"test": "data"}',
        '/test/endpoint',
        'POST'
      )

      expect(result.exists).toBe(true)
      expect(result.response?.statusCode).toBe(201)
      expect(result.response?.body).toEqual({ id: 'booking_123' })
    })

    it('should detect idempotency key reuse with different request body', async () => {
      const cachedResponse = {
        idempotency_key: 'test_key_123',
        request_hash: 'different_hash',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: cachedResponse,
        error: null
      })

      const result = await checkIdempotency(
        'test_key_123',
        '{"test": "different_data"}',
        '/test/endpoint',
        'POST'
      )

      expect(result.exists).toBe(false)
      expect(result.error).toContain('different request body')
    })

    it('should store idempotency response correctly', async () => {
      mockSupabase.from().insert.mockResolvedValueOnce({
        data: { id: 'stored_id' },
        error: null
      })

      await storeIdempotencyResponse(
        'test_key_123',
        '{"test": "data"}',
        '/test/endpoint',
        'POST',
        201,
        { id: 'booking_123' }
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('operations_idempotency')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotency_key: 'test_key_123',
          endpoint: '/test/endpoint',
          method: 'POST',
          response_status: 201,
          response_body: { id: 'booking_123' }
        })
      )
    })
  })

  describe('Rate Limiting System', () => {
    it('should get correct rate limit config for different endpoints and roles', () => {
      // Booking endpoint for customer
      const customerBookingConfig = getRateLimitConfig('/booking/enhanced', 'customer')
      expect(customerBookingConfig.maxRequests).toBe(10)
      expect(customerBookingConfig.windowMs).toBe(60 * 1000)
      
      // Admin payments endpoint
      const adminPaymentConfig = getRateLimitConfig('/admin/payments/create', 'admin')
      expect(adminPaymentConfig.maxRequests).toBe(20)
      
      // Unknown endpoint should use default
      const unknownConfig = getRateLimitConfig('/unknown/endpoint', 'customer')
      expect(unknownConfig.maxRequests).toBe(60)
    })

    it('should allow requests within rate limit', () => {
      const config = { maxRequests: 10, windowMs: 60000 }
      const key = 'test_user_key'
      
      // First request should be allowed
      const result1 = checkRateLimit(key, config)
      expect(result1.allowed).toBe(true)
      expect(result1.info.remaining).toBe(9)
      
      // Second request should be allowed
      const result2 = checkRateLimit(key, config)
      expect(result2.allowed).toBe(true)
      expect(result2.info.remaining).toBe(8)
    })

    it('should block requests when rate limit exceeded', () => {
      const config = { maxRequests: 2, windowMs: 60000 }
      const key = 'test_user_key_2'
      
      // First two requests allowed
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      
      // Third request should be blocked
      const result = checkRateLimit(key, config)
      expect(result.allowed).toBe(false)
      expect(result.info.remaining).toBe(0)
      expect(result.info.retryAfter).toBeGreaterThan(0)
    })

    it('should reset rate limit after window expires', () => {
      const config = { maxRequests: 1, windowMs: 100 } // 100ms window
      const key = 'test_user_key_3'
      
      // First request allowed
      const result1 = checkRateLimit(key, config)
      expect(result1.allowed).toBe(true)
      
      // Second request blocked
      const result2 = checkRateLimit(key, config)
      expect(result2.allowed).toBe(false)
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Third request should be allowed after reset
          const result3 = checkRateLimit(key, config)
          expect(result3.allowed).toBe(true)
          resolve(undefined)
        }, 150)
      })
    })

    it('should create correct rate limit headers', () => {
      const info = {
        limit: 100,
        remaining: 75,
        resetTime: Date.now() + 60000,
        retryAfter: 60
      }
      
      const headers = createRateLimitHeaders(info)
      
      expect(headers['X-RateLimit-Limit']).toBe('100')
      expect(headers['X-RateLimit-Remaining']).toBe('75')
      expect(headers['Retry-After']).toBe('60')
      expect(headers['X-RateLimit-Reset']).toBeDefined()
    })
  })

  describe('Data Retention System', () => {
    it('should create data retention service instance', () => {
      const service = new DataRetentionService()
      expect(service).toBeInstanceOf(DataRetentionService)
    })

    it('should fetch active retention policies', async () => {
      const mockPolicies = [
        {
          id: 'policy1',
          resource_type: 'appointments',
          retention_days: 2555,
          is_active: true
        }
      ]

      mockSupabase.from().select().eq().order.mockResolvedValueOnce({
        data: mockPolicies,
        error: null
      })

      const service = new DataRetentionService()
      const policies = await service.getActivePolicies()
      
      expect(policies).toEqual(mockPolicies)
      expect(mockSupabase.from).toHaveBeenCalledWith('data_retention_policies')
    })

    it('should execute dry run for retention policy', async () => {
      const mockDryRunResult = {
        resource_count: 150,
        oldest_record: '2020-01-01T00:00:00Z',
        sample_records: { id: 'sample1' }
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockDryRunResult,
        error: null
      })

      const service = new DataRetentionService()
      const result = await service.executeDryRun('policy1')
      
      expect(result.resourceCount).toBe(150)
      expect(result.oldestRecord).toBe('2020-01-01T00:00:00Z')
      expect(result.estimatedExecutionTime).toBeGreaterThan(0)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'execute_data_retention_dry_run',
        { p_policy_id: 'policy1' }
      )
    })
  })

  describe('End-to-End Security Tests', () => {
    it('should handle repeated POST requests idempotently', async () => {
      // Simulate first request
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // First check - not found
        .mockResolvedValueOnce({ // Second check - found cached response
          data: {
            idempotency_key: 'booking_12345',
            response_status: 201,
            response_body: { appointment_id: 'apt_123' },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          },
          error: null
        })

      mockSupabase.from().insert.mockResolvedValueOnce({
        data: { id: 'stored' },
        error: null
      })

      const idempotencyKey = 'booking_12345'
      const requestBody = '{"customer_id": "cust_123", "service_id": "svc_123"}'
      const endpoint = '/booking/enhanced'

      // First request - should process normally
      const result1 = await checkIdempotency(idempotencyKey, requestBody, endpoint, 'POST')
      expect(result1.exists).toBe(false)

      // Store the response
      await storeIdempotencyResponse(
        idempotencyKey,
        requestBody,
        endpoint,
        'POST',
        201,
        { appointment_id: 'apt_123' }
      )

      // Second identical request - should return cached response
      const result2 = await checkIdempotency(idempotencyKey, requestBody, endpoint, 'POST')
      expect(result2.exists).toBe(true)
      expect(result2.response?.statusCode).toBe(201)
      expect(result2.response?.body).toEqual({ appointment_id: 'apt_123' })
    })

    it('should enforce rate limits with proper 429 responses', () => {
      const config = { maxRequests: 2, windowMs: 60000 }
      const key = 'user_rate_limit_test'

      // First two requests should succeed
      const result1 = checkRateLimit(key, config)
      expect(result1.allowed).toBe(true)

      const result2 = checkRateLimit(key, config)
      expect(result2.allowed).toBe(true)

      // Third request should be rate limited
      const result3 = checkRateLimit(key, config)
      expect(result3.allowed).toBe(false)
      expect(result3.info.retryAfter).toBeGreaterThan(0)
      expect(result3.info.remaining).toBe(0)
    })

    it('should validate security requirements compliance', () => {
      // Test that all security components work together
      
      // 1. Idempotency key validation
      const validKey = generateIdempotencyKey('compliance_test')
      expect(validateIdempotencyKey(validKey)).toBe(true)
      
      // 2. Rate limiting configuration
      const rateLimitConfig = getRateLimitConfig('/booking/enhanced', 'customer')
      expect(rateLimitConfig.maxRequests).toBeGreaterThan(0)
      expect(rateLimitConfig.windowMs).toBeGreaterThan(0)
      
      // 3. Data retention service
      const retentionService = new DataRetentionService()
      expect(retentionService).toBeInstanceOf(DataRetentionService)
      
      // All components are properly initialized and configured
      expect(true).toBe(true)
    })
  })
})