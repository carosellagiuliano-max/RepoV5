/**
 * Security Validation Test Module
 * Reusable security test patterns for E2E testing
 */

import { expect } from 'vitest'

export interface SecurityTestConfig {
  baseUrl: string
  correlationId?: string
  rateLimitWindow?: number
}

export interface TestResult {
  category: string
  test: string
  status: 'pass' | 'fail' | 'skip'
  details?: any
  error?: string
}

export class SecurityValidationModule {
  private config: SecurityTestConfig
  private results: TestResult[] = []

  constructor(config: SecurityTestConfig) {
    this.config = config
  }

  addResult(category: string, test: string, status: TestResult['status'], details?: any, error?: string) {
    this.results.push({ category, test, status, details, error })
  }

  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * Test HTTP security headers
   */
  async testSecurityHeaders(): Promise<TestResult> {
    try {
      const response = await fetch(this.config.baseUrl, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-security-headers'
        }
      })

      expect(response.ok).toBe(true)
      
      const headers = {
        'x-frame-options': response.headers.get('x-frame-options'),
        'x-content-type-options': response.headers.get('x-content-type-options'),
        'x-xss-protection': response.headers.get('x-xss-protection'),
        'referrer-policy': response.headers.get('referrer-policy'),
        'permissions-policy': response.headers.get('permissions-policy'),
        'strict-transport-security': response.headers.get('strict-transport-security')
      }

      // Validate required security headers
      expect(headers['x-frame-options']).toBe('DENY')
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['referrer-policy']).toContain('strict-origin')
      
      const result: TestResult = {
        category: 'Security',
        test: 'HTTP Security Headers',
        status: 'pass',
        details: {
          headers,
          allRequiredPresent: true
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Security',
        test: 'HTTP Security Headers',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test rate limiting functionality
   */
  async testRateLimiting(): Promise<TestResult> {
    try {
      const endpoint = `${this.config.baseUrl}/api/auth/login`
      const requests: Promise<Response>[] = []
      
      // Send multiple requests rapidly to trigger rate limiting
      const numRequests = 5; // Reduced and sequential for safer testing
      const responses: Response[] = [];
      for (let i = 0; i < numRequests; i++) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-Id': `${this.config.correlationId || 'test-rate-limit'}-${i}`
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'invalid'
          })
        });
        responses.push(response);
      }
      const statusCodes = responses.map(r => r.status)
      
      // Should have some 429 (Too Many Requests) responses
      const rateLimitedCount = statusCodes.filter(code => code === 429).length
      
      expect(rateLimitedCount).toBeGreaterThan(0)
      
      const result: TestResult = {
        category: 'Security',
        test: 'Rate Limiting',
        status: 'pass',
        details: {
          totalRequests: requests.length,
          rateLimitedRequests: rateLimitedCount,
          statusCodes,
          rateLimitingActive: true
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Security',
        test: 'Rate Limiting',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test input validation and XSS protection
   */
  async testInputValidation(): Promise<TestResult> {
    try {
      const xssPayload = '<script>alert("xss")</script>'
      const sqlInjectionPayload = "'; DROP TABLE users; --"
      
      const response = await fetch(`${this.config.baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': this.config.correlationId || 'test-input-validation'
        },
        body: JSON.stringify({
          customerName: xssPayload,
          notes: sqlInjectionPayload,
          serviceId: 'test'
        })
      })

      // Should reject malicious input
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.errors).toBeDefined()
      
      const result: TestResult = {
        category: 'Security',
        test: 'Input Validation & XSS Protection',
        status: 'pass',
        details: {
          rejectedMaliciousInput: true,
          status: response.status,
          validationErrors: data.errors?.length || 0
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Security',
        test: 'Input Validation & XSS Protection',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test CORS configuration
   */
  async testCORSConfiguration(): Promise<TestResult> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'GET',
          'X-Correlation-Id': this.config.correlationId || 'test-cors'
        }
      })

      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers')
      }

      // CORS should be configured but not allow arbitrary origins
      expect(corsHeaders['access-control-allow-origin']).not.toBe('https://malicious-site.com')
      
      const result: TestResult = {
        category: 'Security',
        test: 'CORS Configuration',
        status: 'pass',
        details: {
          corsHeaders,
          preventsMaliciousOrigins: true,
          status: response.status
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Security',
        test: 'CORS Configuration',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test webhook signature validation
   */
  async testWebhookSecurity(): Promise<TestResult> {
    try {
      // Test webhook without proper signature
      const response = await fetch(`${this.config.baseUrl}/api/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': this.config.correlationId || 'test-webhook-security'
          // Missing stripe-signature header
        },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { id: 'test' }
        })
      })

      // Should reject webhook without proper signature
      expect(response.status).toBe(400)
      
      const result: TestResult = {
        category: 'Security',
        test: 'Webhook Signature Validation',
        status: 'pass',
        details: {
          rejectsUnsignedWebhooks: true,
          status: response.status
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Security',
        test: 'Webhook Signature Validation',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Run all security validation tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testSecurityHeaders(),
      this.testRateLimiting(),
      this.testInputValidation(),
      this.testCORSConfiguration(),
      this.testWebhookSecurity()
    ]

    const results = await Promise.allSettled(tests)
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          category: 'Security',
          test: `Test ${index + 1}`,
          status: 'fail' as const,
          error: result.reason?.message || 'Test failed'
        }
      }
    })
  }
}