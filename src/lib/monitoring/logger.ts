/**
 * Structured Logging Library with Correlation ID Support
 * 
 * Provides vendor-agnostic structured logging with:
 * - Correlation ID tracking (X-Correlation-Id passthrough/generation)
 * - Consistent log levels and format
 * - Structured JSON output
 * - Performance metrics
 * - Error tracking integration
 * - PII/sensitive data redaction
 * - Log sampling for production efficiency
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

// Sampling configuration
interface SamplingConfig {
  enabled: boolean
  sampleRate: number // 0.0 to 1.0
  noisyComponents: string[] // Components to sample more aggressively
  noisyComponentSampleRate: number // Lower rate for noisy components
}

// PII redaction patterns
const PII_PATTERNS = [
  // Email patterns
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  // Phone patterns (various formats)
  { pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, replacement: '[PHONE_REDACTED]' },
  // Credit card patterns
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  // SSN patterns
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  // Generic tokens/keys (long alphanumeric strings that might be secrets)
  { pattern: /\b[a-zA-Z0-9]{32,}\b/g, replacement: '[TOKEN_REDACTED]' },
  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9._-]+/g, replacement: '[JWT_REDACTED]' },
  // API keys (common patterns)
  { pattern: /(api[_-]?key|access[_-]?token|secret|password)["\s]*[:=]["\s]*[a-zA-Z0-9._-]+/gi, replacement: '$1=[REDACTED]' },
]

// Secret field names to redact
const SECRET_FIELDS = [
  'password', 'passwd', 'secret', 'token', 'key', 'auth', 'authorization',
  'credential', 'credentials', 'apikey', 'api_key', 'access_token', 'refresh_token',
  'private_key', 'privatekey', 'client_secret', 'twilio_auth_token', 'smtp_password'
]

class Logger {
  private static instance: Logger
  private correlationId: string | null = null
  private readonly environment: string
  private readonly version: string
  private readonly samplingConfig: SamplingConfig

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.version = process.env.VITE_APP_VERSION || '1.0.0'
    
    // Initialize sampling configuration
    this.samplingConfig = {
      enabled: process.env.NODE_ENV === 'production',
      sampleRate: parseFloat(process.env.VITE_LOG_SAMPLE_RATE || '1.0'),
      noisyComponents: [
        'health-check', 'readiness-check', 'cors-preflight', 
        'rate-limiter', 'jwt-validation', 'static-asset'
      ],
      noisyComponentSampleRate: parseFloat(process.env.VITE_LOG_NOISY_SAMPLE_RATE || '0.1')
    }
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

  /**
   * Redact PII and sensitive information from any data
   */
  private redactSensitiveData(data: any): any {
    if (typeof data === 'string') {
      let redacted = data
      PII_PATTERNS.forEach(({ pattern, replacement }) => {
        redacted = redacted.replace(pattern, replacement)
      })
      return redacted
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item))
    }

    if (data && typeof data === 'object') {
      const redacted: any = {}
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase()
        
        // Check if field name indicates sensitive data
        if (SECRET_FIELDS.some(secretField => lowerKey.includes(secretField))) {
          redacted[key] = '[REDACTED]'
        } else {
          redacted[key] = this.redactSensitiveData(value)
        }
      }
      return redacted
    }

    return data
  }

  /**
   * Determine if log should be sampled (dropped)
   */
  private shouldSample(level: LogLevel, context: LogContext): boolean {
    if (!this.samplingConfig.enabled) {
      return false // Never sample in development
    }

    // Never sample errors or fatal logs
    if (level === 'error' || level === 'fatal') {
      return false
    }

    // Check if component is in noisy list
    const component = context.component?.toLowerCase() || ''
    const isNoisyComponent = this.samplingConfig.noisyComponents.some(noisy => 
      component.includes(noisy.toLowerCase())
    )

    const sampleRate = isNoisyComponent 
      ? this.samplingConfig.noisyComponentSampleRate 
      : this.samplingConfig.sampleRate

    return Math.random() > sampleRate
  }

  private createLogEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    const correlationId = context.correlationId || this.getCorrelationId()
    
    // Redact sensitive data from context
    const redactedContext = this.redactSensitiveData({
      ...context,
      correlationId
    })

    // Redact sensitive data from message
    const redactedMessage = this.redactSensitiveData(message)
    
    return {
      timestamp: new Date().toISOString(),
      level,
      message: redactedMessage,
      correlationId,
      context: redactedContext,
      environment: this.environment,
      version: this.version
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry)
  }

  private output(entry: LogEntry): void {
    // Check sampling before output
    if (this.shouldSample(entry.level, entry.context)) {
      return // Drop this log due to sampling
    }

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
      // Redact sensitive data from error
      const redactedError = {
        name: error.name,
        message: this.redactSensitiveData(error.message),
        stack: error.stack ? this.redactSensitiveData(error.stack) : undefined,
        code: (error as any).code
      }
      
      entry.error = redactedError
    }
    
    this.output(entry)
  }

  public fatal(message: string, error?: Error, context: LogContext = {}): void {
    const entry = this.createLogEntry('fatal', message, context)
    
    if (error) {
      // Redact sensitive data from error
      const redactedError = {
        name: error.name,
        message: this.redactSensitiveData(error.message),
        stack: error.stack ? this.redactSensitiveData(error.stack) : undefined,
        code: (error as any).code
      }
      
      entry.error = redactedError
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