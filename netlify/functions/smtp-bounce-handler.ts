import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

interface BouncedEmail {
  email: string
  bounceType: 'hard' | 'soft' | 'undetermined'
  bounceSubType?: string
  timestamp: Date
  diagnosticCode?: string
  feedbackId?: string
  originalMessageId?: string
  reason?: string
}

interface ComplaintEmail {
  email: string
  complaintType: string
  timestamp: Date
  feedbackId?: string
  originalMessageId?: string
}

/**
 * Generic SMTP bounce handler that can process various formats
 * Supports AWS SES, Mailgun, SendGrid, and generic bounce formats
 */
export async function handler(event: NetlifyEvent, context: Context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const contentType = event.headers['content-type'] || ''
    let bounceData: any

    // Parse different content types
    if (contentType.includes('application/json')) {
      bounceData = JSON.parse(event.body)
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      bounceData = parseFormData(event.body)
    } else {
      // Try to parse as JSON by default
      try {
        bounceData = JSON.parse(event.body)
      } catch {
        bounceData = { rawBody: event.body }
      }
    }

    console.log('Received bounce webhook:', JSON.stringify(bounceData, null, 2))

    // Determine the provider and process accordingly
    const provider = detectProvider(bounceData, event.headers)
    const result = await processBounceWebhook(provider, bounceData)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Bounce processed successfully',
        provider,
        data: result
      })
    }

  } catch (error) {
    console.error('Bounce webhook processing error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Bounce processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

function parseFormData(body: string): any {
  const params = new URLSearchParams(body)
  const data: any = {}
  
  for (const [key, value] of params.entries()) {
    data[key] = value
  }
  
  return data
}

function detectProvider(data: any, headers: Record<string, string>): string {
  // Check headers first
  if (headers['user-agent']?.includes('Amazon')) return 'ses'
  if (headers['user-agent']?.includes('Mailgun')) return 'mailgun'
  if (headers['user-agent']?.includes('SendGrid')) return 'sendgrid'

  // Check data structure
  if (data.Type && data.Message) return 'ses' // AWS SES SNS format
  if (data['event-data'] || data.event) return 'mailgun'
  if (data.sg_message_id || data.sg_event_id) return 'sendgrid'
  if (data.bounce || data.complaint) return 'ses' // Direct SES format

  return 'generic'
}

async function processBounceWebhook(provider: string, data: any): Promise<any> {
  let bounces: BouncedEmail[] = []
  let complaints: ComplaintEmail[] = []

  switch (provider) {
    case 'ses':
      ({ bounces, complaints } = await processSESBounce(data))
      break
    case 'mailgun':
      ({ bounces, complaints } = await processMailgunBounce(data))
      break
    case 'sendgrid':
      ({ bounces, complaints } = await processSendGridBounce(data))
      break
    default:
      ({ bounces, complaints } = await processGenericBounce(data))
      break
  }

  // Process bounced emails
  for (const bounce of bounces) {
    await handleBouncedEmail(bounce, provider)
  }

  // Process complaints
  for (const complaint of complaints) {
    await handleComplaintEmail(complaint, provider)
  }

  return {
    processedBounces: bounces.length,
    processedComplaints: complaints.length,
    provider
  }
}

async function processSESBounce(data: any): Promise<{ bounces: BouncedEmail[]; complaints: ComplaintEmail[] }> {
  const bounces: BouncedEmail[] = []
  const complaints: ComplaintEmail[] = []

  // Handle SNS message format
  if (data.Type === 'Notification' && data.Message) {
    const message = JSON.parse(data.Message)
    return processSESBounce(message)
  }

  // Handle direct bounce message
  if (data.bounce) {
    const bounce = data.bounce
    for (const recipient of bounce.bouncedRecipients || []) {
      bounces.push({
        email: recipient.emailAddress,
        bounceType: bounce.bounceType === 'Permanent' ? 'hard' : 'soft',
        bounceSubType: bounce.bounceSubType,
        timestamp: new Date(bounce.timestamp),
        diagnosticCode: recipient.diagnosticCode,
        originalMessageId: data.mail?.messageId,
        reason: recipient.action || bounce.bounceSubType
      })
    }
  }

  // Handle complaint message
  if (data.complaint) {
    const complaint = data.complaint
    for (const recipient of complaint.complainedRecipients || []) {
      complaints.push({
        email: recipient.emailAddress,
        complaintType: complaint.complaintFeedbackType || 'abuse',
        timestamp: new Date(complaint.timestamp),
        feedbackId: complaint.feedbackId,
        originalMessageId: data.mail?.messageId
      })
    }
  }

  return { bounces, complaints }
}

async function processMailgunBounce(data: any): Promise<{ bounces: BouncedEmail[]; complaints: ComplaintEmail[] }> {
  const bounces: BouncedEmail[] = []
  const complaints: ComplaintEmail[] = []

  const eventData = data['event-data'] || data
  
  if (eventData.event === 'bounced' || eventData.event === 'failed') {
    const bounceType = eventData.severity === 'permanent' ? 'hard' : 'soft'
    
    bounces.push({
      email: eventData.recipient,
      bounceType,
      timestamp: new Date(eventData.timestamp * 1000), // Mailgun uses Unix timestamp
      diagnosticCode: eventData['delivery-status']?.description,
      reason: eventData.reason,
      originalMessageId: eventData.message?.headers?.['message-id']
    })
  }

  if (eventData.event === 'complained') {
    complaints.push({
      email: eventData.recipient,
      complaintType: 'abuse',
      timestamp: new Date(eventData.timestamp * 1000),
      originalMessageId: eventData.message?.headers?.['message-id']
    })
  }

  return { bounces, complaints }
}

async function processSendGridBounce(data: any): Promise<{ bounces: BouncedEmail[]; complaints: ComplaintEmail[] }> {
  const bounces: BouncedEmail[] = []
  const complaints: ComplaintEmail[] = []

  // SendGrid sends arrays of events
  const events = Array.isArray(data) ? data : [data]

  for (const event of events) {
    if (event.event === 'bounce' || event.event === 'blocked') {
      const bounceType = event.type === 'bounce' ? 'hard' : 'soft'
      
      bounces.push({
        email: event.email,
        bounceType,
        timestamp: new Date(event.timestamp * 1000), // SendGrid uses Unix timestamp
        reason: event.reason,
        originalMessageId: event.sg_message_id
      })
    }

    if (event.event === 'spamreport') {
      complaints.push({
        email: event.email,
        complaintType: 'spam',
        timestamp: new Date(event.timestamp * 1000),
        originalMessageId: event.sg_message_id
      })
    }
  }

  return { bounces, complaints }
}

async function processGenericBounce(data: any): Promise<{ bounces: BouncedEmail[]; complaints: ComplaintEmail[] }> {
  const bounces: BouncedEmail[] = []
  const complaints: ComplaintEmail[] = []

  // Try to extract email and bounce info from generic format
  if (data.email || data.recipient) {
    const email = data.email || data.recipient
    const bounceType = data.permanent || data.bounceType === 'hard' ? 'hard' : 'soft'
    
    bounces.push({
      email,
      bounceType,
      timestamp: new Date(data.timestamp || Date.now()),
      reason: data.reason || data.message || 'Unknown bounce',
      diagnosticCode: data.diagnosticCode || data.error
    })
  }

  return { bounces, complaints }
}

async function handleBouncedEmail(bounce: BouncedEmail, provider: string): Promise<void> {
  console.log(`Processing bounce: ${bounce.email} (${bounce.bounceType})`)

  try {
    // Store webhook event
    const { data: webhookId, error: webhookError } = await supabase
      .rpc('process_webhook_event', {
        p_provider: provider,
        p_provider_event_id: bounce.feedbackId || `bounce-${Date.now()}`,
        p_event_type: 'bounce',
        p_provider_message_id: bounce.originalMessageId || null,
        p_event_data: bounce,
        p_status: 'bounced',
        p_error_code: bounce.bounceSubType || bounce.bounceType,
        p_error_message: bounce.reason || bounce.diagnosticCode
      })

    if (webhookError) {
      console.error('Error storing webhook event:', webhookError)
    }

    // Add to suppression list if hard bounce
    if (bounce.bounceType === 'hard') {
      const { error: suppressionError } = await supabase
        .from('notification_suppression')
        .insert({
          email: bounce.email,
          suppression_type: 'bounce',
          suppression_reason: `${bounce.bounceType} bounce: ${bounce.reason || bounce.diagnosticCode || 'Unknown'}`,
          suppression_source: 'bounce_handler'
        })
        .onConflict('email')
        .onConflictDoUpdate({
          suppression_reason: `${bounce.bounceType} bounce: ${bounce.reason || bounce.diagnosticCode || 'Unknown'}`,
          updated_at: new Date().toISOString()
        })

      if (suppressionError) {
        console.error('Error adding to suppression list:', suppressionError)
      } else {
        console.log(`Added ${bounce.email} to suppression list due to hard bounce`)
      }
    }

    // Try to find and update related notification
    if (bounce.originalMessageId) {
      await updateNotificationFromBounce(bounce.originalMessageId, bounce)
    }

  } catch (error) {
    console.error('Error handling bounced email:', error)
  }
}

async function handleComplaintEmail(complaint: ComplaintEmail, provider: string): Promise<void> {
  console.log(`Processing complaint: ${complaint.email}`)

  try {
    // Store webhook event
    const { error: webhookError } = await supabase
      .rpc('process_webhook_event', {
        p_provider: provider,
        p_provider_event_id: complaint.feedbackId || `complaint-${Date.now()}`,
        p_event_type: 'complaint',
        p_provider_message_id: complaint.originalMessageId || null,
        p_event_data: complaint,
        p_status: 'complaint',
        p_error_code: complaint.complaintType,
        p_error_message: `Spam complaint: ${complaint.complaintType}`
      })

    if (webhookError) {
      console.error('Error storing webhook event:', webhookError)
    }

    // Add to suppression list (complaints are always suppressed)
    const { error: suppressionError } = await supabase
      .from('notification_suppression')
      .insert({
        email: complaint.email,
        suppression_type: 'spam',
        suppression_reason: `Spam complaint: ${complaint.complaintType}`,
        suppression_source: 'bounce_handler'
      })
      .onConflict('email')
      .onConflictDoUpdate({
        suppression_reason: `Spam complaint: ${complaint.complaintType}`,
        updated_at: new Date().toISOString()
      })

    if (suppressionError) {
      console.error('Error adding to suppression list:', suppressionError)
    } else {
      console.log(`Added ${complaint.email} to suppression list due to spam complaint`)
    }

  } catch (error) {
    console.error('Error handling complaint email:', error)
  }
}

async function updateNotificationFromBounce(messageId: string, bounce: BouncedEmail): Promise<void> {
  try {
    // Find notification by message ID in audit log
    const { data: auditData, error: auditError } = await supabase
      .from('notification_audit')
      .select('notification_id')
      .or(`details->>'messageId'.eq.${messageId},details->>'provider_message_id'.eq.${messageId}`)
      .limit(1)

    if (auditError) {
      console.error('Error finding notification:', auditError)
      return
    }

    if (!auditData || auditData.length === 0) {
      console.warn(`No notification found for message ID: ${messageId}`)
      return
    }

    const notificationId = auditData[0].notification_id

    // Update notification status
    const { error } = await supabase
      .from('notification_queue')
      .update({
        status: 'failed',
        error_message: `Email bounced (${bounce.bounceType}): ${bounce.reason || bounce.diagnosticCode || 'Unknown'}`,
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (error) {
      console.error('Error updating notification status:', error)
    }

    // Add audit entry
    await supabase
      .from('notification_audit')
      .insert({
        notification_id: notificationId,
        event_type: 'bounce',
        details: {
          provider: 'smtp',
          bounce_type: bounce.bounceType,
          reason: bounce.reason,
          diagnostic_code: bounce.diagnosticCode,
          timestamp: bounce.timestamp.toISOString()
        }
      })

  } catch (error) {
    console.error('Error updating notification from bounce:', error)
  }
}