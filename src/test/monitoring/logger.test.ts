/**
 * Tests for the structured logging library
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logger, createRequestLogger, generateCorrelationId } from '../../lib/monitoring/logger'

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn()
}

// Replace console methods
Object.assign(console, mockConsole)

describe('Logger', () => {
  beforeEach(() => {
    // Clear all mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear())
    
    // Clear correlation ID
    logger.clearCorrelationId()
  })

  describe('Basic Logging', () => {
    it('should log with proper JSON structure', () => {
      logger.info('Test message')
      
      expect(mockConsole.info).toHaveBeenCalledTimes(1)
      
      const logOutput = mockConsole.info.mock.calls[0][0]
      const logEntry = JSON.parse(logOutput)
      
      expect(logEntry).toHaveProperty('timestamp')
      expect(logEntry).toHaveProperty('level', 'info')
      expect(logEntry).toHaveProperty('message', 'Test message')
      expect(logEntry).toHaveProperty('correlationId')
      expect(logEntry).toHaveProperty('context')
      expect(logEntry).toHaveProperty('environment')
      expect(logEntry).toHaveProperty('version')
    })

    it('should include correlation ID in every log entry', () => {
      const correlationId = 'test-correlation-id'
      logger.setCorrelationId(correlationId)
      
      logger.info('First message')
      logger.warn('Second message')
      
      const infoLogEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      const warnLogEntry = JSON.parse(mockConsole.warn.mock.calls[0][0])
      
      expect(infoLogEntry.correlationId).toBe(correlationId)
      expect(warnLogEntry.correlationId).toBe(correlationId)
    })

    it('should generate correlation ID if not set', () => {
      logger.info('Test message')
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.correlationId).toBeDefined()
      expect(logEntry.correlationId).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    })
  })

  describe('Error Logging', () => {
    it('should include error details when logging errors', () => {
      const testError = new Error('Test error message')
      testError.stack = 'Test stack trace'
      
      logger.error('Error occurred', testError)
      
      const logEntry = JSON.parse(mockConsole.error.mock.calls[0][0])
      
      expect(logEntry).toHaveProperty('error')
      expect(logEntry.error).toEqual({
        name: 'Error',
        message: 'Test error message',
        stack: 'Test stack trace',
        code: undefined
      })
    })

    it('should handle errors without stack trace', () => {
      const testError = new Error('Test error')
      delete testError.stack
      
      logger.error('Error without stack', testError)
      
      const logEntry = JSON.parse(mockConsole.error.mock.calls[0][0])
      
      expect(logEntry.error.stack).toBeUndefined()
    })
  })

  describe('Context Management', () => {
    it('should include context in log entries', () => {
      const context = {
        userId: 'user123',
        component: 'test-component',
        action: 'test-action',
        metadata: { key: 'value' }
      }
      
      logger.info('Test with context', context)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context).toMatchObject(context)
    })

    it('should merge context with correlation ID', () => {
      const correlationId = 'test-correlation-id'
      logger.setCorrelationId(correlationId)
      
      const context = { userId: 'user123' }
      logger.info('Test message', context)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context).toMatchObject({
        ...context,
        correlationId
      })
    })
  })

  describe('Child Logger', () => {
    it('should create child logger with pre-filled context', () => {
      const parentContext = { component: 'parent' }
      const childLogger = logger.child(parentContext)
      
      childLogger.info('Child message')
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context).toMatchObject(parentContext)
    })

    it('should merge child context with additional context', () => {
      const parentContext = { component: 'parent' }
      const childLogger = logger.child(parentContext)
      
      const additionalContext = { action: 'child-action' }
      childLogger.info('Child message', additionalContext)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context).toMatchObject({
        ...parentContext,
        ...additionalContext
      })
    })

    it('should allow nested child loggers', () => {
      const grandparentContext = { component: 'grandparent' }
      const parentContext = { subComponent: 'parent' }
      const childContext = { action: 'child-action' }
      
      const parentLogger = logger.child(grandparentContext)
      const childLogger = parentLogger.child(parentContext)
      
      childLogger.info('Nested message', childContext)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context).toMatchObject({
        ...grandparentContext,
        ...parentContext,
        ...childContext
      })
    })
  })

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const action = 'test-action'
      const duration = 1500
      const context = { component: 'test-component' }
      
      logger.performance(action, duration, context)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.message).toBe(`Performance: ${action}`)
      expect(logEntry.context).toMatchObject({
        ...context,
        action,
        duration,
        component: 'test-component'
      })
    })

    it('should set default component for performance logs', () => {
      logger.performance('test-action', 1000)
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.context.component).toBe('performance')
    })
  })

  describe('Async Performance Wrapper', () => {
    it('should log performance for successful async operations', async () => {
      const mockAsyncFn = vi.fn().mockResolvedValue('success')
      
      const result = await logger.withPerformance(
        'test-operation',
        mockAsyncFn,
        { component: 'test' }
      )
      
      expect(result).toBe('success')
      expect(mockAsyncFn).toHaveBeenCalledTimes(1)
      
      // Should have debug start message and performance end message
      expect(mockConsole.debug).toHaveBeenCalledTimes(1)
      expect(mockConsole.info).toHaveBeenCalledTimes(1)
      
      const startLog = JSON.parse(mockConsole.debug.mock.calls[0][0])
      const perfLog = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(startLog.message).toBe('Starting: test-operation')
      expect(perfLog.message).toBe('Performance: test-operation')
      expect(perfLog.context.duration).toBeGreaterThanOrEqual(0)
    })

    it('should log error and re-throw for failed async operations', async () => {
      const testError = new Error('Async operation failed')
      const mockAsyncFn = vi.fn().mockRejectedValue(testError)
      
      await expect(
        logger.withPerformance('test-operation', mockAsyncFn)
      ).rejects.toThrow('Async operation failed')
      
      // Should have debug start message and error message
      expect(mockConsole.debug).toHaveBeenCalledTimes(1)
      expect(mockConsole.error).toHaveBeenCalledTimes(1)
      
      const errorLog = JSON.parse(mockConsole.error.mock.calls[0][0])
      
      expect(errorLog.message).toBe('Failed: test-operation')
      expect(errorLog.context.duration).toBeGreaterThanOrEqual(0)
      expect(errorLog.error).toBeDefined()
    })
  })
})

describe('Request Logger Utilities', () => {
  beforeEach(() => {
    Object.values(mockConsole).forEach(mock => mock.mockClear())
  })

  describe('createRequestLogger', () => {
    it('should extract correlation ID from headers', () => {
      const headers = {
        'x-correlation-id': 'test-correlation-id',
        'user-agent': 'test-agent'
      }
      
      const requestLogger = createRequestLogger(headers)
      requestLogger.info('Request received')
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.correlationId).toBe('test-correlation-id')
      expect(logEntry.context.component).toBe('netlify-function')
    })

    it('should generate correlation ID if not in headers', () => {
      const headers = { 'user-agent': 'test-agent' }
      
      const requestLogger = createRequestLogger(headers)
      requestLogger.info('Request received')
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      expect(logEntry.correlationId).toBeDefined()
      expect(logEntry.correlationId).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('should handle case-insensitive header names', () => {
      const headers = {
        'X-Correlation-Id': 'uppercase-header-id',
        'correlation-id': 'lowercase-header-id'
      }
      
      const requestLogger = createRequestLogger(headers)
      requestLogger.info('Request received')
      
      const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
      
      // Should prefer x-correlation-id over X-Correlation-Id
      expect(logEntry.correlationId).toBe('uppercase-header-id')
    })
  })

  describe('generateCorrelationId', () => {
    it('should generate valid UUID v4', () => {
      const correlationId = generateCorrelationId()
      
      expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId()
      const id2 = generateCorrelationId()
      
      expect(id1).not.toBe(id2)
    })
  })
})

describe('Log Format Validation', () => {
  it('should ensure every log entry contains correlation ID', () => {
    // Clear any existing correlation ID to test auto-generation
    logger.clearCorrelationId()
    
    // Test various log levels
    logger.debug('Debug message')
    logger.info('Info message')  
    logger.warn('Warning message')
    logger.error('Error message')
    logger.fatal('Fatal message')
    
    // Check all log entries have correlation ID
    const allCalls = [
      ...mockConsole.debug.mock.calls,
      ...mockConsole.info.mock.calls,
      ...mockConsole.warn.mock.calls,
      ...mockConsole.error.mock.calls
    ]
    
    allCalls.forEach(call => {
      const logEntry = JSON.parse(call[0])
      expect(logEntry).toHaveProperty('correlationId')
      expect(logEntry.correlationId).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  it('should maintain consistent log structure across all levels', () => {
    const requiredFields = [
      'timestamp',
      'level',
      'message',
      'correlationId',
      'context',
      'environment',
      'version'
    ]
    
    logger.info('Test message')
    const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
    
    requiredFields.forEach(field => {
      expect(logEntry).toHaveProperty(field)
    })
  })

  it('should have valid timestamp format', () => {
    logger.info('Test message')
    const logEntry = JSON.parse(mockConsole.info.mock.calls[0][0])
    
    // Should be valid ISO 8601 timestamp
    const timestamp = new Date(logEntry.timestamp)
    expect(timestamp.toISOString()).toBe(logEntry.timestamp)
  })
})