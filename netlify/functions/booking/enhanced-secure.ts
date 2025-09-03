/**
 * Enhanced Booking Endpoint with Unified Security
 * Uses the new security middleware for comprehensive protection
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withCriticalSecurity, SecurityContext } from '../../src/lib/security/middleware'
import { createAdminClient, createSuccessResponse, createErrorResponse } from '../../src/lib/auth/netlify-auth'
import { z } from 'zod'

// Validation schemas
const CreateBookingSchema = z.object({
  customer_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  price: z.number().min(0),
  notes: z.string().optional()
})

const CancelBookingSchema = z.object({
  appointment_id: z.string().uuid(),
  reason: z.string().optional()
})

const RescheduleBookingSchema = z.object({
  appointment_id: z.string().uuid(),
  new_starts_at: z.string().datetime(),
  new_ends_at: z.string().datetime(),
  reason: z.string().optional()
})

/**
 * Create a new booking
 */
async function createBooking(event: HandlerEvent, context: SecurityContext) {
  context.logger.info('Creating new booking')
  
  const bookingData = JSON.parse(event.body || '{}')
  const validation = CreateBookingSchema.safeParse(bookingData)
  
  if (!validation.success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR'
    })
  }
  
  const validatedData = validation.data
  const supabase = createAdminClient()
  
  try {
    // Get the idempotency key (guaranteed to exist due to middleware)
    const idempotencyKey = event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key']
    
    // Use the idempotent booking function
    const { data: result, error } = await supabase
      .rpc('create_booking_idempotent', {
        p_idempotency_key: idempotencyKey,
        p_customer_id: validatedData.customer_id,
        p_staff_id: validatedData.staff_id,
        p_service_id: validatedData.service_id,
        p_starts_at: validatedData.starts_at,
        p_ends_at: validatedData.ends_at,
        p_price: validatedData.price,
        p_notes: validatedData.notes || null,
        p_user_id: context.user.id
      })

    if (error) {
      context.logger.error('Error creating booking', { error, idempotencyKey })
      
      if (error.code === 'P0001') { // Custom error from the function
        return createErrorResponse({
          statusCode: 409,
          message: error.message,
          code: 'BOOKING_CONFLICT'
        })
      }
      
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to create booking',
        code: 'BOOKING_ERROR'
      })
    }

    context.logger.info('Booking created successfully', { 
      appointmentId: result.appointment_id,
      operationId: result.operation_id
    })

    return createSuccessResponse({
      appointment_id: result.appointment_id,
      operation_id: result.operation_id,
      status: result.status,
      created_at: result.created_at
    }, 201)

  } catch (error) {
    context.logger.error('Unexpected error in createBooking', { error, idempotencyKey })
    return createErrorResponse({
      statusCode: 500,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    })
  }
}

/**
 * Cancel an existing booking
 */
async function cancelBooking(event: HandlerEvent, context: SecurityContext) {
  context.logger.info('Cancelling booking')
  
  const cancelData = JSON.parse(event.body || '{}')
  const validation = CancelBookingSchema.safeParse(cancelData)
  
  if (!validation.success) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR'
    })
  }
  
  const validatedData = validation.data
  const supabase = createAdminClient()
  
  try {
    const { data: result, error } = await supabase
      .rpc('cancel_booking_with_policy_check', {
        p_appointment_id: validatedData.appointment_id,
        p_user_id: context.user.id,
        p_reason: validatedData.reason
      })

    if (error) {
      context.logger.error('Error cancelling booking', { error })
      
      if (error.code === 'P0001') {
        return createErrorResponse({
          statusCode: 400,
          message: error.message,
          code: 'CANCELLATION_POLICY_VIOLATION'
        })
      }
      
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to cancel booking',
        code: 'CANCELLATION_ERROR'
      })
    }

    context.logger.info('Booking cancelled successfully', { 
      appointmentId: validatedData.appointment_id
    })

    return createSuccessResponse({
      appointment_id: validatedData.appointment_id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      reason: validatedData.reason
    })

  } catch (error) {
    context.logger.error('Unexpected error in cancelBooking', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    })
  }
}

/**
 * Get available time slots
 */
async function getAvailableSlots(event: HandlerEvent, context: SecurityContext) {
  context.logger.info('Fetching available slots')
  
  const query = event.queryStringParameters || {}
  const { date, staff_id, service_id } = query
  
  if (!date) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Date parameter is required',
      code: 'MISSING_DATE'
    })
  }
  
  const supabase = createAdminClient()
  
  try {
    const { data: slots, error } = await supabase
      .rpc('get_available_slots_enhanced', {
        p_date: date,
        p_staff_id: staff_id || null,
        p_service_id: service_id || null,
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 30
      })

    if (error) {
      context.logger.error('Error fetching available slots', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Failed to fetch available slots',
        code: 'SLOTS_ERROR'
      })
    }

    return createSuccessResponse({
      date,
      available_slots: slots || []
    })

  } catch (error) {
    context.logger.error('Unexpected error in getAvailableSlots', { error })
    return createErrorResponse({
      statusCode: 500,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    })
  }
}

/**
 * Main handler with security middleware
 */
const mainHandler = async (event: HandlerEvent, context: SecurityContext) => {
  const method = event.httpMethod
  const action = event.queryStringParameters?.action
  
  // Route based on method and action
  switch (method) {
    case 'POST':
      if (action === 'cancel') {
        return cancelBooking(event, context)
      }
      return createBooking(event, context)
      
    case 'GET':
      return getAvailableSlots(event, context)
      
    default:
      return createErrorResponse({
        statusCode: 405,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
  }
}

// Export handler with comprehensive security
export const handler: Handler = withCriticalSecurity(mainHandler, {
  audit: {
    actionType: 'booking_operation',
    resourceType: 'appointment',
    resourceId: (body: unknown) => {
      const data = body as Record<string, unknown>
      return (data?.appointment_id as string) || (data?.customer_id as string) || 'unknown'
    },
    captureRequest: true
  },
  rateLimit: {
    endpoint: '/booking/enhanced-secure'
  }
})