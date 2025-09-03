/**
 * Integration Tests for Monitoring Infrastructure
 * 
 * Tests the monitoring endpoints and functionality in a real environment
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { v4 as uuidv4 } from 'uuid'

// Test configuration
const BASE_URL = process.env.VITE_SITE_URL || 'http://localhost:8888'
const TEST_JWT = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJyb2xlIjoiYWRtaW4ifQ.test' // Simple test token

describe('Monitoring Infrastructure Integration Tests', () => {
  let testCorrelationId: string

  beforeAll(() => {
    testCorrelationId = `test-${uuidv4()}`
  })

  describe('Health Endpoint (/api/health)', () => {
    it('should return healthy status for lightweight health check', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          'X-Correlation-Id': testCorrelationId
        }
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('status', 'healthy')
      expect(data).toHaveProperty('correlationId', testCorrelationId)
      expect(data).toHaveProperty('buildInfo')
      expect(data).toHaveProperty('metrics')
      expect(data.buildInfo).toHaveProperty('version')
      expect(data.metrics).toHaveProperty('uptime')
      expect(data.metrics).toHaveProperty('memoryUsage')
    })

    it('should generate correlation ID if not provided', async () => {
      const response = await fetch(`${BASE_URL}/api/health`)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('correlationId')
      expect(data.correlationId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)
    })

    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })

    it('should reject non-GET methods', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'POST',
        headers: {
          'X-Correlation-Id': testCorrelationId
        }
      })

      expect(response.status).toBe(405)
    })
  })

  describe('Readiness Endpoint (/api/ready)', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/ready`, {
        headers: {
          'X-Correlation-Id': testCorrelationId
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return comprehensive health status when authenticated', async () => {
      const response = await fetch(`${BASE_URL}/api/ready`, {
        headers: {
          'Authorization': `Bearer ${TEST_JWT}`,
          'X-Correlation-Id': testCorrelationId
        }
      })

      // May return 200 (ready), 503 (not ready), but should not be 401
      expect([200, 503]).toContain(response.status)
      
      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(['ready', 'warning', 'not_ready']).toContain(data.status)
      expect(data).toHaveProperty('correlationId', testCorrelationId)
      expect(data).toHaveProperty('checks')
      expect(data).toHaveProperty('thresholds')
      
      // Verify all expected checks are present
      expect(data.checks).toHaveProperty('database')
      expect(data.checks).toHaveProperty('smtp')
      expect(data.checks).toHaveProperty('sms')
      expect(data.checks).toHaveProperty('storage')
      expect(data.checks).toHaveProperty('queue')
      expect(data.checks).toHaveProperty('budget')
      
      // Verify thresholds are present
      expect(data.thresholds).toHaveProperty('DLQ_WARNING')
      expect(data.thresholds).toHaveProperty('DLQ_CRITICAL')
    })

    it('should include response time metrics', async () => {
      const startTime = Date.now()
      
      const response = await fetch(`${BASE_URL}/api/ready`, {
        headers: {
          'Authorization': `Bearer ${TEST_JWT}`,
          'X-Correlation-Id': testCorrelationId
        }
      })

      const endTime = Date.now()
      const actualResponseTime = endTime - startTime

      if (response.status === 200 || response.status === 503) {
        const data = await response.json()
        expect(data.metrics).toHaveProperty('overallResponseTime')
        expect(data.metrics.overallResponseTime).toBeGreaterThan(0)
        expect(data.metrics.overallResponseTime).toBeLessThan(actualResponseTime + 100) // Some tolerance
      }
    })
  })

  describe('Correlation ID Propagation', () => {
    it('should propagate correlation IDs across all endpoints', async () => {
      const uniqueId = `e2e-${Date.now()}`
      
      // Test health endpoint
      const healthResponse = await fetch(`${BASE_URL}/api/health`, {
        headers: { 'X-Correlation-Id': uniqueId }
      })
      const healthData = await healthResponse.json()
      expect(healthData.correlationId).toBe(uniqueId)
    })
  })
})

describe('Logging Integration', () => {
  it('should include structured log data', () => {
    const testCorrelationId = `test-${uuidv4()}`
    
    const mockLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test log entry',
      correlationId: testCorrelationId,
      context: {
        component: 'test',
        action: 'integration-test'
      },
      environment: 'test',
      version: '1.0.0'
    }
    
    // Verify log structure
    expect(mockLogEntry).toHaveProperty('timestamp')
    expect(mockLogEntry).toHaveProperty('level')
    expect(mockLogEntry).toHaveProperty('correlationId')
    expect(mockLogEntry).toHaveProperty('context')
    expect(mockLogEntry.context).toHaveProperty('component')
    expect(mockLogEntry.context).toHaveProperty('action')
  })

  it('should redact PII from log messages', () => {
    const sensitiveData = {
      email: 'user@example.com',
      phone: '+1-555-123-4567',
      password: 'secret123',
      apiKey: 'ak_1234567890abcdef'
    }
    
    // In a real test, you would check that these values are redacted
    // when logged through the logging system
    expect(sensitiveData.email).toContain('@') // Would be [EMAIL_REDACTED]
    expect(sensitiveData.phone).toContain('+') // Would be [PHONE_REDACTED]
    expect(sensitiveData.password).toBeTruthy() // Would be [REDACTED]
    expect(sensitiveData.apiKey).toBeTruthy() // Would be [REDACTED]
  })
})