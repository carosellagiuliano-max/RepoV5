/**
 * Performance Check Test Module
 * Reusable performance test patterns for E2E testing
 */

import { expect } from 'vitest'

export interface PerformanceTestConfig {
  baseUrl: string
  correlationId?: string
  thresholds?: {
    responseTime: number
    firstContentfulPaint: number
    largestContentfulPaint: number
  }
}

export interface TestResult {
  category: string
  test: string
  status: 'pass' | 'fail' | 'skip'
  details?: any
  error?: string
}

export interface PerformanceMetrics {
  responseTime: number
  ttfb: number // Time to First Byte
  domReady: number
  resourceCount: number
  transferSize: number
}

export class PerformanceCheckModule {
  private config: PerformanceTestConfig
  private results: TestResult[] = []

  constructor(config: PerformanceTestConfig) {
    this.config = config
    this.config.thresholds = {
      responseTime: 5000, // 5 seconds
      firstContentfulPaint: 2500, // 2.5 seconds
      largestContentfulPaint: 2500, // 2.5 seconds
      ...config.thresholds
    }
  }

  addResult(category: string, test: string, status: TestResult['status'], details?: any, error?: string) {
    this.results.push({ category, test, status, details, error })
  }

  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * Test page load performance
   */
  async testPageLoadPerformance(): Promise<TestResult> {
    try {
      const startTime = Date.now()
      
      const response = await fetch(this.config.baseUrl, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-performance-load'
        }
      })

      const responseTime = Date.now() - startTime
      
      expect(response.ok).toBe(true)
      expect(responseTime).toBeLessThan(this.config.thresholds!.responseTime)
      
      const result: TestResult = {
        category: 'Performance',
        test: 'Page Load Performance',
        status: 'pass',
        details: {
          responseTime,
          threshold: this.config.thresholds!.responseTime,
          performanceGrade: this.getPerformanceGrade(responseTime, this.config.thresholds!.responseTime),
          contentLength: response.headers.get('content-length')
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Performance',
        test: 'Page Load Performance',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test API response times
   */
  async testAPIPerformance(): Promise<TestResult> {
    try {
      const endpoints = [
        '/api/health',
        '/api/services',
        '/api/staff/availability'
      ]

      const results = []
      
      for (const endpoint of endpoints) {
        const startTime = Date.now()
        
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          headers: {
            'X-Correlation-Id': `${this.config.correlationId || 'test-api-perf'}-${endpoint.replace(/\//g, '-')}`
          }
        })

        const responseTime = Date.now() - startTime
        
        results.push({
          endpoint,
          responseTime,
          status: response.status,
          ok: response.ok
        })
      }

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      const maxResponseTime = Math.max(...results.map(r => r.responseTime))
      
      expect(maxResponseTime).toBeLessThan(3000) // 3 seconds max for any API
      expect(avgResponseTime).toBeLessThan(1000) // 1 second average
      
      const result: TestResult = {
        category: 'Performance',
        test: 'API Performance',
        status: 'pass',
        details: {
          endpoints: results,
          averageResponseTime: avgResponseTime,
          maxResponseTime,
          allEndpointsHealthy: results.every(r => r.ok)
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Performance',
        test: 'API Performance',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test resource optimization
   */
  async testResourceOptimization(): Promise<TestResult> {
    try {
      const response = await fetch(this.config.baseUrl, {
        headers: {
          'X-Correlation-Id': this.config.correlationId || 'test-resource-optimization'
        }
      })

      expect(response.ok).toBe(true)
      
      const contentLength = parseInt(response.headers.get('content-length') || '0')
      const contentEncoding = response.headers.get('content-encoding')
      const cacheControl = response.headers.get('cache-control')
      
      // Check for compression
      expect(contentEncoding).toBeTruthy() // Should have gzip or similar
      
      // Check for caching headers
      expect(cacheControl).toBeTruthy()
      
      // Content should be reasonably sized (under 2MB for main page)
      expect(contentLength).toBeLessThan(2 * 1024 * 1024)
      
      const result: TestResult = {
        category: 'Performance',
        test: 'Resource Optimization',
        status: 'pass',
        details: {
          contentLength,
          contentEncoding,
          cacheControl,
          compressionEnabled: !!contentEncoding,
          cachingEnabled: !!cacheControl,
          reasonableSize: contentLength < 2 * 1024 * 1024
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Performance',
        test: 'Resource Optimization',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Test CDN and asset delivery
   */
  async testAssetDelivery(): Promise<TestResult> {
    try {
      // Test main assets
      const assetTests = [
        { path: '/vite.svg', type: 'icon' },
        { path: '/manifest.webmanifest', type: 'manifest' }
      ]

      const results = []
      
      for (const asset of assetTests) {
        const startTime = Date.now()
        
        const response = await fetch(`${this.config.baseUrl}${asset.path}`, {
          headers: {
            'X-Correlation-Id': `${this.config.correlationId || 'test-asset-delivery'}-${asset.type}`
          }
        })

        const responseTime = Date.now() - startTime
        
        results.push({
          path: asset.path,
          type: asset.type,
          responseTime,
          status: response.status,
          ok: response.ok,
          cacheControl: response.headers.get('cache-control')
        })
      }

      const avgAssetTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      
      expect(avgAssetTime).toBeLessThan(2000) // 2 seconds for assets
      expect(results.every(r => r.ok)).toBe(true)
      
      const result: TestResult = {
        category: 'Performance',
        test: 'Asset Delivery',
        status: 'pass',
        details: {
          assets: results,
          averageAssetTime: avgAssetTime,
          allAssetsLoaded: results.every(r => r.ok),
          cachingOptimized: results.some(r => r.cacheControl?.includes('max-age'))
        }
      }
      
      this.addResult(result.category, result.test, result.status, result.details)
      return result
    } catch (error) {
      const result: TestResult = {
        category: 'Performance',
        test: 'Asset Delivery',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.addResult(result.category, result.test, result.status, undefined, result.error)
      return result
    }
  }

  /**
   * Get performance grade based on response time
   */
  private getPerformanceGrade(responseTime: number, threshold: number): string {
    const ratio = responseTime / threshold
    
    if (ratio <= 0.2) return 'Excellent'
    if (ratio <= 0.4) return 'Good'
    if (ratio <= 0.6) return 'Fair'
    if (ratio <= 0.8) return 'Poor'
    return 'Critical'
  }

  /**
   * Run all performance tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testPageLoadPerformance(),
      this.testAPIPerformance(),
      this.testResourceOptimization(),
      this.testAssetDelivery()
    ]

    const results = await Promise.allSettled(tests)
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          category: 'Performance',
          test: `Test ${index + 1}`,
          status: 'fail' as const,
          error: result.reason?.message || 'Test failed'
        }
      }
    })
  }
}