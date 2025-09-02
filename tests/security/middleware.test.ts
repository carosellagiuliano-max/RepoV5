/**
 * Security Middleware Test Suite
 * Tests for rate limiting, idempotency, and audit logging
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { withSecurity, withCriticalOperationSecurity } from '../src/lib/security/middleware'
import { HandlerEvent, Context } from '@netlify/functions'

// Mock Supabase
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      })),
      insert: jest.fn(),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  })),
  auth: {
    getUser: jest.fn()
  }
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

// Mock crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
})

// Test data
const mockEvent: HandlerEvent = {
  httpMethod: 'POST',
  path: '/test-endpoint',
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer valid-token',
    'x-forwarded-for': '192.168.1.1'
  },
  body: JSON.stringify({ test: 'data' }),
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  isBase64Encoded: false,
  rawUrl: '',
  rawQuery: ''
}

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'test-arn',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: 'test-log-group',
  logStreamName: 'test-log-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn()
}

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock responses
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null
    })
    
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { role: 'customer', is_active: true },
      error: null
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Authentication', () => {
    it('should require authentication when auth.required is true', async () => {
      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { required: true }
      })

      const eventWithoutAuth = { ...mockEvent, headers: {} }
      const result = await handler(eventWithoutAuth, mockContext)

      expect(result.statusCode).toBe(401)
      expect(JSON.parse(result.body).error.code).toBe('AUTH_REQUIRED')
    })

    it('should validate JWT token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { required: true }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should check user role permissions', async () => {
      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { 
          required: true,
          allowedRoles: ['admin']
        }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(403)
      expect(JSON.parse(result.body).error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ current_count: 5, window_end: new Date(Date.now() + 60000) }]
      })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        rateLimit: {
          maxRequests: 10,
          windowSeconds: 60
        }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(200)
      expect(result.headers?.['X-RateLimit-Remaining']).toBe('5')
    })

    it('should block requests that exceed rate limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ current_count: 15, window_end: new Date(Date.now() + 60000) }]
      })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        rateLimit: {
          maxRequests: 10,
          windowSeconds: 60
        }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(429)
      expect(JSON.parse(result.body).error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should skip rate limiting for specified roles', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin', is_active: true },
        error: null
      })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { required: true },
        rateLimit: {
          maxRequests: 10,
          windowSeconds: 60,
          skipForRoles: ['admin']
        }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(200)
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })
  })

  describe('Idempotency', () => {
    it('should return cached response for duplicate idempotency key', async () => {
      const cachedResponse = { status: 201, body: { id: 'cached-123' } }
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'customer', is_active: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            response_status: cachedResponse.status,
            response_body: cachedResponse.body
          },
          error: null
        })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 201, body: JSON.stringify({ id: 'new-456' }) }
      }, {
        auth: { required: true },
        idempotency: { enabled: true }
      })

      const eventWithIdempotency = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          'idempotency-key': 'test-key-123'
        }
      }

      const result = await handler(eventWithIdempotency, mockContext)

      expect(result.statusCode).toBe(201)
      expect(result.headers?.['X-Idempotent-Replay']).toBe('true')
      expect(JSON.parse(result.body)).toEqual(cachedResponse.body)
    })

    it('should store response for new idempotency key', async () => {
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'customer', is_active: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' } // Not found
        })

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 201, body: JSON.stringify({ id: 'new-456' }) }
      }, {
        auth: { required: true },
        idempotency: { enabled: true }
      })

      const eventWithIdempotency = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          'idempotency-key': 'test-key-456'
        }
      }

      const result = await handler(eventWithIdempotency, mockContext)

      expect(result.statusCode).toBe(201)
      expect(mockSupabase.from().insert).toHaveBeenCalled()
      expect(mockSupabase.from().update).toHaveBeenCalled()
    })
  })

  describe('Audit Logging', () => {
    it('should log audit events when enabled', async () => {
      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { required: true },
        audit: {
          enabled: true,
          action: 'test_action',
          resourceType: 'test_resource'
        }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
        p_action: 'test_action',
        p_resource_type: 'test_resource'
      }))
    })
  })

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      })

      const optionsEvent = { ...mockEvent, httpMethod: 'OPTIONS' }
      const result = await handler(optionsEvent, mockContext)

      expect(result.statusCode).toBe(200)
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')
      expect(result.body).toBe('')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Database connection failed'))

      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      }, {
        auth: { required: true }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.code).toBe('INTERNAL_ERROR')
    })

    it('should include correlation ID in all responses', async () => {
      const handler = withSecurity(async (event, context) => {
        return { statusCode: 200, body: 'success' }
      })

      const result = await handler(mockEvent, mockContext)

      expect(result.headers?.['X-Correlation-ID']).toMatch(/^req_\d+_[a-z0-9]+$/)
    })
  })
})

describe('Critical Operation Security', () => {
  it('should apply strict security settings for critical operations', async () => {
    const handler = withCriticalOperationSecurity(
      async (event, context) => {
        return { statusCode: 200, body: 'success' }
      },
      'critical_action',
      'critical_resource'
    )

    // This should require authentication and apply rate limiting
    const eventWithoutAuth = { ...mockEvent, headers: {} }
    const result = await handler(eventWithoutAuth, mockContext)

    expect(result.statusCode).toBe(401)
  })
})

describe('Abuse Prevention', () => {
  it('should detect and prevent rapid repeated requests', async () => {
    // Simulate rapid requests exceeding rate limit
    mockSupabase.rpc.mockResolvedValue({
      data: [{ current_count: 50, window_end: new Date(Date.now() + 60000) }]
    })

    const handler = withCriticalOperationSecurity(
      async (event, context) => {
        return { statusCode: 200, body: 'success' }
      },
      'test_action',
      'test_resource'
    )

    const result = await handler(mockEvent, mockContext)

    expect(result.statusCode).toBe(429)
    expect(JSON.parse(result.body).error.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('should prevent replay attacks with idempotency keys', async () => {
    const cachedResponse = { status: 200, body: { message: 'already processed' } }
    
    mockSupabase.from().select().eq().single
      .mockResolvedValueOnce({
        data: { role: 'customer', is_active: true },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          response_status: cachedResponse.status,
          response_body: cachedResponse.body
        },
        error: null
      })

    const handler = withCriticalOperationSecurity(
      async (event, context) => {
        return { statusCode: 200, body: JSON.stringify({ message: 'new processing' }) }
      },
      'test_action',
      'test_resource'
    )

    const eventWithIdempotency = {
      ...mockEvent,
      headers: {
        ...mockEvent.headers,
        'idempotency-key': 'replay-attack-key'
      }
    }

    const result = await handler(eventWithIdempotency, mockContext)

    expect(result.statusCode).toBe(200)
    expect(result.headers?.['X-Idempotent-Replay']).toBe('true')
    expect(JSON.parse(result.body)).toEqual(cachedResponse.body)
  })
})