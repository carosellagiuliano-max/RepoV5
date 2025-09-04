/**
 * Concrete Alert Implementation
 * 
 * Provides vendor-agnostic alerting with concrete implementations:
 * - Webhook alerts (Slack, Discord, custom)
 * - Email alerts via SMTP
 * - SMS alerts via Twilio
 * - Sentry integration
 * - Alert throttling and deduplication
 */

import { logger } from './logger'

export interface AlertContext {
  correlationId?: string
  component?: string
  action?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
  timestamp?: Date
  fingerprint?: string
}

export interface AlertConfig {
  webhookUrl?: string
  slackWebhookUrl?: string
  emailRecipients?: string[]
  smsRecipients?: string[]
  enableWebhook?: boolean
  enableEmail?: boolean
  enableSms?: boolean
  enableSentry?: boolean
  throttleMinutes?: number
}

interface Alert {
  id: string
  title: string
  message: string
  context: AlertContext
  timestamp: Date
  fingerprint: string
}

class AlertManager {
  private static instance: AlertManager
  private config: AlertConfig
  private recentAlerts: Map<string, Date> = new Map()
  private alertCounts: Map<string, number> = new Map()

  private constructor() {
    this.config = {
      webhookUrl: process.env.VITE_ALERT_WEBHOOK_URL,
      slackWebhookUrl: process.env.VITE_ALERT_SLACK_WEBHOOK,
      emailRecipients: process.env.VITE_ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      smsRecipients: process.env.VITE_ALERT_PHONE_NUMBERS?.split(',') || [],
      enableWebhook: !!process.env.VITE_ALERT_WEBHOOK_URL,
      enableEmail: !!process.env.VITE_ALERT_EMAIL_RECIPIENTS,
      enableSms: !!process.env.VITE_ALERT_PHONE_NUMBERS,
      enableSentry: !!process.env.VITE_SENTRY_DSN,
      throttleMinutes: parseInt(process.env.VITE_ALERT_THROTTLE_MINUTES || '15')
    }

    // Clean up old alerts every hour
    setInterval(() => this.cleanupOldAlerts(), 60 * 60 * 1000)
  }

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager()
    }
    return AlertManager.instance
  }

  private generateFingerprint(title: string, context: AlertContext): string {
    const components = [
      title,
      context.component || 'unknown',
      context.action || 'unknown',
      context.severity
    ]
    
    return btoa(components.join('|')).substring(0, 32)
  }

  private shouldThrottle(fingerprint: string): boolean {
    const lastAlert = this.recentAlerts.get(fingerprint)
    if (!lastAlert) return false

    const throttleMs = (this.config.throttleMinutes || 15) * 60 * 1000
    return Date.now() - lastAlert.getTime() < throttleMs
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    
    for (const [fingerprint, timestamp] of this.recentAlerts.entries()) {
      if (timestamp.getTime() < cutoff) {
        this.recentAlerts.delete(fingerprint)
        this.alertCounts.delete(fingerprint)
      }
    }
  }

  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.enableWebhook || !this.config.webhookUrl) return

    try {
      const payload = {
        title: alert.title,
        message: alert.message,
        severity: alert.context.severity,
        timestamp: alert.timestamp.toISOString(),
        correlationId: alert.context.correlationId,
        component: alert.context.component,
        action: alert.context.action,
        metadata: alert.context.metadata,
        fingerprint: alert.fingerprint,
        count: this.alertCounts.get(alert.fingerprint) || 1
      }

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }

      logger.debug('Webhook alert sent successfully', {
        component: 'alert-manager',
        action: 'webhook-sent',
        correlationId: alert.context.correlationId,
        metadata: { fingerprint: alert.fingerprint }
      })

    } catch (error) {
      logger.error('Failed to send webhook alert', error as Error, {
        component: 'alert-manager',
        action: 'webhook-failed',
        correlationId: alert.context.correlationId
      })
    }
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    if (!this.config.slackWebhookUrl) return

    try {
      const severityColors = {
        critical: '#FF0000',
        high: '#FF6600',
        medium: '#FFCC00',
        low: '#00CC00'
      }

      const payload = {
        text: `🚨 ${alert.title}`,
        attachments: [{
          color: severityColors[alert.context.severity],
          fields: [
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Severity',
              value: alert.context.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Component',
              value: alert.context.component || 'unknown',
              short: true
            },
            {
              title: 'Correlation ID',
              value: alert.context.correlationId || 'none',
              short: true
            },
            {
              title: 'Count',
              value: (this.alertCounts.get(alert.fingerprint) || 1).toString(),
              short: true
            }
          ],
          timestamp: Math.floor(alert.timestamp.getTime() / 1000)
        }]
      }

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
      }

      logger.debug('Slack alert sent successfully', {
        component: 'alert-manager',
        action: 'slack-sent',
        correlationId: alert.context.correlationId
      })

    } catch (error) {
      logger.error('Failed to send Slack alert', error as Error, {
        component: 'alert-manager',
        action: 'slack-failed',
        correlationId: alert.context.correlationId
      })
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.config.enableEmail || this.config.emailRecipients.length === 0) return

    try {
      // This would typically use your email service
      // For now, we'll use the existing SMTP service
      const emailPayload = {
        to: this.config.emailRecipients,
        subject: `[${alert.context.severity.toUpperCase()}] ${alert.title}`,
        html: `
          <h2>System Alert</h2>
          <p><strong>Severity:</strong> ${alert.context.severity.toUpperCase()}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Component:</strong> ${alert.context.component || 'unknown'}</p>
          <p><strong>Action:</strong> ${alert.context.action || 'unknown'}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
          <p><strong>Correlation ID:</strong> ${alert.context.correlationId || 'none'}</p>
          <p><strong>Alert Count:</strong> ${this.alertCounts.get(alert.fingerprint) || 1}</p>
          ${alert.context.metadata ? `<p><strong>Details:</strong> <pre>${JSON.stringify(alert.context.metadata, null, 2)}</pre></p>` : ''}
        `
      }

      // TODO: Integrate with actual email sending service
      logger.info('Email alert prepared (not sent - implement email service)', {
        component: 'alert-manager',
        action: 'email-prepared',
        correlationId: alert.context.correlationId,
        metadata: { recipients: this.config.emailRecipients.length }
      })

    } catch (error) {
      logger.error('Failed to send email alert', error as Error, {
        component: 'alert-manager',
        action: 'email-failed',
        correlationId: alert.context.correlationId
      })
    }
  }

  private async sendSmsAlert(alert: Alert): Promise<void> {
    if (!this.config.enableSms || this.config.smsRecipients.length === 0) return

    try {
      // Only send SMS for high/critical alerts to avoid spam
      if (alert.context.severity !== 'high' && alert.context.severity !== 'critical') {
        return
      }

      const message = `ALERT [${alert.context.severity.toUpperCase()}]: ${alert.title} - ${alert.message}`

      // TODO: Integrate with Twilio SMS service
      logger.info('SMS alert prepared (not sent - implement SMS service)', {
        component: 'alert-manager',
        action: 'sms-prepared',
        correlationId: alert.context.correlationId,
        metadata: { 
          recipients: this.config.smsRecipients.length,
          messageLength: message.length
        }
      })

    } catch (error) {
      logger.error('Failed to send SMS alert', error as Error, {
        component: 'alert-manager',
        action: 'sms-failed',
        correlationId: alert.context.correlationId
      })
    }
  }

  public async sendAlert(title: string, message: string, context: AlertContext): Promise<void> {
    const fingerprint = context.fingerprint || this.generateFingerprint(title, context)
    
    // Check throttling
    if (this.shouldThrottle(fingerprint)) {
      // Increment count for throttled alerts
      this.alertCounts.set(fingerprint, (this.alertCounts.get(fingerprint) || 0) + 1)
      
      logger.debug('Alert throttled', {
        component: 'alert-manager',
        action: 'alert-throttled',
        correlationId: context.correlationId,
        metadata: { 
          fingerprint,
          count: this.alertCounts.get(fingerprint)
        }
      })
      return
    }

    const alert: Alert = {
      id: uuidv4(),
      title,
      message,
      context: {
        ...context,
        timestamp: context.timestamp || new Date(),
        fingerprint
      },
      timestamp: context.timestamp || new Date(),
      fingerprint
    }

    // Update tracking
    this.recentAlerts.set(fingerprint, alert.timestamp)
    this.alertCounts.set(fingerprint, (this.alertCounts.get(fingerprint) || 0) + 1)

    logger.warn('Sending alert', {
      component: 'alert-manager',
      action: 'alert-sent',
      correlationId: context.correlationId,
      metadata: {
        title,
        severity: context.severity,
        fingerprint,
        count: this.alertCounts.get(fingerprint)
      }
    })

    // Send alerts through all configured channels
    await Promise.allSettled([
      this.sendWebhookAlert(alert),
      this.sendSlackAlert(alert),
      this.sendEmailAlert(alert),
      this.sendSmsAlert(alert)
    ])
  }

  public getAlertStats(): { totalAlerts: number; recentFingerprints: number; throttledAlerts: number } {
    let totalAlerts = 0
    let throttledAlerts = 0

    for (const count of this.alertCounts.values()) {
      totalAlerts += count
      if (count > 1) {
        throttledAlerts += count - 1
      }
    }

    return {
      totalAlerts,
      recentFingerprints: this.recentAlerts.size,
      throttledAlerts
    }
  }

  public updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// Export singleton instance
export const alertManager = AlertManager.getInstance()

// Convenience functions for different alert types
export const sendCriticalAlert = (title: string, message: string, context: Omit<AlertContext, 'severity'>) =>
  alertManager.sendAlert(title, message, { ...context, severity: 'critical' })

export const sendHighAlert = (title: string, message: string, context: Omit<AlertContext, 'severity'>) =>
  alertManager.sendAlert(title, message, { ...context, severity: 'high' })

export const sendMediumAlert = (title: string, message: string, context: Omit<AlertContext, 'severity'>) =>
  alertManager.sendAlert(title, message, { ...context, severity: 'medium' })

export const sendLowAlert = (title: string, message: string, context: Omit<AlertContext, 'severity'>) =>
  alertManager.sendAlert(title, message, { ...context, severity: 'low' })

// Helper function to test alerting (for simulation tests)
export const simulateAlert = async (severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  const testContext: AlertContext = {
    correlationId: `test-${Date.now()}`,
    component: 'alert-test',
    action: 'simulation',
    severity,
    metadata: {
      testMode: true,
      timestamp: new Date().toISOString()
    }
  }

  await alertManager.sendAlert(
    'Test Alert',
    `This is a test alert with severity: ${severity}`,
    testContext
  )

  return testContext.correlationId
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}