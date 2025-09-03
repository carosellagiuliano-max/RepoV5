/**
 * Vendor-Agnostic Error Tracking Hook
 * 
 * Provides error tracking capabilities that can integrate with:
 * - Sentry (when configured)
 * - Structured logging
 * - Custom error handlers
 * - User notifications
 */

import { useCallback } from 'react'
import { logger } from '../lib/monitoring/logger'
import { toast } from 'sonner'

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  correlationId?: string
  metadata?: Record<string, any>
  severity?: 'low' | 'medium' | 'high' | 'critical'
  userFacing?: boolean
  recoverable?: boolean
}

export interface ErrorTrackingConfig {
  enableSentry?: boolean
  enableUserNotifications?: boolean
  enableConsoleLogging?: boolean
  enableStructuredLogging?: boolean
  sentryDsn?: string
}

interface TrackedError extends Error {
  context?: ErrorContext
  timestamp?: Date
  fingerprint?: string
}

class ErrorTracker {
  private static instance: ErrorTracker
  private config: ErrorTrackingConfig
  private sentryEnabled = false

  private constructor() {
    this.config = {
      enableSentry: false, // Will be enabled if Sentry is configured
      enableUserNotifications: true,
      enableConsoleLogging: true,
      enableStructuredLogging: true,
      sentryDsn: import.meta.env.VITE_SENTRY_DSN
    }

    this.initializeSentry()
  }

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  private async initializeSentry(): Promise<void> {
    if (this.config.sentryDsn && this.config.enableSentry) {
      try {
        // Dynamic import to avoid bundling Sentry if not needed
        const Sentry = await import('@sentry/browser')
        
        Sentry.init({
          dsn: this.config.sentryDsn,
          environment: import.meta.env.NODE_ENV || 'development',
          release: import.meta.env.VITE_APP_VERSION || '1.0.0',
          tracesSampleRate: import.meta.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          integrations: [
            new Sentry.BrowserTracing(),
          ],
          beforeSend: (event) => {
            // Filter out non-critical errors in production
            if (import.meta.env.NODE_ENV === 'production' && event.level === 'info') {
              return null
            }
            return event
          }
        })

        this.sentryEnabled = true
        logger.info('Sentry error tracking initialized', { 
          component: 'error-tracker',
          action: 'sentry-init'
        })
      } catch (error) {
        logger.warn('Failed to initialize Sentry', error as Error, {
          component: 'error-tracker',
          action: 'sentry-init-failed'
        })
      }
    }
  }

  private generateFingerprint(error: Error, context?: ErrorContext): string {
    const components = [
      error.name,
      error.message?.substring(0, 100),
      context?.component || 'unknown',
      context?.action || 'unknown'
    ]
    
    return btoa(components.join('|')).substring(0, 32)
  }

  private async sendToSentry(error: TrackedError): Promise<void> {
    if (!this.sentryEnabled) return

    try {
      const Sentry = await import('@sentry/browser')
      
      Sentry.withScope((scope) => {
        if (error.context) {
          scope.setContext('errorContext', error.context)
          scope.setLevel(this.mapSeverityToSentryLevel(error.context.severity))
          
          if (error.context.userId) {
            scope.setUser({ id: error.context.userId })
          }
          
          if (error.context.correlationId) {
            scope.setTag('correlationId', error.context.correlationId)
          }
          
          if (error.context.component) {
            scope.setTag('component', error.context.component)
          }
          
          if (error.context.action) {
            scope.setTag('action', error.context.action)
          }
          
          if (error.fingerprint) {
            scope.setFingerprint([error.fingerprint])
          }
        }
        
        Sentry.captureException(error)
      })
    } catch (sentryError) {
      logger.error('Failed to send error to Sentry', sentryError as Error, {
        component: 'error-tracker',
        action: 'sentry-send-failed'
      })
    }
  }

  private mapSeverityToSentryLevel(severity?: string): 'error' | 'warning' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'error'
    }
  }

  private showUserNotification(error: TrackedError): void {
    if (!this.config.enableUserNotifications || !error.context?.userFacing) {
      return
    }

    const severity = error.context.severity || 'medium'
    const isRecoverable = error.context.recoverable !== false

    let message = 'Ein unerwarteter Fehler ist aufgetreten.'
    let action = undefined

    if (isRecoverable) {
      message += ' Bitte versuchen Sie es erneut.'
    } else {
      message += ' Bitte kontaktieren Sie den Support.'
    }

    // Add correlation ID for support
    if (error.context.correlationId) {
      action = {
        label: 'ID kopieren',
        onClick: () => navigator.clipboard?.writeText(error.context!.correlationId!)
      }
    }

    switch (severity) {
      case 'critical':
      case 'high':
        toast.error(message, { action })
        break
      case 'medium':
        toast.error(message, { action })
        break
      case 'low':
        toast.warning(message, { action })
        break
    }
  }

  public async trackError(error: Error, context: ErrorContext = {}): Promise<void> {
    const trackedError: TrackedError = {
      ...error,
      context: {
        severity: 'medium',
        userFacing: false,
        recoverable: true,
        correlationId: logger.getCorrelationId(),
        ...context
      },
      timestamp: new Date(),
      fingerprint: this.generateFingerprint(error, context)
    }

    // Structured logging (always enabled)
    if (this.config.enableStructuredLogging) {
      const logLevel = context.severity === 'critical' || context.severity === 'high' ? 'error' : 'warn'
      logger.log(logLevel, `Error tracked: ${error.message}`, {
        component: context.component || 'error-tracker',
        action: context.action || 'error-tracked',
        correlationId: trackedError.context?.correlationId,
        metadata: {
          errorName: error.name,
          fingerprint: trackedError.fingerprint,
          severity: context.severity,
          userFacing: context.userFacing,
          recoverable: context.recoverable,
          ...context.metadata
        }
      })
    }

    // Console logging (development)
    if (this.config.enableConsoleLogging && import.meta.env.NODE_ENV === 'development') {
      console.group(`🔥 Error Tracked: ${error.name}`)
      console.error('Error:', error)
      console.log('Context:', context)
      console.log('Fingerprint:', trackedError.fingerprint)
      console.groupEnd()
    }

    // Send to Sentry (if configured)
    await this.sendToSentry(trackedError)

    // Show user notification (if applicable)
    this.showUserNotification(trackedError)
  }

  public setContext(context: Partial<ErrorContext>): void {
    // Store global context that will be merged with error-specific context
    if (this.sentryEnabled) {
      import('@sentry/browser').then(Sentry => {
        Sentry.configureScope((scope) => {
          if (context.userId) scope.setUser({ id: context.userId })
          if (context.component) scope.setTag('defaultComponent', context.component)
          if (context.correlationId) scope.setTag('defaultCorrelationId', context.correlationId)
        })
      })
    }
  }

  public updateConfig(newConfig: Partial<ErrorTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.enableSentry !== undefined || newConfig.sentryDsn !== undefined) {
      this.initializeSentry()
    }
  }
}

// Hook for React components
export const useErrorTracking = () => {
  const errorTracker = ErrorTracker.getInstance()

  const trackError = useCallback((error: Error, context: ErrorContext = {}) => {
    return errorTracker.trackError(error, context)
  }, [errorTracker])

  const setContext = useCallback((context: Partial<ErrorContext>) => {
    errorTracker.setContext(context)
  }, [errorTracker])

  const trackUserAction = useCallback(async (
    action: string,
    fn: () => Promise<void> | void,
    context: Omit<ErrorContext, 'action'> = {}
  ) => {
    try {
      await fn()
    } catch (error) {
      await trackError(error as Error, {
        ...context,
        action,
        userFacing: true,
        component: context.component || 'user-action'
      })
      throw error // Re-throw so component can handle it
    }
  }, [trackError])

  const trackAsyncOperation = useCallback(async <T>(
    operation: string,
    fn: () => Promise<T>,
    context: Omit<ErrorContext, 'action'> = {}
  ): Promise<T> => {
    try {
      logger.debug(`Starting async operation: ${operation}`, {
        component: context.component,
        action: operation,
        correlationId: context.correlationId
      })

      const result = await fn()
      
      logger.debug(`Completed async operation: ${operation}`, {
        component: context.component,
        action: operation,
        correlationId: context.correlationId
      })

      return result
    } catch (error) {
      await trackError(error as Error, {
        ...context,
        action: operation,
        severity: 'medium',
        component: context.component || 'async-operation'
      })
      throw error
    }
  }, [trackError])

  return {
    trackError,
    setContext,
    trackUserAction,
    trackAsyncOperation
  }
}

// Export singleton for direct use
export const errorTracker = ErrorTracker.getInstance()

// Export error boundary helper
export const createErrorBoundary = (component: string) => {
  return (error: Error, errorInfo: { componentStack: string }) => {
    errorTracker.trackError(error, {
      component,
      action: 'component-error',
      severity: 'high',
      userFacing: true,
      metadata: {
        componentStack: errorInfo.componentStack
      }
    })
  }
}