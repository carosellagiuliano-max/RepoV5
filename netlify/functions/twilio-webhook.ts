import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string
  queryStringParameters?: Record<string, string>
}

interface TwilioWebhookEvent {
  MessageSid: string
  MessageStatus: string
  To: string
  From: string
  ErrorCode?: string
  ErrorMessage?: string
  AccountSid: string
  DateCreated?: string
  DateSent?: string
  DateUpdated?: string
  Direction?: string
  Body?: string
  Uri?: string
}

export async function handler(event: NetlifyEvent, context: Context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Verify Twilio signature if auth token is available
    if (twilioAuthToken) {
      const signature = event.headers['x-twilio-signature']
      if (!signature) {
        console.warn('Missing Twilio signature header')
      } else {
        const isValid = verifyTwilioSignature(
          twilioAuthToken,
          `https://${event.headers.host}${event.queryStringParameters?.path || '/.netlify/functions/twilio-webhook'}`,
          event.body,
          signature
        )
        
        if (!isValid) {
          console.error('Invalid Twilio signature')
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid signature' })
          }
        }
      }
    }

    // Parse webhook data
    const webhookData = parseFormData(event.body)
    console.log('Received Twilio webhook:', JSON.stringify(webhookData, null, 2))

    // Process the webhook event
    const result = await processTwilioWebhook(webhookData)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      })
    }

  } catch (error) {
    console.error('Twilio webhook processing error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

function verifyTwilioSignature(
  authToken: string,
  url: string,
  body: string,
  signature: string
): boolean {
  try {
    // Create the expected signature
    const data = url + body
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(data, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Error verifying Twilio signature:', error)
    return false
  }
}

function parseFormData(body: string): TwilioWebhookEvent {
  const params = new URLSearchParams(body)
  const data: any = {}
  
  for (const [key, value] of params.entries()) {
    data[key] = value
  }
  
  return data as TwilioWebhookEvent
}

async function processTwilioWebhook(webhookData: TwilioWebhookEvent): Promise<any> {
  const {
    MessageSid,
    MessageStatus,
    To,
    From,
    ErrorCode,
    ErrorMessage,
    AccountSid,
    DateSent,
    DateUpdated
  } = webhookData

  // Map Twilio status to our event types
  const eventType = mapTwilioStatusToEventType(MessageStatus)
  
  // Determine if this is a delivery success or failure
  const isSuccess = ['delivered', 'sent', 'received'].includes(MessageStatus.toLowerCase())
  const isFailure = ['failed', 'undelivered'].includes(MessageStatus.toLowerCase())

  try {
    // Process webhook using database function
    const { data, error } = await supabase
      .rpc('process_webhook_event', {
        p_provider: 'twilio',
        p_provider_event_id: MessageSid,
        p_event_type: eventType,
        p_provider_message_id: MessageSid,
        p_event_data: webhookData,
        p_status: MessageStatus,
        p_error_code: ErrorCode || null,
        p_error_message: ErrorMessage || null
      })

    if (error) {
      console.error('Database error processing webhook:', error)
      throw new Error(`Failed to process webhook: ${error.message}`)
    }

    // Handle specific status types
    if (isFailure) {
      await handleSMSFailure(MessageSid, ErrorCode, ErrorMessage, To)
    } else if (isSuccess) {
      await handleSMSSuccess(MessageSid, MessageStatus, To)
    }

    // Update notification status in our queue
    await updateNotificationStatus(MessageSid, MessageStatus, ErrorMessage)

    return {
      webhookId: data,
      messageSid: MessageSid,
      status: MessageStatus,
      processed: true
    }

  } catch (error) {
    console.error('Error processing Twilio webhook:', error)
    
    // Store the webhook event even if processing failed
    await storeFailedWebhook(webhookData, error instanceof Error ? error.message : 'Unknown error')
    
    throw error
  }
}

function mapTwilioStatusToEventType(status: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'queued',
    'sending': 'sending',
    'sent': 'sent',
    'received': 'sent',
    'delivered': 'delivered',
    'undelivered': 'bounce',
    'failed': 'failed',
    'accepted': 'accepted'
  }
  
  return statusMap[status.toLowerCase()] || 'unknown'
}

async function handleSMSFailure(
  messageSid: string,
  errorCode?: string,
  errorMessage?: string,
  recipient?: string
): Promise<void> {
  console.log(`SMS failure for ${messageSid}: ${errorCode} - ${errorMessage}`)

  // Check if this is a permanent failure that should trigger suppression
  const permanentErrorCodes = [
    '21211', // Invalid 'To' phone number
    '21212', // Invalid 'From' phone number  
    '21408', // Permission to send an SMS has not been enabled
    '21610', // Attempt to send to unsubscribed recipient
    '30003', // Unreachable destination handset
    '30004', // Message blocked
    '30005', // Unknown destination handset
    '30006', // Landline or unreachable carrier
    '30007', // Carrier violation
    '30008', // Unknown error
    '30009', // Missing segment
    '30010'  // Message price exceeds max price
  ]

  if (errorCode && permanentErrorCodes.includes(errorCode) && recipient) {
    // Add phone to suppression list
    try {
      const { error } = await supabase
        .from('notification_suppression')
        .insert({
          phone: recipient,
          suppression_type: 'invalid',
          suppression_reason: `Twilio error ${errorCode}: ${errorMessage}`,
          suppression_source: 'provider_feedback'
        })

      if (error) {
        console.error('Error adding phone to suppression list:', error)
      } else {
        console.log(`Added ${recipient} to suppression list due to error ${errorCode}`)
      }
    } catch (error) {
      console.error('Error processing suppression:', error)
    }
  }
}

async function handleSMSSuccess(
  messageSid: string,
  status: string,
  recipient?: string
): Promise<void> {
  console.log(`SMS success for ${messageSid}: ${status}`)
  
  // Could add success metrics tracking here
  // For now, just log the successful delivery
}

async function updateNotificationStatus(
  messageSid: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  try {
    // Find notification by provider message ID in audit log
    const { data: auditData, error: auditError } = await supabase
      .from('notification_audit')
      .select('notification_id')
      .or(`details->>'messageId'.eq.${messageSid},details->>'provider_message_id'.eq.${messageSid}`)
      .limit(1)

    if (auditError) {
      console.error('Error finding notification:', auditError)
      return
    }

    if (!auditData || auditData.length === 0) {
      console.warn(`No notification found for message ID: ${messageSid}`)
      return
    }

    const notificationId = auditData[0].notification_id

    // Update notification status based on Twilio status
    if (['delivered', 'sent', 'received'].includes(status.toLowerCase())) {
      const { error } = await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) {
        console.error('Error updating notification to sent:', error)
      }
    } else if (['failed', 'undelivered'].includes(status.toLowerCase())) {
      const { error } = await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: errorMessage || `Twilio status: ${status}`,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) {
        console.error('Error updating notification to failed:', error)
      }
    }

    // Add audit entry for the status update
    await supabase
      .from('notification_audit')
      .insert({
        notification_id: notificationId,
        event_type: 'provider_feedback',
        details: {
          provider: 'twilio',
          message_sid: messageSid,
          status: status,
          error_message: errorMessage
        }
      })

  } catch (error) {
    console.error('Error updating notification status:', error)
  }
}

async function storeFailedWebhook(
  webhookData: TwilioWebhookEvent,
  processingError: string
): Promise<void> {
  try {
    await supabase
      .from('notification_webhook_events')
      .insert({
        provider: 'twilio',
        provider_event_id: webhookData.MessageSid,
        event_type: mapTwilioStatusToEventType(webhookData.MessageStatus),
        provider_message_id: webhookData.MessageSid,
        event_data: webhookData,
        status: webhookData.MessageStatus,
        error_code: webhookData.ErrorCode,
        error_message: webhookData.ErrorMessage,
        processed: false,
        processing_error: processingError,
        webhook_verified: true
      })
  } catch (error) {
    console.error('Error storing failed webhook:', error)
  }
}