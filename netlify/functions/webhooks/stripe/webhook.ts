import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface StripeWebhookPayload {
  id: string
  object: 'event'
  api_version: string
  created: number
  data: {
    object: any
    previous_attributes?: any
  }
  livemode: boolean
  pending_webhooks: number
  request: {
    id: string | null
    idempotency_key: string | null
  }
  type: string
}

/**
 * Stripe Webhook Handler
 * Processes Stripe webhook events with signature verification and idempotency
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Stripe webhook received:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? 'present' : 'missing'
  })

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Verify webhook signature
    const signature = event.headers['stripe-signature']
    if (!signature) {
      console.error('Missing Stripe signature')
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing signature' })
      }
    }

    let stripeEvent: Stripe.Event

    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body!,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid signature' })
      }
    }

    console.log('Verified Stripe event:', {
      id: stripeEvent.id,
      type: stripeEvent.type,
      created: stripeEvent.created
    })

    // Check for duplicate events (idempotency)
    const existingEvent = await checkEventIdempotency(stripeEvent.id)
    if (existingEvent) {
      console.log('Event already processed:', stripeEvent.id)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          message: 'Event already processed',
          eventId: stripeEvent.id
        })
      }
    }

    // Process the webhook event
    const result = await processStripeWebhook(stripeEvent)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        eventId: stripeEvent.id,
        result
      })
    }

  } catch (error) {
    console.error('Stripe webhook processing error:', error)
    
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

/**
 * Check if webhook event has already been processed
 */
async function checkEventIdempotency(eventId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('payment_events')
      .select('id')
      .eq('stripe_event_id', eventId)
      .eq('processed', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking event idempotency:', error)
      return false
    }

    return data !== null
  } catch (error) {
    console.error('Error checking event idempotency:', error)
    return false
  }
}

/**
 * Process Stripe webhook event based on type
 */
async function processStripeWebhook(event: Stripe.Event): Promise<any> {
  console.log(`Processing event type: ${event.type}`)

  switch (event.type) {
    case 'payment_intent.created':
      return await handlePaymentIntentCreated(event)
    
    case 'payment_intent.requires_action':
      return await handlePaymentIntentRequiresAction(event)
    
    case 'payment_intent.processing':
      return await handlePaymentIntentProcessing(event)
    
    case 'payment_intent.succeeded':
      return await handlePaymentIntentSucceeded(event)
    
    case 'payment_intent.payment_failed':
      return await handlePaymentIntentFailed(event)
    
    case 'payment_intent.canceled':
      return await handlePaymentIntentCanceled(event)
    
    case 'charge.captured':
      return await handleChargeCaptured(event)
    
    case 'charge.dispute.created':
      return await handleChargeDisputeCreated(event)
    
    case 'invoice.payment_succeeded':
      return await handleInvoicePaymentSucceeded(event)
    
    case 'invoice.payment_failed':
      return await handleInvoicePaymentFailed(event)
    
    default:
      console.log(`Unhandled event type: ${event.type}`)
      // Still log unhandled events for audit purposes
      return await logWebhookEvent(event, 'webhook_received', {})
  }
}

/**
 * Handle payment_intent.created event
 */
async function handlePaymentIntentCreated(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  return await logWebhookEvent(event, 'payment_intent_created', {
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status
  })
}

/**
 * Handle payment_intent.requires_action event (SCA/3DS)
 */
async function handlePaymentIntentRequiresAction(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  // Update payment status to requires_action
  await updatePaymentStatus(
    paymentIntent.id,
    'requires_action',
    {
      next_action: paymentIntent.next_action,
      client_secret: paymentIntent.client_secret
    }
  )
  
  return await logWebhookEvent(event, 'payment_confirmed', {
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    next_action: paymentIntent.next_action
  })
}

/**
 * Handle payment_intent.processing event
 */
async function handlePaymentIntentProcessing(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  await updatePaymentStatus(paymentIntent.id, 'processing')
  
  return await logWebhookEvent(event, 'payment_confirmed', {
    amount: paymentIntent.amount,
    status: paymentIntent.status
  })
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  // Update payment status and capture financial details
  const charge = paymentIntent.charges?.data?.[0] as Stripe.Charge
  
  await updatePaymentStatus(
    paymentIntent.id,
    'succeeded',
    {
      stripe_charge_id: charge?.id,
      card_last4: charge?.payment_method_details?.card?.last4,
      card_brand: charge?.payment_method_details?.card?.brand,
      card_funding: charge?.payment_method_details?.card?.funding,
      fee_cents: charge?.balance_transaction ? 
        await getBalanceTransactionFee(charge.balance_transaction as string) : 0,
      receipt_url: charge?.receipt_url
    }
  )
  
  return await logWebhookEvent(event, 'payment_succeeded', {
    amount: paymentIntent.amount,
    charge_id: charge?.id,
    receipt_url: charge?.receipt_url
  })
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  await updatePaymentStatus(
    paymentIntent.id,
    'failed',
    {
      failure_code: paymentIntent.last_payment_error?.code,
      failure_message: paymentIntent.last_payment_error?.message
    }
  )
  
  return await logWebhookEvent(event, 'payment_failed', {
    amount: paymentIntent.amount,
    error_code: paymentIntent.last_payment_error?.code,
    error_message: paymentIntent.last_payment_error?.message
  })
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentIntentCanceled(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  await updatePaymentStatus(
    paymentIntent.id,
    'canceled',
    {
      cancellation_reason: paymentIntent.cancellation_reason
    }
  )
  
  return await logWebhookEvent(event, 'payment_canceled', {
    amount: paymentIntent.amount,
    cancellation_reason: paymentIntent.cancellation_reason
  })
}

/**
 * Handle charge.captured event (for manual capture)
 */
async function handleChargeCaptured(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge
  
  return await logWebhookEvent(event, 'payment_captured', {
    charge_id: charge.id,
    amount: charge.amount,
    captured: charge.captured
  })
}

/**
 * Handle charge.dispute.created event
 */
async function handleChargeDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute
  
  // Log dispute for admin attention
  await createAdminAudit({
    action_type: 'dispute_created',
    resource_type: 'payment',
    resource_id: dispute.charge as string,
    admin_id: 'system',
    admin_email: 'system@schnittwerk.com',
    action_data: {
      dispute_id: dispute.id,
      reason: dispute.reason,
      amount: dispute.amount,
      status: dispute.status
    },
    success: true
  })
  
  return await logWebhookEvent(event, 'payment_disputed', {
    dispute_id: dispute.id,
    charge_id: dispute.charge,
    amount: dispute.amount,
    reason: dispute.reason
  })
}

/**
 * Handle invoice.payment_succeeded event (for subscriptions/recurring)
 */
async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  // Future: Handle subscription payments if needed
  return await logWebhookEvent(event, 'webhook_received', {})
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  // Future: Handle subscription payment failures if needed
  return await logWebhookEvent(event, 'webhook_received', {})
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(
  stripePaymentIntentId: string,
  status: string,
  additionalData: Record<string, any> = {}
) {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    }

    const { error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('stripe_payment_intent_id', stripePaymentIntentId)

    if (error) {
      console.error('Error updating payment status:', error)
      throw error
    }

    console.log(`Updated payment status to ${status} for payment intent ${stripePaymentIntentId}`)
  } catch (error) {
    console.error('Error updating payment status:', error)
    throw error
  }
}

/**
 * Get fee from balance transaction
 */
async function getBalanceTransactionFee(balanceTransactionId: string): Promise<number> {
  try {
    const balanceTransaction = await stripe.balanceTransactions.retrieve(balanceTransactionId)
    return balanceTransaction.fee
  } catch (error) {
    console.error('Error retrieving balance transaction:', error)
    return 0
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(
  event: Stripe.Event,
  eventType: string,
  additionalData: Record<string, any> = {}
): Promise<any> {
  try {
    // Find payment by payment intent ID if available
    let paymentId: string | null = null
    const paymentIntentId = getPaymentIntentId(event)
    
    if (paymentIntentId) {
      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()
      
      paymentId = payment?.id || null
    }

    const { data, error } = await supabase
      .from('payment_events')
      .insert({
        payment_id: paymentId,
        event_type: eventType,
        stripe_event_id: event.id,
        event_data: {
          ...event.data,
          ...additionalData,
          stripe_event_type: event.type
        },
        processed: true,
        processed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error logging webhook event:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error logging webhook event:', error)
    throw error
  }
}

/**
 * Extract payment intent ID from various Stripe objects
 */
function getPaymentIntentId(event: Stripe.Event): string | null {
  const obj = event.data.object as any
  
  // Direct payment intent
  if (obj.object === 'payment_intent') {
    return obj.id
  }
  
  // Charge object
  if (obj.object === 'charge' && obj.payment_intent) {
    return obj.payment_intent
  }
  
  // Invoice object
  if (obj.object === 'invoice' && obj.payment_intent) {
    return obj.payment_intent
  }
  
  // Dispute object
  if (obj.object === 'dispute' && obj.payment_intent) {
    return obj.payment_intent
  }
  
  return null
}

/**
 * Create admin audit log entry
 */
async function createAdminAudit(auditData: {
  action_type: string
  resource_type: string
  resource_id: string
  admin_id: string
  admin_email: string
  action_data: Record<string, any>
  success: boolean
  reason?: string
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_audit')
      .insert(auditData)

    if (error) {
      console.error('Error creating admin audit:', error)
    }
  } catch (error) {
    console.error('Error creating admin audit:', error)
  }
}