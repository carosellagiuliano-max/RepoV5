/**
 * Structured Logging Library with Correlation ID Support
 * 
 * Provides vendor-agnostic structured logging with:
 * - Correlation ID tracking (X-Correlation-Id passthrough/generation)
 * - Consistent log levels and format
 * - Structured JSON output
 * - Performance metrics
 * - Error tracking integration
 */

import { v4 as uuidv4 } from 'uuid'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  correlationId?: string
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  action?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId: string
  context: LogContext
  environment: string
  version: string
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
}

class Logger {
  private static instance: Logger
  private correlationId: string | null = null
  private readonly environment: string
  private readonly version: string

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.version = process.env.VITE_APP_VERSION || '1.0.0'
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Set correlation ID for the current request/session
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  /**
   * Get or generate correlation ID
   */
  public getCorrelationId(): string {
    if (!this.correlationId) {
      this.correlationId = uuidv4()
    }
    return this.correlationId
  }

  /**
   * Clear correlation ID (useful between requests in server context)
   */
  public clearCorrelationId(): void {
    this.correlationId = null
  }

  /**
   * Extract correlation ID from request headers
   */
  public extractCorrelationId(headers: Record<string, string | undefined>): string {
    const correlationId = 
      headers['x-correlation-id'] || 
      headers['X-Correlation-Id'] || 
      headers['correlation-id'] ||
      uuidv4()
    
    this.setCorrelationId(correlationId)
    return correlationId
  }

  private createLogEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    const correlationId = context.correlationId || this.getCorrelationId()
    
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      context: {
        ...context,
        correlationId
      },
      environment: this.environment,
      version: this.version
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry)
  }

  private output(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry)
    
    // In production, all logs go to console for Netlify Functions
    // In development, use appropriate console method
    switch (entry.level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
      case 'fatal':
        console.error(formatted)
        break
      default:
        console.log(formatted)
    }
  }

  public debug(message: string, context: LogContext = {}): void {
    const entry = this.createLogEntry('debug', message, context)
    this.output(entry)
  }

  public info(message: string, context: LogContext = {}): void {
    const entry = this.createLogEntry('info', message, context)
    this.output(entry)
  }

  public warn(message: string, context: LogContext = {}): void {
    const entry = this.createLogEntry('warn', message, context)
    this.output(entry)
  }

  public error(message: string, error?: Error, context: LogContext = {}): void {
    const entry = this.createLogEntry('error', message, context)
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    }
    
    this.output(entry)
  }

  public fatal(message: string, error?: Error, context: LogContext = {}): void {
    const entry = this.createLogEntry('fatal', message, context)
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    }
    
    this.output(entry)
  }

  /**
   * Log performance metrics
   */
  public performance(action: string, duration: number, context: LogContext = {}): void {
    this.info(`Performance: ${action}`, {
      ...context,
      action,
      duration,
      component: context.component || 'performance'
    })
  }

  /**
   * Log with custom level
   */
  public log(level: LogLevel, message: string, context: LogContext = {}): void {
    const entry = this.createLogEntry(level, message, context)
    this.output(entry)
  }

  /**
   * Create a child logger with pre-filled context
   */
  public child(childContext: LogContext): ChildLogger {
    return new ChildLogger(this, childContext)
  }

  /**
   * Utility to wrap async functions with performance logging
   */
  public async withPerformance<T>(
    action: string,
    fn: () => Promise<T>,
    context: LogContext = {}
  ): Promise<T> {
    const startTime = Date.now()
    const correlationId = this.getCorrelationId()
    
    this.debug(`Starting: ${action}`, { ...context, action, correlationId })
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.performance(action, duration, { ...context, correlationId })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.error(`Failed: ${action}`, error as Error, { 
        ...context, 
        action, 
        duration, 
        correlationId 
      })
      throw error
    }
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private childContext: LogContext
  ) {}

  private mergeContext(context: LogContext = {}): LogContext {
    return { ...this.childContext, ...context }
  }

  public debug(message: string, context: LogContext = {}): void {
    this.parent.debug(message, this.mergeContext(context))
  }

  public info(message: string, context: LogContext = {}): void {
    this.parent.info(message, this.mergeContext(context))
  }

  public warn(message: string, context: LogContext = {}): void {
    this.parent.warn(message, this.mergeContext(context))
  }

  public error(message: string, error?: Error, context: LogContext = {}): void {
    this.parent.error(message, error, this.mergeContext(context))
  }

  public fatal(message: string, error?: Error, context: LogContext = {}): void {
    this.parent.fatal(message, error, this.mergeContext(context))
  }

  public performance(action: string, duration: number, context: LogContext = {}): void {
    this.parent.performance(action, duration, this.mergeContext(context))
  }

  public child(additionalContext: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(additionalContext))
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Export utilities for Netlify Functions
export const createRequestLogger = (headers: Record<string, string | undefined>) => {
  const requestLogger = Logger.getInstance()
  const correlationId = requestLogger.extractCorrelationId(headers)
  
  return requestLogger.child({
    correlationId,
    component: 'netlify-function'
  })
}

// Export correlation ID utilities
export const generateCorrelationId = () => uuidv4()

export const getCorrelationHeaders = (correlationId?: string) => ({
  'X-Correlation-Id': correlationId || generateCorrelationId()
})