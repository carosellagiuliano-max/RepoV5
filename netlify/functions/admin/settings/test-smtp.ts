/**
 * SMTP Test Function
 * Tests SMTP configuration by sending a test email
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, smtpTestSchema } from '../../../src/lib/validation/schemas'
import { createTransporter } from '../../../src/lib/email/smtp'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('SMTP test request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    if (event.httpMethod !== 'POST') {
      return createErrorResponse({
        statusCode: 405,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
    }

    try {
      return await handleSmtpTest(event, supabase, logger, context)
    } catch (error) {
      logger.error('SMTP test operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  {
    requireAdmin: true, // Only admins can test SMTP
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10 // Limit SMTP tests
    }
  }
)

async function handleSmtpTest(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  context: AuthenticatedContext
) {
  const body = validateBody(event, smtpTestSchema)
  if (!body.success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Invalid request body',
      code: 'INVALID_REQUEST_BODY',
      details: body.error
    })
  }

  const { to_email, subject, message } = body.data

  logger.info('Testing SMTP configuration', { 
    toEmail: to_email,
    adminId: context.user.id 
  })

  try {
    // Get SMTP settings from database
    const { data: smtpSettings, error: settingsError } = await supabase
      .from('business_settings')
      .select('key, value')
      .in('key', [
        'smtp_host',
        'smtp_port', 
        'smtp_user',
        'smtp_password',
        'smtp_from_email',
        'smtp_from_name',
        'smtp_use_tls'
      ])

    if (settingsError) {
      logger.error('Failed to fetch SMTP settings', { error: settingsError })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to fetch SMTP settings',
        code: 'FETCH_SMTP_SETTINGS_FAILED'
      })
    }

    // Convert settings array to object
    const settings = smtpSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    // Validate required SMTP settings
    const requiredSettings = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name']
    const missingSettings = requiredSettings.filter(key => !settings[key] || settings[key] === '""' || settings[key] === '')

    if (missingSettings.length > 0) {
      return createErrorResponse({
        statusCode: 400,
        message: 'SMTP configuration is incomplete',
        code: 'INCOMPLETE_SMTP_CONFIG',
        details: {
          missingSettings
        }
      })
    }

    // Create transporter with current settings
    const smtpConfig = {
      host: String(settings.smtp_host).replace(/"/g, ''),
      port: Number(settings.smtp_port),
      secure: settings.smtp_use_tls === true || settings.smtp_use_tls === 'true',
      auth: {
        user: String(settings.smtp_user).replace(/"/g, ''),
        pass: String(settings.smtp_password).replace(/"/g, '')
      }
    }

    const transporter = createTransporter(smtpConfig)

    // Verify SMTP connection
    await transporter.verify()
    logger.info('SMTP connection verified')

    // Send test email
    const mailOptions = {
      from: `${String(settings.smtp_from_name).replace(/"/g, '')} <${String(settings.smtp_from_email).replace(/"/g, '')}>`,
      to: to_email,
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>SMTP Test Email</h2>
          <p>${message}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is a test email sent from Schnittwerk Your Style admin panel.<br>
            Sent by: ${context.user.email}<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      `
    }

    const info = await transporter.sendMail(mailOptions)
    logger.info('Test email sent successfully', { 
      messageId: info.messageId,
      toEmail: to_email,
      adminId: context.user.id
    })

    return createSuccessResponse({
      data: {
        message: 'Test email sent successfully',
        messageId: info.messageId,
        sentTo: to_email,
        sentAt: new Date().toISOString()
      }
    })

  } catch (error: unknown) {
    logger.error('SMTP test failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string })?.code,
      command: (error as { command?: string })?.command
    })

    // Provide more specific error messages
    let errorMessage = 'SMTP test failed'
    let errorCode = 'SMTP_TEST_FAILED'
    
    const errorObj = error as { code?: string; message?: string }

    if (errorObj.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check username and password.'
      errorCode = 'SMTP_AUTH_FAILED'
    } else if (errorObj.code === 'ECONNECTION') {
      errorMessage = 'Cannot connect to SMTP server. Please check host and port.'
      errorCode = 'SMTP_CONNECTION_FAILED'
    } else if (errorObj.code === 'ESECURITY') {
      errorMessage = 'SMTP security error. Please check TLS settings.'
      errorCode = 'SMTP_SECURITY_ERROR'
    }

    return createErrorResponse({
      statusCode: 400,
      message: errorMessage,
      code: errorCode,
      details: {
        originalError: errorObj.message || 'Unknown error',
        errorCode: errorObj.code
      }
    })
  }
}