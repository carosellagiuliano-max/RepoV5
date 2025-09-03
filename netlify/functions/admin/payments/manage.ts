import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import jwt from 'jsonwebtoken'

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

// Validation schemas
const refundSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1).optional(), // Partial refund if specified
  reason: z.string().optional(),
  metadata: z.record(z.any()).default({})
})

const captureSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1).optional(), // Partial capture if specified
})

const paymentListSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  appointment_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  search: z.string().optional()
})

/**
 * Payment Management API for Admin/Staff
 * Handles payment operations: list, refund, capture, void
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Payment Management API called:', {
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

    // Check if user has admin/staff permissions
    if (!['admin', 'staff'].includes(user.role)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      }
    }

    // Handle different actions
    const action = event.queryStringParameters?.action || 'list'

    switch (action) {
      case 'list':
        return await handleListPayments(event, user)
      case 'refund':
        return await handleRefundPayment(event, user)
      case 'capture':
        return await handleCapturePayment(event, user)
      case 'void':
        return await handleVoidPayment(event, user)
      case 'summary':
        return await handlePaymentSummary(event, user)
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid action' })
        }
    }

  } catch (error) {
    console.error('Payment Management API error:', error)
    
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    
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
 * Handle listing payments with filtering and pagination
 */
async function handleListPayments(event: HandlerEvent, user: any) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Parse query parameters
    const params = paymentListSchema.parse(event.queryStringParameters || {})

    // Build query
    let query = supabase
      .from('payments')
      .select(`
        *,
        appointment:appointments(
          *,
          customer:customers(*),
          service:services(*),
          staff:staff(*)
        ),
        payment_events(*)
      `)

    // Apply filters
    if (params.status) {
      query = query.eq('status', params.status)
    }
    
    if (params.customer_id) {
      query = query.eq('customer_id', params.customer_id)
    }
    
    if (params.appointment_id) {
      query = query.eq('appointment_id', params.appointment_id)
    }
    
    if (params.start_date) {
      query = query.gte('created_at', params.start_date)
    }
    
    if (params.end_date) {
      query = query.lte('created_at', params.end_date)
    }

    // Apply search
    if (params.search) {
      // Search in payment description and customer names
      const searchTerm = `%${params.search}%`
      query = query.or(`
        description.ilike.${searchTerm},
        appointments.customers.first_name.ilike.${searchTerm},
        appointments.customers.last_name.ilike.${searchTerm},
        appointments.customers.email.ilike.${searchTerm}
      `)
    }

    // Apply pagination and ordering
    const { data: payments, error, count } = await query
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1)

    if (error) {
      console.error('Error fetching payments:', error)
      throw error
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        payments,
        pagination: {
          total: count,
          limit: params.limit,
          offset: params.offset,
          has_more: count ? count > params.offset + params.limit : false
        }
      })
    }

  } catch (error) {
    console.error('Error listing payments:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to list payments',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment refund
 */
async function handleRefundPayment(event: HandlerEvent, user: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const validatedData = refundSchema.parse(body)

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', validatedData.payment_id)
      .single()

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check if payment can be refunded
    if (payment.status !== 'succeeded') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment cannot be refunded' })
      }
    }

    // Create refund in Stripe
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment.stripe_payment_intent_id!,
      reason: validatedData.reason as any || 'requested_by_customer',
      metadata: {
        refunded_by: user.id,
        admin_email: user.email,
        ...validatedData.metadata
      }
    }

    if (validatedData.amount_cents) {
      refundParams.amount = validatedData.amount_cents
    }

    const stripeRefund = await stripe.refunds.create(refundParams)

    // Create audit log
    await createAdminAudit({
      action_type: 'payment_refund',
      resource_type: 'payment',
      resource_id: payment.id,
      admin_id: user.id,
      admin_email: user.email,
      action_data: {
        stripe_refund_id: stripeRefund.id,
        amount_cents: stripeRefund.amount,
        reason: validatedData.reason,
        stripe_status: stripeRefund.status
      },
      reason: validatedData.reason,
      success: true
    })

    // Log payment event
    await supabase
      .from('payment_events')
      .insert({
        payment_id: payment.id,
        event_type: 'payment_refunded',
        event_data: {
          stripe_refund_id: stripeRefund.id,
          amount_cents: stripeRefund.amount,
          reason: validatedData.reason,
          refunded_by: user.id
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
        refund: stripeRefund,
        message: 'Payment refunded successfully'
      })
    }

  } catch (error) {
    console.error('Error refunding payment:', error)
    
    // Log failed audit
    const body = JSON.parse(event.body || '{}')
    await createAdminAudit({
      action_type: 'payment_refund',
      resource_type: 'payment',
      resource_id: body.payment_id || 'unknown',
      admin_id: user.id,
      admin_email: user.email,
      action_data: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to refund payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment capture (for manual capture)
 */
async function handleCapturePayment(event: HandlerEvent, user: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const validatedData = captureSchema.parse(body)

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', validatedData.payment_id)
      .single()

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check if payment can be captured
    if (payment.status !== 'requires_capture') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment cannot be captured' })
      }
    }

    // Capture payment in Stripe
    const captureParams: Stripe.PaymentIntentCaptureParams = {}
    
    if (validatedData.amount_cents) {
      captureParams.amount_to_capture = validatedData.amount_cents
    }

    const capturedPaymentIntent = await stripe.paymentIntents.capture(
      payment.stripe_payment_intent_id!,
      captureParams
    )

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)

    // Create audit log
    await createAdminAudit({
      action_type: 'payment_capture',
      resource_type: 'payment',
      resource_id: payment.id,
      admin_id: user.id,
      admin_email: user.email,
      action_data: {
        amount_captured: capturedPaymentIntent.amount_received,
        stripe_status: capturedPaymentIntent.status
      },
      success: true
    })

    // Log payment event
    await supabase
      .from('payment_events')
      .insert({
        payment_id: payment.id,
        event_type: 'payment_captured',
        event_data: {
          amount_captured: capturedPaymentIntent.amount_received,
          captured_by: user.id
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
        payment_intent: capturedPaymentIntent,
        message: 'Payment captured successfully'
      })
    }

  } catch (error) {
    console.error('Error capturing payment:', error)
    
    // Log failed audit
    const body = JSON.parse(event.body || '{}')
    await createAdminAudit({
      action_type: 'payment_capture',
      resource_type: 'payment',
      resource_id: body.payment_id || 'unknown',
      admin_id: user.id,
      admin_email: user.email,
      action_data: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to capture payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment void (cancel before capture)
 */
async function handleVoidPayment(event: HandlerEvent, user: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const paymentId = body.payment_id

    if (!paymentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'payment_id required' })
      }
    }

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment not found' })
      }
    }

    // Check if payment can be voided
    if (!['pending', 'requires_capture', 'requires_action'].includes(payment.status)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment cannot be voided' })
      }
    }

    // Cancel payment in Stripe
    const canceledPaymentIntent = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id!)

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)

    // Create audit log
    await createAdminAudit({
      action_type: 'payment_void',
      resource_type: 'payment',
      resource_id: payment.id,
      admin_id: user.id,
      admin_email: user.email,
      action_data: {
        reason: body.reason || 'Administrative action',
        stripe_status: canceledPaymentIntent.status
      },
      reason: body.reason,
      success: true
    })

    // Log payment event
    await supabase
      .from('payment_events')
      .insert({
        payment_id: payment.id,
        event_type: 'payment_canceled',
        event_data: {
          reason: body.reason || 'Administrative action',
          voided_by: user.id
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
        payment_intent: canceledPaymentIntent,
        message: 'Payment voided successfully'
      })
    }

  } catch (error) {
    console.error('Error voiding payment:', error)
    
    // Log failed audit
    const body = JSON.parse(event.body || '{}')
    await createAdminAudit({
      action_type: 'payment_void',
      resource_type: 'payment',
      resource_id: body.payment_id || 'unknown',
      admin_id: user.id,
      admin_email: user.email,
      action_data: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to void payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle payment summary for dashboard
 */
async function handlePaymentSummary(event: HandlerEvent, user: any) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Only admin can access summary
    if (user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Admin access required' })
      }
    }

    const startDate = event.queryStringParameters?.start_date
    const endDate = event.queryStringParameters?.end_date

    // Call the database function for payment summary
    const { data: summary, error } = await supabase
      .rpc('get_payment_summary', {
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })

    if (error) {
      console.error('Error getting payment summary:', error)
      throw error
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        summary
      })
    }

  } catch (error) {
    console.error('Error getting payment summary:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to get payment summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
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
  error_message?: string
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