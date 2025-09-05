import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Only POST requests are accepted.' }),
    }
  }

  try {
    const signature = event.headers['stripe-signature']
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!signature) {
      console.log('Missing Stripe signature')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing Stripe signature' }),
      }
    }

    if (!webhookSecret) {
      console.log('Missing webhook secret configuration')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Webhook secret not configured' }),
      }
    }

    if (!event.body) {
      console.log('Missing request body')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      }
    }

    // Verify the webhook signature
    let stripeEvent: Stripe.Event
    
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        webhookSecret
      )
    } catch (err: unknown) {
      const error = err as Error
      console.log('Webhook signature verification failed:', error.message)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' }),
      }
    }

    // Log the event type for debugging
    console.log('Stripe webhook event received:', stripeEvent.type)

    // Handle the event
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', stripeEvent.data.object.id)
        // Handle successful payment
        break
      
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', stripeEvent.data.object.id)
        // Handle failed payment
        break
      
      case 'invoice.payment_succeeded':
        console.log('Invoice payment succeeded:', stripeEvent.data.object.id)
        // Handle successful invoice payment
        break
      
      case 'customer.subscription.created':
        console.log('Subscription created:', stripeEvent.data.object.id)
        // Handle new subscription
        break
      
      case 'customer.subscription.updated':
        console.log('Subscription updated:', stripeEvent.data.object.id)
        // Handle subscription update
        break
      
      case 'customer.subscription.deleted':
        console.log('Subscription deleted:', stripeEvent.data.object.id)
        // Handle subscription cancellation
        break
      
      default:
        console.log('Unhandled event type:', stripeEvent.type)
    }

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, eventType: stripeEvent.type }),
    }

  } catch (error: unknown) {
    console.error('Webhook processing error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error processing webhook',
        message: error.message 
      }),
    }
  }
}