/**
 * Email notification utilities
 * Handles email sending via SMTP
 */

import nodemailer from 'nodemailer'

interface SMTPConfig {
  host: string
  port: number
  secure?: boolean
  auth: {
    user: string
    pass: string
  }
}

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  details?: any
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: SMTPConfig
  private fromEmail: string
  private fromName: string

  constructor() {
    // Get configuration from environment variables
    this.config = {
      host: process.env.VITE_SMTP_HOST || '',
      port: parseInt(process.env.VITE_SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.VITE_SMTP_USER || '',
        pass: process.env.VITE_SMTP_PASSWORD || ''
      }
    }

    this.fromEmail = process.env.VITE_SMTP_FROM_EMAIL || 'noreply@example.com'
    this.fromName = process.env.VITE_SMTP_FROM_NAME || 'Salon'
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter(this.config)
      
      // Verify connection configuration
      try {
        await this.transporter.verify()
      } catch (error) {
        console.error('SMTP configuration error:', error)
        throw new Error('Failed to configure email service')
      }
    }
    
    return this.transporter
  }

  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      const transporter = await this.getTransporter()
      
      const mailOptions = {
        from: `"${emailData.fromName || this.fromName}" <${emailData.from || this.fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || this.htmlToText(emailData.html)
      }

      const info = await transporter.sendMail(mailOptions)
      
      return {
        success: true,
        messageId: info.messageId,
        details: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response
        }
      }
    } catch (error) {
      console.error('Email sending failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
        details: error
      }
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  async testConnection(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter()
      await transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP connection test failed:', error)
      return false
    }
  }
}

export const emailService = new EmailService()