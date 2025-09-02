/**
 * SMTP Email Utilities
 * Provides email sending functionality using configured SMTP settings
 */

import * as nodemailer from 'nodemailer'

export interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailOptions {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

/**
 * Creates a nodemailer transporter with the given SMTP configuration
 */
export function createTransporter(config: SMTPConfig) {
  return nodemailer.createTransporter({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.auth.user,
      pass: config.auth.pass
    },
    // Add some sensible defaults
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000 // 60 seconds
  })
}

/**
 * Sends an email using the provided transporter
 */
export async function sendEmail(
  transporter: nodemailer.Transporter,
  options: EmailOptions
) {
  try {
    const info = await transporter.sendMail(options)
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    }
  } catch (error: any) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

/**
 * Validates SMTP configuration by attempting to connect
 */
export async function validateSMTPConfig(config: SMTPConfig): Promise<boolean> {
  const transporter = createTransporter(config)
  try {
    await transporter.verify()
    return true
  } catch (error) {
    return false
  } finally {
    transporter.close()
  }
}

/**
 * Common email templates
 */
export const EmailTemplates = {
  test: (message: string, senderEmail: string) => ({
    subject: 'SMTP Test Email - Schnittwerk Your Style',
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Schnittwerk Your Style</h1>
          <p style="color: #7f8c8d; margin: 5px 0;">SMTP Test Email</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Test Message</h2>
          <p style="color: #495057; line-height: 1.6;">${message}</p>
        </div>
        
        <div style="border-top: 1px solid #dee2e6; padding-top: 20px;">
          <p style="color: #6c757d; font-size: 14px; margin: 5px 0;">
            <strong>Test Details:</strong><br>
            Sent by: ${senderEmail}<br>
            Time: ${new Date().toLocaleString()}<br>
            System: Schnittwerk Your Style Admin Panel
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #adb5bd; font-size: 12px;">
            This is an automated test email. Please do not reply.
          </p>
        </div>
      </div>
    `
  }),

  bookingConfirmation: (
    customerName: string,
    serviceName: string,
    appointmentTime: string,
    staffName: string
  ) => ({
    subject: `Booking Confirmation - ${serviceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2c3e50;">Booking Confirmed!</h1>
        <p>Dear ${customerName},</p>
        <p>Your appointment has been confirmed:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${appointmentTime}</p>
          <p><strong>Staff:</strong> ${staffName}</p>
        </div>
        <p>We look forward to seeing you!</p>
        <p>Best regards,<br>Schnittwerk Your Style Team</p>
      </div>
    `
  }),

  bookingReminder: (
    customerName: string,
    serviceName: string,
    appointmentTime: string,
    staffName: string
  ) => ({
    subject: `Appointment Reminder - ${serviceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2c3e50;">Appointment Reminder</h1>
        <p>Dear ${customerName},</p>
        <p>This is a friendly reminder about your upcoming appointment:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${appointmentTime}</p>
          <p><strong>Staff:</strong> ${staffName}</p>
        </div>
        <p>We look forward to seeing you!</p>
        <p>Best regards,<br>Schnittwerk Your Style Team</p>
      </div>
    `
  })
}