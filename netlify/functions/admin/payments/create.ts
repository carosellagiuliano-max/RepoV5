import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validation schemas
const createPaymentIntentSchema = z.object({
  appointment_id: z.string().uuid(),
  amount_cents: z.number().int().min(50).max(1000000), // 0.50 to 10,000 CHF
  currency: z.string().length(3).default('CHF'),
  payment_method_type: z.enum(['card', 'apple_pay', 'google_pay', 'sepa_debit', 'bancontact', 'ideal']).default('card'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  capture_method: z.enum(['automatic', 'manual']).default('automatic'),
  customer_email: z.string().email().optional(),
  save_payment_method: z.boolean().default(false)
})

const confirmPaymentIntentSchema = z.object({
  payment_intent_id: z.string(),
  payment_method_id: z.string().optional(),
  return_url: z.string().url().optional()
})

interface AuthenticatedUser {
  id: string
  email: string
  role: 'admin' | 'staff' | 'customer'
  full_name?: string
}

interface JWTPayload {
  sub: string
  email: string
  role?: string
}

interface CustomerData {
  id: string
  email: string
  full_name?: string
  phone?: string
  stripe_customer_id?: string
}

/**
 * Payment Creation and Management API
 * Handles payment intent creation, confirmation, and management
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Payment API called:', {
    method: event.httpMethod,
    path: event.path,
    query: event.queryStringParameters
  })

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    // Authenticate user
    const user = await authenticateUser(event)
    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' })
      }
    }

    // Handle different actions based on query parameter
    const action = event.queryStringParameters?.action || 'create'

    switch (action) {
      case 'create':
        return await handleCreatePaymentIntent(event, user)
      case 'confirm':
        return await handleConfirmPaymentIntent(event, user)
      case 'retrieve':
        return await handleRetrievePaymentIntent(event, user)
      case 'cancel':
        return await handleCancelPaymentIntent(event, user)
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid action' })
        }
    }

  } catch (error) {
    console.error('Payment API error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Authenticate user and check permissions
 */
async function authenticateUser(event: HandlerEvent) {
  const authHeader = event.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', decoded.sub)
      .single()

    if (error || !profile) {
      console.error('User profile not found:', decoded.sub)
      return null
    }

    return profile
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

/**
 * Handle payment intent creation
 */
async function handleCreatePaymentIntent(event: HandlerEvent, user: AuthenticatedUser) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Check idempotency
  const idempotencyKey = event.headers['x-idempotency-key']
  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'X-Idempotency-Key header required' })
    }
  }

  const existingResponse = await checkIdempotency(idempotencyKey, event.body || '')
  if (existingResponse) {
    return {
      statusCode: existingResponse.response_status || 200,
      headers: corsHeaders,
      body: JSON.stringify(existingResponse.response_body)
    }
  }

  try {
    // Validate request body
    const body = JSON.parse(event.body || '{}')
    const validatedData = createPaymentIntentSchema.parse(body)

    // Check user authorization for appointment
    const appointmentAuth = await checkAppointmentAuthorization(validatedData.appointment_id, user)
    if (!appointmentAuth.authorized) {
      await storeIdempotencyResponse(idempotencyKey, event.body || '', 403, { error: appointmentAuth.reason })
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: appointmentAuth.reason })
      }
    }

    // Get appointment details
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        *,
        customer:customers(*),
        service:services(*),
        staff:staff(*)
      `)
      .eq('id', validatedData.appointment_id)
      .single()

    if (!appointment) {
      await storeIdempotencyResponse(idempotencyKey, event.body || '', 404, { error: 'Appointment not found' })
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Appointment not found' })
      }
    }

    // Check if payment already exists for this appointment
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('appointment_id', validatedData.appointment_id)
      .in('status', ['pending', 'processing', 'requires_action', 'succeeded'])
      .single()

    if (existingPayment) {
      const response = {
        success: true,
        payment: existingPayment,
        message: 'Payment already exists for this appointment'
      }
      await storeIdempotencyResponse(idempotencyKey, event.body || '', 200, response)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(response)
      }
    }

    // Create or get Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer(appointment.customer)

    // Create payment intent in Stripe
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: validatedData.amount_cents,
      currency: validatedData.currency.toLowerCase(),
      customer: stripeCustomer.id,
      description: validatedData.description || `Payment for ${appointment.service.name} - ${appointment.customer.first_name} ${appointment.customer.last_name}`,
      metadata: {
        appointment_id: validatedData.appointment_id,
        customer_id: appointment.customer_id,
        service_name: appointment.service.name,
        staff_name: appointment.staff.name,
        ...validatedData.metadata
      },
      capture_method: validatedData.capture_method,
      receipt_email: validatedData.customer_email || appointment.customer.email,
      setup_future_usage: validatedData.save_payment_method ? 'on_session' : undefined,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // For SCA compliance
      }
    }

    const stripePaymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        appointment_id: validatedData.appointment_id,
        customer_id: appointment.customer_id,
        stripe_payment_intent_id: stripePaymentIntent.id,
        stripe_customer_id: stripeCustomer.id,
        amount_cents: validatedData.amount_cents,
        currency: validatedData.currency,
        status: 'pending',
        payment_method_type: validatedData.payment_method_type,
        description: validatedData.description,
        metadata: validatedData.metadata,
        client_secret: stripePaymentIntent.client_secret,
        created_by: user.id
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      // Cancel Stripe payment intent since we couldn't store it
      await stripe.paymentIntents.cancel(stripePaymentIntent.id)
      throw new Error('Failed to create payment record')
    }

    // Log payment creation event
    await supabase
      .from('payment_events')
      .insert({
        payment_id: payment.id,
        event_type: 'payment_intent_created',
        event_data: {
          stripe_payment_intent_id: stripePaymentIntent.id,
          amount_cents: validatedData.amount_cents,
          currency: validatedData.currency,
          capture_method: validatedData.capture_method
        },
        processed: true,
        processed_at: new Date().toISOString(),
        created_by: user.id
      })

    const response = {
      success: true,
      payment: {
        ...payment,
        client_secret: stripePaymentIntent.client_secret
      },
      stripe_payment_intent: {
        id: stripePaymentIntent.id,
        client_secret: stripePaymentIntent.client_secret,
        status: stripePaymentIntent.status
      }
    }

    await storeIdempotencyResponse(idempotencyKey, event.body || '', 201, response)

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('Error creating payment intent:', error)
    
    const errorResponse = {
      success: false,
      error: 'Failed to create payment intent',
      message: error instanceof Error ? error.message : 'Unknown error'
    }

    await storeIdempotencyResponse(idempotencyKey, event.body || '', 500, errorResponse)

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(errorResponse)
    }
  }
}

/**
 * Handle payment intent confirmation
 */
async function handleConfirmPaymentIntent(event: HandlerEvent, user: AuthenticatedUser) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const validatedData = confirmPaymentIntentSchema.parse(body)

    // Get payment from database
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', validatedData.payment_intent_id)
      .single()

    if (!payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check authorization
    const appointmentAuth = await checkAppointmentAuthorization(payment.appointment_id, user)
    if (!appointmentAuth.authorized) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: appointmentAuth.reason })
      }
    }

    // Confirm payment intent with Stripe
    const confirmParams: Stripe.PaymentIntentConfirmParams = {}
    
    if (validatedData.payment_method_id) {
      confirmParams.payment_method = validatedData.payment_method_id
    }
    
    if (validatedData.return_url) {
      confirmParams.return_url = validatedData.return_url
    }

    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      validatedData.payment_intent_id,
      confirmParams
    )

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: confirmedPaymentIntent.status,
        stripe_payment_method_id: confirmedPaymentIntent.payment_method as string,
        requires_action: confirmedPaymentIntent.status === 'requires_action',
        next_action: confirmedPaymentIntent.next_action,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        payment_intent: confirmedPaymentIntent,
        requires_action: confirmedPaymentIntent.status === 'requires_action',
        next_action: confirmedPaymentIntent.next_action
      })
    }

  } catch (error) {
    console.error('Error confirming payment intent:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to confirm payment intent',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment intent retrieval
 */
async function handleRetrievePaymentIntent(event: HandlerEvent, user: AuthenticatedUser) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const paymentIntentId = event.queryStringParameters?.payment_intent_id
  if (!paymentIntentId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'payment_intent_id required' })
    }
  }

  try {
    // Get payment from database
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (!payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check authorization
    const appointmentAuth = await checkAppointmentAuthorization(payment.appointment_id, user)
    if (!appointmentAuth.authorized) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: appointmentAuth.reason })
      }
    }

    // Get latest status from Stripe
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        payment,
        stripe_payment_intent: stripePaymentIntent
      })
    }

  } catch (error) {
    console.error('Error retrieving payment intent:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve payment intent',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment intent cancellation
 */
async function handleCancelPaymentIntent(event: HandlerEvent, user: AuthenticatedUser) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const body = JSON.parse(event.body || '{}')
  const paymentIntentId = body.payment_intent_id

  if (!paymentIntentId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'payment_intent_id required' })
    }
  }

  try {
    // Get payment from database
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (!payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check authorization (admin/staff can cancel any payment)
    if (user.role === 'customer') {
      const appointmentAuth = await checkAppointmentAuthorization(payment.appointment_id, user)
      if (!appointmentAuth.authorized) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: appointmentAuth.reason })
        }
      }
    }

    // Cancel payment intent in Stripe
    const canceledPaymentIntent = await stripe.paymentIntents.cancel(paymentIntentId)

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)

    // Log cancellation event
    await supabase
      .from('payment_events')
      .insert({
        payment_id: payment.id,
        event_type: 'payment_canceled',
        event_data: {
          canceled_by: user.id,
          reason: body.reason || 'Manual cancellation'
        },
        processed: true,
        processed_at: new Date().toISOString(),
        created_by: user.id
      })

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        payment_intent: canceledPaymentIntent
      })
    }

  } catch (error) {
    console.error('Error canceling payment intent:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to cancel payment intent',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Check if user is authorized to access appointment payment
 */
async function checkAppointmentAuthorization(appointmentId: string, user: AuthenticatedUser): Promise<{ authorized: boolean; reason?: string }> {
  // Admin and staff can access any appointment
  if (user.role === 'admin' || user.role === 'staff') {
    return { authorized: true }
  }

  // Customers can only access their own appointments
  if (user.role === 'customer') {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        customer_id,
        customers!inner(profile_id)
      `)
      .eq('id', appointmentId)
      .single()

    if (!appointment) {
      return { authorized: false, reason: 'Appointment not found' }
    }

    if (appointment.customers.profile_id !== user.id) {
      return { authorized: false, reason: 'Not authorized to access this appointment' }
    }

    return { authorized: true }
  }

  return { authorized: false, reason: 'Invalid user role' }
}

/**
 * Get or create Stripe customer
 */
async function getOrCreateStripeCustomer(customer: CustomerData): Promise<Stripe.Customer> {
  // Check if customer already has Stripe ID
  if (customer.stripe_customer_id) {
    try {
      const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id)
      if (!stripeCustomer.deleted) {
        return stripeCustomer as Stripe.Customer
      }
    } catch (error) {
      console.log('Stripe customer not found, creating new one:', customer.stripe_customer_id)
    }
  }

  // Create new Stripe customer
  const stripeCustomer = await stripe.customers.create({
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    email: customer.email,
    phone: customer.phone,
    metadata: {
      customer_id: customer.id
    }
  })

  // Update customer record with Stripe ID
  await supabase
    .from('customers')
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq('id', customer.id)

  return stripeCustomer
}

/**
 * Check idempotency
 */
async function checkIdempotency(idempotencyKey: string, requestBody: string): Promise<{ exists: boolean; response?: unknown; error?: string }> {
  try {
    const requestHash = crypto.createHash('sha256').update(requestBody).digest('hex')
    
    const { data, error } = await supabase
      .from('payment_idempotency')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking idempotency:', error)
      return null
    }

    if (data) {
      // Check if request body matches
      if (data.request_hash !== requestHash) {
        throw new Error('Idempotency key reused with different request body')
      }
      
      // Check if not expired
      if (new Date(data.expires_at) > new Date()) {
        return data
      }
    }

    return null
  } catch (error) {
    console.error('Error checking idempotency:', error)
    return null
  }
}

/**
 * Store idempotency response
 */
async function storeIdempotencyResponse(
  idempotencyKey: string,
  requestBody: string,
  statusCode: number,
  responseBody: unknown
): Promise<void> {
  try {
    const requestHash = crypto.createHash('sha256').update(requestBody).digest('hex')
    
    await supabase
      .from('payment_idempotency')
      .insert({
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        endpoint: '/payments/create',
        method: 'POST',
        response_status: statusCode,
        response_body: responseBody,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
  } catch (error) {
    console.error('Error storing idempotency response:', error)
    // Don't throw here to avoid breaking the main flow
  }
}