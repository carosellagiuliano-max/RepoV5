/**
 * SMTP Test Function
 * Server-side only email testing functionality
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { validateBody, smtpTestSchema } from '../../../src/lib/validation/schemas'
import * as nodemailer from 'nodemailer'

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

    logger.info('SMTP test request', {
      userId: context.user.id
    })

    try {
      // Validate request body
      const body = JSON.parse(event.body || '{}')
      const validation = smtpTestSchema.safeParse(body)

      if (!validation.success) {
        logger.warn('SMTP test validation failed', { errors: validation.error.issues })
        return createErrorResponse({
          statusCode: 400,
          message: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues
        })
      }

      const { to_email, subject, message } = validation.data

      // Get email settings from database
      const { data: emailSettings, error: settingsError } = await supabase
        .from('settings')
        .select('key, value')
        .eq('category', 'email')

      if (settingsError) {
        logger.error('Failed to fetch email settings', { error: settingsError })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch email settings',
          code: 'SETTINGS_ERROR'
        })
      }

      // Convert settings array to object
      const settings = emailSettings.reduce((acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      }, {} as Record<string, any>)

      // Validate we have all required SMTP settings
      const requiredSettings = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name']
      const missingSettings = requiredSettings.filter(key => !settings[key] || settings[key] === '""' || settings[key] === '')

      if (missingSettings.length > 0) {
        logger.warn('Missing SMTP settings', { missingSettings })
        return createErrorResponse({
          statusCode: 400,
          message: 'SMTP configuration incomplete',
          code: 'SMTP_CONFIG_INCOMPLETE',
          details: { missingSettings }
        })
      }

      // Create nodemailer transporter
      const transporter = nodemailer.createTransporter({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port),
        secure: parseInt(settings.smtp_port) === 465, // true for 465, false for other ports
        auth: {
          user: settings.smtp_username,
          pass: settings.smtp_password
        },
        tls: {
          rejectUnauthorized: settings.smtp_use_tls !== false
        }
      })

      // Verify SMTP connection
      try {
        await transporter.verify()
        logger.info('SMTP connection verified successfully')
      } catch (verifyError) {
        logger.error('SMTP connection verification failed', { error: verifyError })
        return createErrorResponse({
          statusCode: 400,
          message: 'SMTP connection failed',
          code: 'SMTP_CONNECTION_FAILED',
          details: { error: verifyError.message }
        })
      }

      // Send test email
      const mailOptions = {
        from: `${settings.smtp_from_name} <${settings.smtp_from_email}>`,
        to: to_email,
        subject: subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              SMTP Test Email
            </h2>
            <p style="color: #666; line-height: 1.6;">
              ${message}
            </p>
            <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
              <p style="margin: 0; color: #495057; font-size: 14px;">
                <strong>Test Details:</strong><br>
                Sent at: ${new Date().toLocaleString()}<br>
                From: ${settings.smtp_from_name} &lt;${settings.smtp_from_email}&gt;<br>
                SMTP Host: ${settings.smtp_host}:${settings.smtp_port}
              </p>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
              This is an automated test email from your Schnittwerk salon management system.
            </p>
          </div>
        `
      }

      const info = await transporter.sendMail(mailOptions)

      logger.info('Test email sent successfully', {
        messageId: info.messageId,
        to: to_email,
        userId: context.user.id
      })

      return createSuccessResponse({
        message: 'Test email sent successfully',
        data: {
          messageId: info.messageId,
          to: to_email,
          subject: subject,
          sentAt: new Date().toISOString()
        }
      })

    } catch (error) {
      logger.error('SMTP test failed', { error })
      
      // Handle specific nodemailer errors
      if (error.code === 'EAUTH') {
        return createErrorResponse({
          statusCode: 400,
          message: 'SMTP authentication failed',
          code: 'SMTP_AUTH_FAILED'
        })
      }
      
      if (error.code === 'ECONNECTION') {
        return createErrorResponse({
          statusCode: 400,
          message: 'Cannot connect to SMTP server',
          code: 'SMTP_CONNECTION_ERROR'
        })
      }

      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to send test email',
        code: 'SMTP_SEND_FAILED',
        details: { error: error.message }
      })
    }
  },
  {
    requiredRole: 'admin',
    rateLimitKey: 'smtp-test',
    maxRequests: 10, // More restrictive for email sending
    windowMs: 15 * 60 * 1000 // 15 minutes
  }
)