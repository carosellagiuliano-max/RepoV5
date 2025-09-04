/**
 * Health Check Test Module
 * Reusable health monitoring test patterns for E2E testing
 */

import { expect } from 'vitest'

export interface HealthTestConfig {
  baseUrl: string
  expectedVersion?: string
  correlationId?: string
  timeout?: number
}

export interface TestResult {
  category: string
  test: string
  status: 'pass' | 'fail' | 'skip'
  details?: any
  error?: string
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  buildInfo: {
    version: string
    environment: string
    region: string
    nodeVersion: string
  }
  metrics: {
    uptime: number
    memoryUsage: {
      used: number
      total: number
      percentage: number
    }
  }
  correlationId: string
}

export class HealthCheckModule {
  private config: HealthTestConfig
  private results: TestResult[] = []

  constructor(config: HealthTestConfig) {
    this.config = config
  }

  addResult(category: string, test: string, status: TestResult['status'], details?: any, error?: string) {
    this.results.push({ category, test, status, details, error })
  }

  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * Test basic health endpoint functionality
   */
  async testBasicHealth(): Promise<TestResult> {
    try {
      const startTime = Date.now()
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-health-basic'
        }
      })

      const responseTime = Date.now() - startTime
      expect(response.ok).toBe(true)
      
      const data: HealthResponse = await response.json()
      
      expect(data.status).toBe('healthy')
      expect(data.timestamp).toBeDefined()
      expect(data.version).toBeDefined()
      expect(data.correlationId).toBe(this.config.correlationId || 'test-health-basic')
      
      const result: TestResult = {
        category: 'Health Check',
        test: 'Basic Health Endpoint',
        status: 'pass',
        details: {
          status: data.status,
          responseTime,
          version: data.version,
          uptime: data.metrics?.uptime
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Health Check',
        test: 'Basic Health Endpoint',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test detailed health metrics
   */
  async testHealthMetrics(): Promise<TestResult> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health/detailed`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-health-metrics'
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      // Validate metrics structure
      expect(data.metrics).toBeDefined()
      expect(data.metrics.uptime).toBeTypeOf('number')
      expect(data.metrics.memoryUsage).toBeDefined()
      expect(data.metrics.memoryUsage.used).toBeTypeOf('number')
      expect(data.metrics.memoryUsage.total).toBeTypeOf('number')
      expect(data.metrics.memoryUsage.percentage).toBeTypeOf('number')
      
      const result: TestResult = {
        category: 'Health Check',
        test: 'Health Metrics',
        status: 'pass',
        details: {
          uptime: data.metrics.uptime,
          memoryUsage: data.metrics.memoryUsage,
          hasAllMetrics: true
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Health Check',
        test: 'Health Metrics',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test dependency health checks
   */
  async testDependencyHealth(): Promise<TestResult> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health/dependencies`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-health-deps'
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data.dependencies).toBeDefined()
      expect(Array.isArray(data.dependencies)).toBe(true)
      
      // Check for expected dependencies
      const expectedDeps = ['database', 'stripe', 'email']
      const depNames = data.dependencies.map((dep: any) => dep.name)
      
      expectedDeps.forEach(depName => {
        expect(depNames).toContain(depName)
      })
      
      const result: TestResult = {
        category: 'Health Check',
        test: 'Dependency Health',
        status: 'pass',
        details: {
          totalDependencies: data.dependencies.length,
          dependencies: data.dependencies.map((dep: any) => ({
            name: dep.name,
            status: dep.status
          }))
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Health Check',
        test: 'Dependency Health',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test health check response time
   */
  async testResponseTime(): Promise<TestResult> {
    try {
      const maxResponseTime = this.config.timeout || 5000 // 5 seconds default
      const startTime = Date.now()
      
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-health-response-time'
        }
      })

      const responseTime = Date.now() - startTime
      
      expect(response.ok).toBe(true)
      expect(responseTime).toBeLessThan(maxResponseTime)
      
      const result: TestResult = {
        category: 'Health Check',
        test: 'Response Time',
        status: 'pass',
        details: {
          responseTime,
          maxAllowed: maxResponseTime,
          performanceGood: responseTime < 1000 // Under 1 second is good
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Health Check',
        test: 'Response Time',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Run all health check tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testBasicHealth(),
      this.testHealthMetrics(),
      this.testDependencyHealth(),
      this.testResponseTime()
    ]

    const results = await Promise.allSettled(tests)
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          category: 'Health Check',
          test: `Test ${index + 1}`,
          status: 'fail' as const,
          error: result.reason?.message || 'Test failed'
        }
      }
    })
  }
}