/**
 * SMS notification utilities
 * Handles SMS sending via Twilio
 */

import { Twilio } from 'twilio'

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  messagingServiceSid?: string
}

interface SMSData {
  to: string
  message: string
  from?: string
}

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  details?: any
}

export class SMSService {
  private client: Twilio | null = null
  private config: TwilioConfig

  constructor() {
    // Get configuration from environment variables
    this.config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
    }
  }

  private getClient(): Twilio {
    if (!this.client) {
      if (!this.config.accountSid || !this.config.authToken) {
        throw new Error('Twilio credentials not configured')
      }
      
      this.client = new Twilio(this.config.accountSid, this.config.authToken)
    }
    
    return this.client
  }

  async sendSMS(smsData: SMSData): Promise<SMSResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'SMS service not configured'
        }
      }

      const client = this.getClient()
      
      const messageOptions: any = {
        body: smsData.message,
        to: smsData.to
      }

      // Use messaging service if available, otherwise use phone number
      if (this.config.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.config.messagingServiceSid
      } else {
        messageOptions.from = smsData.from || this.config.phoneNumber
      }

      const message = await client.messages.create(messageOptions)
      
      return {
        success: true,
        messageId: message.sid,
        details: {
          status: message.status,
          direction: message.direction,
          errorCode: message.errorCode,
          errorMessage: message.errorMessage
        }
      }
    } catch (error) {
      console.error('SMS sending failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error',
        details: error
      }
    }
  }

  isConfigured(): boolean {
    return !!(
      this.config.accountSid && 
      this.config.authToken && 
      (this.config.phoneNumber || this.config.messagingServiceSid)
    )
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false
      }

      const client = this.getClient()
      
      // Test by fetching account info
      await client.api.accounts(this.config.accountSid).fetch()
      return true
    } catch (error) {
      console.error('Twilio connection test failed:', error)
      return false
    }
  }

  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '')
    
    // Add + prefix if not present and number doesn't start with country code
    if (!phone.startsWith('+')) {
      // Assume German number if it doesn't start with country code
      if (cleaned.startsWith('0')) {
        return '+49' + cleaned.slice(1)
      } else if (cleaned.length === 10 || cleaned.length === 11) {
        return '+49' + cleaned
      } else {
        return '+' + cleaned
      }
    }
    
    return phone
  }
}

export const smsService = new SMSService()