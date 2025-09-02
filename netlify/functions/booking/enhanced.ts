/**
 * Enhanced Booking Management Functions
 * Provides robust booking creation with idempotency, race condition prevention,
 * and comprehensive validation against all business rules
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { createAdminClient, createLogger, generateCorrelationId, withAuthAndRateLimit } from '../../../src/lib/auth/netlify-auth'
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

const BookingQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staff_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  buffer_minutes: z.string().transform(val => parseInt(val)).optional(),
  slot_interval_minutes: z.string().transform(val => parseInt(val)).optional(),
  include_unavailable: z.string().transform(val => val === 'true').optional()
})

// Type definitions for booking data
interface AvailableStaffMember {
  staff_id: string
  staff_name: string
  staff_email: string
  available_duration_minutes: number
}

interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
  reason?: string
}

interface StaffWithSlots {
  staff: AvailableStaffMember
  slots: TimeSlot[]
}

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

/**
 * Generate available slots with enhanced constraints
 */
async function getAvailableSlots(
  event: HandlerEvent, 
  supabase: SupabaseClient, 
  logger: Logger
) {
  const query = event.queryStringParameters || {}
  const validation = BookingQuerySchema.safeParse(query)
  
  if (!validation.success) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Invalid query parameters',
        details: validation.error.errors
      })
    }
  }

  const { date, staff_id, service_id, buffer_minutes = 15, slot_interval_minutes = 15 } = validation.data

  try {
    if (staff_id && service_id) {
      // Get slots for specific staff and service
      const { data: slots, error } = await supabase
        .rpc('rpc_get_available_slots_enhanced', {
          p_staff_id: staff_id,
          p_service_id: service_id,
          p_date: date,
          p_buffer_minutes: buffer_minutes,
          p_slot_interval_minutes: slot_interval_minutes
        })

      if (error) {
        logger.error('Error fetching available slots', { error, staff_id, service_id, date })
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch available slots' })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type: 'slots',
          date,
          staff_id,
          service_id,
          slots: slots || []
        })
      }
    } else if (service_id) {
      // Get all available staff for the service on this date
      const startOfDay = `${date}T00:00:00Z`
      const endOfDay = `${date}T23:59:59Z`

      const { data: availableStaff, error } = await supabase
        .rpc('rpc_get_available_staff', {
          p_service_id: service_id,
          p_starts_at: startOfDay,
          p_ends_at: endOfDay,
          p_buffer_minutes: buffer_minutes
        })

      if (error) {
        logger.error('Error fetching available staff', { error, service_id, date })
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch available staff' })
        }
      }

      // Get slots for each available staff member
      const staffWithSlots = await Promise.all(
        (availableStaff || []).map(async (staff: AvailableStaffMember) => {
          const { data: slots, error: slotsError } = await supabase
            .rpc('rpc_get_available_slots_enhanced', {
              p_staff_id: staff.staff_id,
              p_service_id: service_id,
              p_date: date,
              p_buffer_minutes: buffer_minutes,
              p_slot_interval_minutes: slot_interval_minutes
            })

          return {
            ...staff,
            available_slots: slotsError ? [] : slots || []
          }
        })
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type: 'staff_availability',
          date,
          service_id,
          staff: staffWithSlots
        })
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Either staff_id or service_id is required' })
      }
    }
  } catch (error) {
    logger.error('Unexpected error in getAvailableSlots', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Create booking with idempotency support
 */
async function createBooking(
  event: HandlerEvent, 
  supabase: SupabaseClient, 
  logger: Logger,
  userId: string
) {
  const idempotencyKey = event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key']
  
  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'X-Idempotency-Key header is required for booking operations' 
      })
    }
  }

  let bookingData
  try {
    bookingData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = CreateBookingSchema.safeParse(bookingData)
  if (!validation.success) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Validation failed',
        details: validation.error.errors
      })
    }
  }

  const validatedData = validation.data

  try {
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
        p_user_id: userId
      })

    if (error) {
      logger.error('Error creating booking', { error, idempotencyKey })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create booking' })
      }
    }

    const operationResult = result[0]
    
    if (operationResult.status === 'failed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Booking creation failed',
          details: operationResult.error_message,
          operation_id: operationResult.operation_id
        })
      }
    }

    // Fetch full appointment details for response
    if (operationResult.appointment_id) {
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          customers (
            id,
            profiles (full_name, email, phone)
          ),
          staff (
            id,
            full_name,
            email,
            phone
          ),
          services (
            id,
            name,
            description,
            category,
            duration_minutes
          )
        `)
        .eq('id', operationResult.appointment_id)
        .single()

      if (fetchError) {
        logger.error('Error fetching created appointment', { error: fetchError })
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          operation_id: operationResult.operation_id,
          appointment: appointment || { id: operationResult.appointment_id }
        })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        operation_id: operationResult.operation_id
      })
    }

  } catch (error) {
    logger.error('Unexpected error in createBooking', { error, idempotencyKey })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Check booking policies and constraints
 */
async function checkBookingPolicies(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger
) {
  const query = event.queryStringParameters || {}
  const { action, appointment_id } = query

  if (!action) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'action parameter is required' })
    }
  }

  try {
    if (action === 'cancel' && appointment_id) {
      // Check cancellation policy
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('starts_at, status')
        .eq('id', appointment_id)
        .single()

      if (appointmentError || !appointment) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Appointment not found' })
        }
      }

      const { data: policyData, error: policyError } = await supabase
        .rpc('get_booking_policy', { policy_key: 'cancellation_deadline_hours' })

      if (policyError) {
        logger.error('Error fetching cancellation policy', { error: policyError })
      }

      const deadlineHours = parseInt(policyData || '24')
      const deadlineTime = new Date(appointment.starts_at)
      deadlineTime.setHours(deadlineTime.getHours() - deadlineHours)

      const canCancel = new Date() < deadlineTime && appointment.status === 'confirmed'

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          can_cancel: canCancel,
          deadline_hours: deadlineHours,
          deadline_time: deadlineTime.toISOString(),
          current_status: appointment.status
        })
      }
    }

    if (action === 'reschedule' && appointment_id) {
      // Check reschedule policy
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('starts_at, status')
        .eq('id', appointment_id)
        .single()

      if (appointmentError || !appointment) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Appointment not found' })
        }
      }

      const { data: policyData, error: policyError } = await supabase
        .rpc('get_booking_policy', { policy_key: 'reschedule_deadline_hours' })

      if (policyError) {
        logger.error('Error fetching reschedule policy', { error: policyError })
      }

      const deadlineHours = parseInt(policyData || '2')
      const deadlineTime = new Date(appointment.starts_at)
      deadlineTime.setHours(deadlineTime.getHours() - deadlineHours)

      const canReschedule = new Date() < deadlineTime && appointment.status === 'confirmed'

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          can_reschedule: canReschedule,
          deadline_hours: deadlineHours,
          deadline_time: deadlineTime.toISOString(),
          current_status: appointment.status
        })
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Unsupported action or missing appointment_id' })
    }

  } catch (error) {
    logger.error('Error checking booking policies', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Enhanced booking request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      }
    }

    try {
      switch (event.httpMethod) {
        case 'GET':
          if (event.path?.includes('/policies')) {
            return await checkBookingPolicies(event, supabase, logger)
          }
          return await getAvailableSlots(event, supabase, logger)

        case 'POST':
          return await createBooking(event, supabase, logger, context.user.id)

        default:
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
          }
      }
    } catch (error) {
      logger.error('Unexpected error in booking handler', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' })
      }
    }
  },
  {
    requiredRole: ['admin', 'staff', 'customer'],
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 30   // 30 requests per minute
    }
  }
)