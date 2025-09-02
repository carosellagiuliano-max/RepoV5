/**
 * Enhanced Booking Creation Endpoint
 * Implements comprehensive security hardening with idempotency, audit logging, and rate limiting
 */

import { z } from 'zod'
import { withCriticalOperationSecurity, SecurityContext } from '../src/lib/security/middleware'
import { HandlerEvent } from '@netlify/functions'

// Validation schema for booking requests
const BookingSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID format'),
  staff_id: z.string().uuid('Invalid staff ID format'),
  service_id: z.string().uuid('Invalid service ID format'),
  starts_at: z.string().datetime('Invalid start time format'),
  ends_at: z.string().datetime('Invalid end time format'),
  price: z.number().min(0, 'Price must be non-negative'),
  notes: z.string().optional()
})

type BookingRequest = z.infer<typeof BookingSchema>

async function createBookingHandler(event: HandlerEvent, context: SecurityContext) {
  const { securityLogger: logger } = context
  
  try {
    // Parse and validate request body
    let bookingData: BookingRequest
    try {
      bookingData = JSON.parse(event.body || '{}')
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: { message: 'Invalid JSON in request body', code: 'INVALID_JSON' },
          correlationId: context.correlationId
        })
      }
    }

    // Validate booking data with Zod
    const validation = BookingSchema.safeParse(bookingData)
    if (!validation.success) {
      logger.warn('Booking validation failed', { 
        errors: validation.error.errors,
        requestData: bookingData 
      })
      
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: { 
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validation.error.errors
          },
          correlationId: context.correlationId
        })
      }
    }

    const validatedData = validation.data

    // Import Supabase client (only when needed)
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check authorization - customers can only book for themselves
    if (context.user!.role === 'customer') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', context.user!.id)
        .single()

      if (customerError || !customer) {
        logger.warn('Customer profile not found', { userId: context.user!.id })
        return {
          statusCode: 403,
          body: JSON.stringify({
            success: false,
            error: { message: 'Customer profile not found', code: 'CUSTOMER_NOT_FOUND' },
            correlationId: context.correlationId
          })
        }
      }

      if (validatedData.customer_id !== customer.id) {
        logger.warn('Customer attempting to book for another customer', {
          requestedCustomerId: validatedData.customer_id,
          actualCustomerId: customer.id
        })
        return {
          statusCode: 403,
          body: JSON.stringify({
            success: false,
            error: { message: 'Cannot book appointments for other customers', code: 'UNAUTHORIZED_BOOKING' },
            correlationId: context.correlationId
          })
        }
      }
    }

    // Validate appointment slot availability
    const { data: validationResult, error: validationError } = await supabase
      .rpc('rpc_validate_appointment_slot', {
        p_staff_id: validatedData.staff_id,
        p_service_id: validatedData.service_id,
        p_starts_at: validatedData.starts_at,
        p_ends_at: validatedData.ends_at,
        p_buffer_minutes: 10,
        p_exclude_appointment_id: null
      })

    if (validationError) {
      logger.error('Appointment slot validation failed', { 
        error: validationError,
        appointmentData: validatedData 
      })
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Failed to validate appointment slot', code: 'VALIDATION_FAILED' },
          correlationId: context.correlationId
        })
      }
    }

    if (!validationResult.is_valid) {
      logger.info('Appointment slot not available', {
        validationErrors: validationResult.errors,
        appointmentData: validatedData
      })
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: { 
            message: 'Appointment slot is not available',
            code: 'SLOT_UNAVAILABLE',
            details: validationResult.errors
          },
          correlationId: context.correlationId
        })
      }
    }

    // Create the appointment
    const { data: appointment, error: createError } = await supabase
      .from('appointments')
      .insert({
        ...validatedData,
        status: 'pending'
      })
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
      .single()

    if (createError) {
      logger.error('Failed to create appointment', { 
        error: createError,
        appointmentData: validatedData 
      })

      // Handle specific database errors
      if (createError.code === '23505') {
        return {
          statusCode: 409,
          body: JSON.stringify({
            success: false,
            error: { message: 'Appointment time slot already taken', code: 'SLOT_CONFLICT' },
            correlationId: context.correlationId
          })
        }
      }

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Failed to create appointment', code: 'CREATE_FAILED' },
          correlationId: context.correlationId
        })
      }
    }

    // Log successful booking creation for audit
    logger.info('Appointment created successfully', {
      appointmentId: appointment.id,
      customerId: appointment.customer_id,
      staffId: appointment.staff_id,
      serviceId: appointment.service_id,
      startsAt: appointment.starts_at
    })

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: { appointment },
        correlationId: context.correlationId
      })
    }

  } catch (error) {
    logger.error('Unexpected error in booking creation', { 
      error: error instanceof Error ? error.message : error 
    })
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        correlationId: context.correlationId
      })
    }
  }
}

// Export handler with comprehensive security middleware
export const handler = withCriticalOperationSecurity(
  createBookingHandler,
  'booking_create',
  'appointments'
)