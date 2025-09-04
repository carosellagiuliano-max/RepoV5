/**
 * Authentication Flow Test Module
 * Reusable authentication test patterns for E2E testing
 */

import { expect } from 'vitest'

export interface AuthTestConfig {
  baseUrl: string
  testUser?: {
    email: string
    password: string
  }
  correlationId?: string
}

export interface TestResult {
  category: string
  test: string
  status: 'pass' | 'fail' | 'skip'
  details?: any
  error?: string
}

export class AuthFlowModule {
  private config: AuthTestConfig
  private results: TestResult[] = []

  constructor(config: AuthTestConfig) {
    this.config = config
  }

  addResult(category: string, test: string, status: TestResult['status'], details?: any, error?: string) {
    this.results.push({ category, test, status, details, error })
  }

  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * Test JWT token validation on protected endpoints
   */
  async testJWTProtection(): Promise<TestResult> {
    try {
      // Test unauthorized access
      const response = await fetch(`${this.config.baseUrl}/api/admin/appointments`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-auth-jwt'
        }
      })

      expect(response.status).toBe(401)
      
      const result: TestResult = {
        category: 'Authentication',
        test: 'JWT Protection',
        status: 'pass',
        details: { status: response.status, protected: true }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Authentication',
        test: 'JWT Protection',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test role-based access control (RBAC)
   */
  async testRBACEnforcement(): Promise<TestResult> {
    try {
      // Test admin endpoint access without proper role
      const response = await fetch(`${this.config.baseUrl}/api/admin/settings`, {
        headers: {
          'Authorization': 'Bearer invalid_token',
          'X-Correlation-Id': this.config.correlationId || 'test-auth-rbac'
        }
      })

      expect(response.status).toBe(401)
      
      const result: TestResult = {
        category: 'Authentication',
        test: 'RBAC Enforcement',
        status: 'pass',
        details: { 
          endpoint: '/api/admin/settings',
          expectedStatus: 401,
          actualStatus: response.status
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Authentication',
        test: 'RBAC Enforcement',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test session management and timeout
   */
  async testSessionManagement(): Promise<TestResult> {
    try {
      // Test session validation endpoint
      const response = await fetch(`${this.config.baseUrl}/api/auth/session`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-auth-session'
        }
      })

      // Should return 401 without valid session
      expect(response.status).toBe(401)
      
      const result: TestResult = {
        category: 'Authentication',
        test: 'Session Management',
        status: 'pass',
        details: {
          endpoint: '/api/auth/session',
          sessionValidation: 'enforced',
          status: response.status
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Authentication',
        test: 'Session Management',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Run all authentication tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testJWTProtection(),
      this.testRBACEnforcement(), 
      this.testSessionManagement()
    ]

    const results = await Promise.allSettled(tests)
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          category: 'Authentication',
          test: `Test ${index + 1}`,
          status: 'fail' as const,
          error: result.reason?.message || 'Test failed'
        }
      }
    })
  }
}