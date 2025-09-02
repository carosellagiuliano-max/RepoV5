/**
 * Enhanced Booking Cancellation Endpoint
 * Implements comprehensive security hardening with idempotency, audit logging, and rate limiting
 */

import { z } from 'zod'
import { withCriticalOperationSecurity, SecurityContext } from '../src/lib/security/middleware'
import { HandlerEvent } from '@netlify/functions'

// Validation schema for cancellation requests
const CancelBookingSchema = z.object({
  appointment_id: z.string().uuid('Invalid appointment ID format'),
  reason: z.string().optional().refine(
    (val) => !val || val.length <= 500, 
    'Cancellation reason must be 500 characters or less'
  )
})

type CancelBookingRequest = z.infer<typeof CancelBookingSchema>

async function cancelBookingHandler(event: HandlerEvent, context: SecurityContext) {
  const { securityLogger: logger } = context
  
  try {
    // Parse and validate request body
    let cancelData: CancelBookingRequest
    try {
      cancelData = JSON.parse(event.body || '{}')
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

    // Validate cancellation data with Zod
    const validation = CancelBookingSchema.safeParse(cancelData)
    if (!validation.success) {
      logger.warn('Cancellation validation failed', { 
        errors: validation.error.errors,
        requestData: cancelData 
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

    const { appointment_id, reason } = validation.data

    // Import Supabase client (only when needed)
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the appointment with related data for authorization check
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profile_id
        ),
        staff (
          id,
          profile_id
        )
      `)
      .eq('id', appointment_id)
      .single()

    if (appointmentError) {
      if (appointmentError.code === 'PGRST116') {
        logger.warn('Appointment not found', { appointmentId: appointment_id })
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: { message: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' },
            correlationId: context.correlationId
          })
        }
      }

      logger.error('Failed to fetch appointment', { 
        error: appointmentError,
        appointmentId: appointment_id 
      })
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Failed to fetch appointment', code: 'FETCH_FAILED' },
          correlationId: context.correlationId
        })
      }
    }

    // Business rule validation
    if (appointment.status === 'cancelled') {
      logger.warn('Attempt to cancel already cancelled appointment', {
        appointmentId: appointment_id,
        currentStatus: appointment.status
      })
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: { message: 'Appointment is already cancelled', code: 'ALREADY_CANCELLED' },
          correlationId: context.correlationId
        })
      }
    }

    if (appointment.status === 'completed') {
      logger.warn('Attempt to cancel completed appointment', {
        appointmentId: appointment_id,
        currentStatus: appointment.status
      })
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: { message: 'Cannot cancel completed appointment', code: 'ALREADY_COMPLETED' },
          correlationId: context.correlationId
        })
      }
    }

    // Authorization check based on user role
    let canCancel = false
    let cancellationNotes = ''

    switch (context.user!.role) {
      case 'admin':
        canCancel = true
        cancellationNotes = `Cancelled by admin (${context.user!.email})`
        break
        
      case 'staff':
        // Staff can cancel their own appointments
        canCancel = appointment.staff.profile_id === context.user!.id
        cancellationNotes = `Cancelled by staff member (${context.user!.email})`
        break
        
      case 'customer':
        // Customer can only cancel their own pending appointments
        canCancel = appointment.customers.profile_id === context.user!.id && 
                   appointment.status === 'pending'
        cancellationNotes = `Cancelled by customer (${context.user!.email})`
        break
    }

    if (!canCancel) {
      logger.warn('Insufficient permissions to cancel appointment', {
        userRole: context.user!.role,
        userId: context.user!.id,
        appointmentCustomer: appointment.customers.profile_id,
        appointmentStaff: appointment.staff.profile_id,
        appointmentStatus: appointment.status
      })
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: { message: 'Insufficient permissions to cancel this appointment', code: 'INSUFFICIENT_PERMISSIONS' },
          correlationId: context.correlationId
        })
      }
    }

    // Check if appointment is in the past
    const appointmentStart = new Date(appointment.starts_at)
    const now = new Date()
    if (appointmentStart < now) {
      logger.warn('Attempt to cancel past appointment', {
        appointmentId: appointment_id,
        startsAt: appointment.starts_at,
        currentTime: now.toISOString()
      })
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: { message: 'Cannot cancel appointments that have already started', code: 'APPOINTMENT_IN_PAST' },
          correlationId: context.correlationId
        })
      }
    }

    // Prepare cancellation data
    const updateData: Record<string, unknown> = {
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }

    // Add comprehensive cancellation notes
    const timestamp = new Date().toISOString()
    const reasonText = reason ? `: ${reason}` : ''
    const fullCancellationNote = `${cancellationNotes} on ${timestamp}${reasonText}`
    
    updateData.internal_notes = appointment.internal_notes 
      ? `${appointment.internal_notes}\n\n${fullCancellationNote}`
      : fullCancellationNote

    // Update the appointment
    const { data: updatedAppointment, error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointment_id)
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

    if (updateError) {
      logger.error('Failed to cancel appointment', { 
        error: updateError,
        appointmentId: appointment_id 
      })
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Failed to cancel appointment', code: 'CANCEL_FAILED' },
          correlationId: context.correlationId
        })
      }
    }

    // Log successful cancellation for audit
    logger.info('Appointment cancelled successfully', {
      appointmentId: appointment_id,
      customerId: appointment.customer_id,
      staffId: appointment.staff_id,
      cancelledBy: context.user!.role,
      reason: reason || 'No reason provided',
      originalStatus: appointment.status
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: { 
          appointment: updatedAppointment,
          message: 'Appointment cancelled successfully'
        },
        correlationId: context.correlationId
      })
    }

  } catch (error) {
    logger.error('Unexpected error in booking cancellation', { 
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
  cancelBookingHandler,
  'booking_cancel',
  'appointments'
)