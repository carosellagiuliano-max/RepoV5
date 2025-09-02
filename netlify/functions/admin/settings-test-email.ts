/**
 * SMTP Test Email Function
 * Allows admins to test SMTP configuration by sending a test email
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../src/lib/auth/netlify-auth'
import { validateBody, schemas } from '../../src/lib/validation/schemas'
import nodemailer from 'nodemailer'

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    if (event.httpMethod !== 'POST') {
      return createErrorResponse({
        statusCode: 405,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
    }

    logger.info('SMTP test email request', {
      userId: context.user.id
    })

    try {
      const body = JSON.parse(event.body || '{}')
      const testData = validateBody(schemas.settings.testEmail, body)

      // Fetch SMTP settings from database
      const { data: smtpSettings, error: settingsError } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from_email', 'smtp.from_name'])

      if (settingsError) {
        logger.error('Failed to fetch SMTP settings', { error: settingsError })
        throw settingsError
      }

      if (!smtpSettings || smtpSettings.length === 0) {
        return createErrorResponse({
          statusCode: 400,
          message: 'SMTP settings not configured',
          code: 'SMTP_NOT_CONFIGURED'
        })
      }

      // Convert settings array to object
      const smtpConfig = smtpSettings.reduce((acc, setting) => {
        const key = setting.key.replace('smtp.', '')
        acc[key] = setting.value
        return acc
      }, {} as Record<string, unknown>)

      // Validate that all required SMTP settings are present
      const requiredKeys = ['host', 'port', 'user', 'password', 'from_email', 'from_name']
      const missingKeys = requiredKeys.filter(key => !smtpConfig[key] || smtpConfig[key] === '""' || smtpConfig[key] === '')

      if (missingKeys.length > 0) {
        return createErrorResponse({
          statusCode: 400,
          message: `Missing SMTP configuration: ${missingKeys.join(', ')}`,
          code: 'SMTP_INCOMPLETE_CONFIG'
        })
      }

      // Clean up string values (remove quotes if present)
      Object.keys(smtpConfig).forEach(key => {
        if (typeof smtpConfig[key] === 'string') {
          smtpConfig[key] = smtpConfig[key].replace(/^"(.*)"$/, '$1')
        }
      })

      // Create nodemailer transporter
      const transporter = nodemailer.createTransporter({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port),
        secure: parseInt(smtpConfig.port) === 465, // true for 465, false for other ports
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.password
        },
        timeout: 10000, // 10 second timeout
        connectionTimeout: 10000
      })

      // Verify SMTP connection
      await transporter.verify()

      // Send test email
      const mailOptions = {
        from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
        to: testData.to,
        subject: testData.subject,
        text: testData.body,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">SMTP Test Email</h2>
            <p style="color: #666; line-height: 1.6;">${testData.body}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              This is a test email sent from Schnittwerk Your Style admin panel.<br>
              Sent at: ${new Date().toLocaleString()}<br>
              Correlation ID: ${correlationId}
            </p>
          </div>
        `
      }

      const info = await transporter.sendMail(mailOptions)

      logger.info('Test email sent successfully', {
        to: testData.to,
        messageId: info.messageId,
        userId: context.user.id
      })

      return createSuccessResponse({
        message: 'Test email sent successfully',
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      })

    } catch (error: unknown) {
      logger.error('Failed to send test email', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id
      })

      // Provide more specific error messages for common SMTP issues
      let errorMessage = 'Failed to send test email'
      let errorCode = 'SMTP_ERROR'

      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code: string }).code
        if (errorCode === 'EAUTH') {
          errorMessage = 'SMTP authentication failed. Please check username and password.'
          errorCode = 'SMTP_AUTH_FAILED'
        } else if (errorCode === 'ENOTFOUND') {
          errorMessage = 'SMTP server not found. Please check the host address.'
          errorCode = 'SMTP_HOST_NOT_FOUND'
        } else if (errorCode === 'ECONNECTION') {
          errorMessage = 'Could not connect to SMTP server. Please check host and port.'
          errorCode = 'SMTP_CONNECTION_FAILED'
        } else if (errorCode === 'ETIMEDOUT') {
          errorMessage = 'SMTP connection timed out. Please check host and port.'
          errorCode = 'SMTP_TIMEOUT'
        }
      }

      const responseCode = error && typeof error === 'object' && 'responseCode' in error 
        ? (error as { responseCode: number }).responseCode 
        : 0

      if (responseCode >= 500) {
        errorMessage = 'SMTP server error. Please try again later.'
        errorCode = 'SMTP_SERVER_ERROR'
      } else if (responseCode >= 400) {
        errorMessage = 'SMTP request error. Please check your configuration.'
        errorCode = 'SMTP_REQUEST_ERROR'
      }

      return createErrorResponse({
        statusCode: 400,
        message: errorMessage,
        code: errorCode,
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          smtpCode: responseCode,
          smtpCommand: error && typeof error === 'object' && 'command' in error 
            ? (error as { command: string }).command 
            : undefined
        }
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 5, windowMs: 60 * 1000 } // Stricter rate limiting for email
)