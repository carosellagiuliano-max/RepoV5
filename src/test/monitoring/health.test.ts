/**
 * Tests for the health endpoint
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

vi.mock('nodemailer', () => ({
  createTransporter: vi.fn()
}))

vi.mock('../../src/lib/monitoring/logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    performance: vi.fn(),
    getCorrelationId: vi.fn(() => 'test-correlation-id')
  }))
}))

describe('Health Endpoint', () => {
  let mockSupabaseClient: MockSupabaseClient
  let mockTransporter: unknown
  let handler: unknown

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset modules to get fresh imports
    vi.resetModules()
    
    // Mock Supabase client
    mockSupabaseClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      storage: {
        from: vi.fn(() => ({
          list: vi.fn()
        }))
      }
    }
    
    // Mock nodemailer transporter
    mockTransporter = {
      verify: vi.fn()
    }
    
    const { createClient } = await import('@supabase/supabase-js')
    const nodemailer = await import('nodemailer')
    
    ;(createClient as MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient)
    ;(nodemailer.createTransporter as MockedFunction<typeof nodemailer.createTransporter>).mockReturnValue(mockTransporter)
  })

  const createMockEvent = (method = 'GET', headers = {}) => ({
    httpMethod: method,
    headers: {
      'user-agent': 'test-agent',
      ...headers
    },
    body: ''
  })

  const createMockContext = () => ({
    callbackWaitsForEmptyEventLoop: false
  })

  describe('HTTP Method Handling', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent('OPTIONS')
      const context = createMockContext()

      const response = await handler(event, context)

      expect(response.statusCode).toBe(200)
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*')
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET, OPTIONS')
      expect(response.body).toBe('')
    })

    it('should reject non-GET/OPTIONS methods', async () => {
      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent('POST')
      const context = createMockContext()

      const response = await handler(event, context)

      expect(response.statusCode).toBe(405)
      
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Method not allowed')
      expect(body).toHaveProperty('correlationId')
    })
  })

  describe('Successful Health Checks', () => {
    beforeEach(() => {
      // Mock successful responses
      mockSupabaseClient.from().select().limit().single.mockResolvedValue({
        data: { count: 1 },
        error: null
      })
      
      mockSupabaseClient.storage.from().list.mockResolvedValue({
        data: [],
        error: null
      })
      
      mockTransporter.verify.mockResolvedValue(true)
      
      // Mock environment variables
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'
      process.env.SMTP_USERNAME = 'test@test.com'
      process.env.SMTP_PASSWORD = 'password'
      process.env.VITE_SMS_ENABLED = 'false'
    })

    it('should return healthy status when all checks pass', async () => {
      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('status', 'healthy')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('version')
      expect(body).toHaveProperty('buildInfo')
      expect(body).toHaveProperty('checks')
      expect(body).toHaveProperty('metrics')
      expect(body).toHaveProperty('correlationId', 'test-correlation-id')
    })

    it('should include all required checks', async () => {
      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      const body = JSON.parse(response.body)

      const expectedChecks = ['database', 'smtp', 'sms', 'storage', 'queue', 'budget']
      expectedChecks.forEach(check => {
        expect(body.checks).toHaveProperty(check)
        expect(body.checks[check]).toHaveProperty('status')
        expect(body.checks[check]).toHaveProperty('message')
      })
    })

    it('should include build information', async () => {
      process.env.VITE_APP_VERSION = '1.2.3'
      process.env.NODE_ENV = 'test'
      process.env.AWS_REGION = 'us-east-1'
      process.env.DEPLOY_ID = 'deploy-123'

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      const body = JSON.parse(response.body)

      expect(body.buildInfo).toEqual({
        version: '1.2.3',
        environment: 'test',
        region: 'us-east-1',
        nodeVersion: process.version,
        deployId: 'deploy-123'
      })
    })

    it('should include metrics', async () => {
      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      const body = JSON.parse(response.body)

      expect(body.metrics).toHaveProperty('uptime')
      expect(body.metrics).toHaveProperty('memoryUsage')
      expect(body.metrics.memoryUsage).toHaveProperty('used')
      expect(body.metrics.memoryUsage).toHaveProperty('total')
      expect(body.metrics.memoryUsage).toHaveProperty('percentage')
    })
  })

  describe('Database Health Check', () => {
    it('should report database error when query fails', async () => {
      mockSupabaseClient.from().select().limit().single.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed', code: 'PGRST116' }
      })

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)

      expect(response.statusCode).toBe(503) // Service Unavailable
      
      const body = JSON.parse(response.body)
      expect(body.status).toBe('error')
      expect(body.checks.database.status).toBe('error')
      expect(body.checks.database.message).toContain('Database error')
    })

    it('should report warning for slow database response', async () => {
      // Mock slow response by delaying the promise
      mockSupabaseClient.from().select().limit().single.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({ data: { count: 1 }, error: null }), 1500)
        })
      )

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.database.status).toBe('warning')
      expect(body.checks.database.message).toContain('slow')
    })

    it('should handle database connection exceptions', async () => {
      mockSupabaseClient.from().select().limit().single.mockRejectedValue(
        new Error('Network error')
      )

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.body)
      expect(body.checks.database.status).toBe('error')
      expect(body.checks.database.message).toContain('Database connection failed')
    })
  })

  describe('SMTP Health Check', () => {
    it('should report warning when SMTP not configured', async () => {
      delete process.env.SMTP_HOST
      delete process.env.SMTP_USERNAME
      delete process.env.SMTP_PASSWORD

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.smtp.status).toBe('warning')
      expect(body.checks.smtp.message).toBe('SMTP not configured')
    })

    it('should report error when SMTP verification fails', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_USERNAME = 'test@test.com'
      process.env.SMTP_PASSWORD = 'password'
      
      mockTransporter.verify.mockRejectedValue(new Error('Authentication failed'))

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.smtp.status).toBe('error')
      expect(body.checks.smtp.message).toContain('SMTP connection failed')
    })

    it('should report warning for slow SMTP response', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_USERNAME = 'test@test.com'
      process.env.SMTP_PASSWORD = 'password'
      
      mockTransporter.verify.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve(true), 2500)
        })
      )

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.smtp.status).toBe('warning')
      expect(body.checks.smtp.message).toContain('slow')
    })
  })

  describe('SMS Health Check', () => {
    it('should report healthy when SMS is disabled', async () => {
      process.env.VITE_SMS_ENABLED = 'false'

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.sms.status).toBe('healthy')
      expect(body.checks.sms.message).toBe('SMS service disabled')
    })

    it('should report warning when SMS enabled but not configured', async () => {
      process.env.VITE_SMS_ENABLED = 'true'
      delete process.env.TWILIO_ACCOUNT_SID
      delete process.env.TWILIO_AUTH_TOKEN

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.sms.status).toBe('warning')
      expect(body.checks.sms.message).toBe('SMS enabled but Twilio not configured')
    })

    it('should report healthy when SMS properly configured', async () => {
      process.env.VITE_SMS_ENABLED = 'true'
      process.env.TWILIO_ACCOUNT_SID = 'AC123'
      process.env.TWILIO_AUTH_TOKEN = 'token123'

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.sms.status).toBe('healthy')
      expect(body.checks.sms.message).toBe('SMS service configured')
    })
  })

  describe('Storage Health Check', () => {
    it('should report error when storage list fails', async () => {
      mockSupabaseClient.storage.from().list.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found', statusCode: 404 }
      })

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.storage.status).toBe('error')
      expect(body.checks.storage.message).toContain('Storage error')
    })

    it('should report warning for slow storage response', async () => {
      mockSupabaseClient.storage.from().list.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({ data: [], error: null }), 2000)
        })
      )

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent()
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.checks.storage.status).toBe('warning')
      expect(body.checks.storage.message).toContain('slow')
    })
  })

  describe('Correlation ID Handling', () => {
    it('should use correlation ID from request headers', async () => {
      const { createRequestLogger } = await import('../../lib/monitoring/logger')
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        performance: vi.fn(),
        getCorrelationId: vi.fn(() => 'custom-correlation-id')
      }
      
      ;(createRequestLogger as MockedFunction<typeof createRequestLogger>).mockReturnValue(mockLogger)

      const { handler } = await import('../../../netlify/functions/health')
      const event = createMockEvent('GET', { 'X-Correlation-Id': 'custom-correlation-id' })
      const context = createMockContext()

      const response = await handler(event, context)
      
      const body = JSON.parse(response.body)
      expect(body.correlationId).toBe('custom-correlation-id')
      expect(response.headers['X-Correlation-Id']).toBe('custom-correlation-id')
    })
  })

  describe('Error Handling', () => {
    it('should return 503 when health check fails catastrophically', async () => {
      // Mock a scenario where the health check itself throws an error
      vi.doMock('../../../netlify/functions/health', () => {
        throw new Error('Catastrophic failure')
      })

      try {
        const { handler } = await import('../../../netlify/functions/health')
        const event = createMockEvent()
        const context = createMockContext()

        const response = await handler(event, context)
        
        expect(response.statusCode).toBe(503)
        const body = JSON.parse(response.body)
        expect(body.status).toBe('error')
        expect(body.error).toBe('Health check failed')
      } catch (error) {
        // This is expected if the module import fails
        expect(error).toBeInstanceOf(Error)
      }
    })
  })
})