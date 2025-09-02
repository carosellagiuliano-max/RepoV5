/**
 * Appointment Reschedule and Cancel Management
 * Provides policy-enforced reschedule and cancellation functionality
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { createAdminClient, createLogger, generateCorrelationId, withAuthAndRateLimit } from '../../../src/lib/auth/netlify-auth'
import { z } from 'zod'

// Validation schemas
const RescheduleSchema = z.object({
  appointment_id: z.string().uuid(),
  new_starts_at: z.string().datetime(),
  new_ends_at: z.string().datetime(),
  reason: z.string().optional()
})

const CancelSchema = z.object({
  appointment_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  cancellation_type: z.enum(['customer', 'staff', 'admin']).optional().default('customer')
})

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
  'Content-Type': 'application/json',
}

/**
 * Check if appointment can be rescheduled based on policies
 */
async function canRescheduleAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
  userId: string,
  userRole: string
): Promise<{ canReschedule: boolean; reason?: string; appointment?: any }> {
  try {
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profiles (id, full_name, email)
        )
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return { canReschedule: false, reason: 'Appointment not found' }
    }

    // Check if user has permission to reschedule this appointment
    if (userRole === 'customer') {
      if (appointment.customers?.profiles?.id !== userId) {
        return { canReschedule: false, reason: 'Not authorized to reschedule this appointment' }
      }
    }

    // Check appointment status
    if (appointment.status !== 'confirmed' && appointment.status !== 'pending') {
      return { 
        canReschedule: false, 
        reason: `Cannot reschedule ${appointment.status} appointment` 
      }
    }

    // Check reschedule deadline policy
    const { data: policyData, error: policyError } = await supabase
      .rpc('get_booking_policy', { policy_key: 'reschedule_deadline_hours' })

    const deadlineHours = parseInt(policyData || '2')
    const deadlineTime = new Date(appointment.starts_at)
    deadlineTime.setHours(deadlineTime.getHours() - deadlineHours)

    if (new Date() >= deadlineTime) {
      return {
        canReschedule: false,
        reason: `Reschedule deadline has passed. Must reschedule at least ${deadlineHours} hours before appointment.`
      }
    }

    // Check maximum reschedule limit (implemented as appointment metadata)
    const rescheduleCount = appointment.internal_notes ? 
      (appointment.internal_notes.match(/RESCHEDULED/g) || []).length : 0
    
    const { data: maxRescheduleData } = await supabase
      .rpc('get_booking_policy', { policy_key: 'max_reschedules' })
    
    const maxReschedules = parseInt(maxRescheduleData || '3')
    
    if (rescheduleCount >= maxReschedules) {
      return {
        canReschedule: false,
        reason: `Maximum reschedule limit reached (${maxReschedules} reschedules allowed)`
      }
    }

    return { canReschedule: true, appointment }

  } catch (error) {
    return { canReschedule: false, reason: 'Error checking reschedule eligibility' }
  }
}

/**
 * Check if appointment can be cancelled based on policies
 */
async function canCancelAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
  userId: string,
  userRole: string
): Promise<{ canCancel: boolean; reason?: string; appointment?: any }> {
  try {
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profiles (id, full_name, email)
        )
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return { canCancel: false, reason: 'Appointment not found' }
    }

    // Check if user has permission to cancel this appointment
    if (userRole === 'customer') {
      if (appointment.customers?.profiles?.id !== userId) {
        return { canCancel: false, reason: 'Not authorized to cancel this appointment' }
      }
    }

    // Check appointment status
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return { 
        canCancel: false, 
        reason: `Cannot cancel ${appointment.status} appointment` 
      }
    }

    // Check cancellation deadline policy (admin/staff can always cancel)
    if (userRole === 'customer') {
      const { data: policyData, error: policyError } = await supabase
        .rpc('get_booking_policy', { policy_key: 'cancellation_deadline_hours' })

      const deadlineHours = parseInt(policyData || '24')
      const deadlineTime = new Date(appointment.starts_at)
      deadlineTime.setHours(deadlineTime.getHours() - deadlineHours)

      if (new Date() >= deadlineTime) {
        return {
          canCancel: false,
          reason: `Cancellation deadline has passed. Must cancel at least ${deadlineHours} hours before appointment.`
        }
      }
    }

    return { canCancel: true, appointment }

  } catch (error) {
    return { canCancel: false, reason: 'Error checking cancellation eligibility' }
  }
}

/**
 * Reschedule an appointment
 */
async function rescheduleAppointment(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string,
  userRole: string
) {
  const idempotencyKey = event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key']
  
  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'X-Idempotency-Key header is required for reschedule operations' 
      })
    }
  }

  let rescheduleData
  try {
    rescheduleData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = RescheduleSchema.safeParse(rescheduleData)
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
    // Check if operation already exists (idempotency)
    const { data: existingOperation, error: operationCheckError } = await supabase
      .from('booking_operations')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (!operationCheckError && existingOperation) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          operation_id: existingOperation.id,
          status: existingOperation.status,
          error_message: existingOperation.error_message
        })
      }
    }

    // Check if reschedule is allowed
    const rescheduleCheck = await canRescheduleAppointment(
      supabase, 
      validatedData.appointment_id, 
      userId, 
      userRole
    )

    if (!rescheduleCheck.canReschedule) {
      // Log failed operation
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'reschedule',
          request_data: validatedData,
          status: 'failed',
          error_message: rescheduleCheck.reason,
          user_id: userId
        })

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Reschedule not allowed',
          reason: rescheduleCheck.reason
        })
      }
    }

    // Validate new appointment timing
    const { data: timingValidation, error: timingError } = await supabase
      .rpc('validate_appointment_timing', {
        appointment_start: validatedData.new_starts_at,
        appointment_end: validatedData.new_ends_at
      })

    if (timingError || !timingValidation[0]?.is_valid) {
      const errorMessage = timingValidation[0]?.error_message || 'Invalid appointment timing'
      
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'reschedule',
          request_data: validatedData,
          status: 'failed',
          error_message: errorMessage,
          user_id: userId
        })

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid new appointment time',
          details: errorMessage
        })
      }
    }

    // Get buffer minutes for slot validation
    const { data: bufferSetting } = await supabase
      .rpc('get_booking_policy', { policy_key: 'buffer_time_minutes' })
    
    const bufferMinutes = parseInt(bufferSetting || '15')

    // Validate new slot availability
    const { data: slotValidation, error: slotError } = await supabase
      .rpc('rpc_validate_appointment_slot', {
        p_staff_id: rescheduleCheck.appointment.staff_id,
        p_service_id: rescheduleCheck.appointment.service_id,
        p_starts_at: validatedData.new_starts_at,
        p_ends_at: validatedData.new_ends_at,
        p_buffer_minutes: bufferMinutes,
        p_exclude_appointment_id: validatedData.appointment_id
      })

    if (slotError || !slotValidation?.is_valid) {
      const errorMessage = slotValidation?.errors?.[0] || 'New time slot is not available'
      
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'reschedule',
          request_data: validatedData,
          status: 'failed',
          error_message: errorMessage,
          user_id: userId
        })

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'New time slot not available',
          details: errorMessage
        })
      }
    }

    // Update the appointment
    const currentNotes = rescheduleCheck.appointment.internal_notes || ''
    const rescheduleNote = `RESCHEDULED on ${new Date().toISOString()} by ${userRole} (${userId})${validatedData.reason ? ': ' + validatedData.reason : ''}`
    
    const { data: updatedAppointment, error: updateError } = await supabase
      .from('appointments')
      .update({
        starts_at: validatedData.new_starts_at,
        ends_at: validatedData.new_ends_at,
        internal_notes: currentNotes + '\n' + rescheduleNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedData.appointment_id)
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
      logger.error('Error updating appointment for reschedule', { error: updateError })
      
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'reschedule',
          request_data: validatedData,
          status: 'failed',
          error_message: 'Database update failed',
          user_id: userId
        })

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to reschedule appointment' })
      }
    }

    // Log successful operation
    await supabase
      .from('booking_operations')
      .insert({
        idempotency_key: idempotencyKey,
        operation_type: 'reschedule',
        appointment_id: validatedData.appointment_id,
        request_data: validatedData,
        response_data: { appointment: updatedAppointment },
        status: 'completed',
        user_id: userId
      })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        appointment: updatedAppointment
      })
    }

  } catch (error) {
    logger.error('Unexpected error in rescheduleAppointment', { error, idempotencyKey })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Cancel an appointment
 */
async function cancelAppointment(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string,
  userRole: string
) {
  const idempotencyKey = event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key']
  
  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'X-Idempotency-Key header is required for cancel operations' 
      })
    }
  }

  let cancelData
  try {
    cancelData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = CancelSchema.safeParse(cancelData)
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
    // Check if operation already exists (idempotency)
    const { data: existingOperation, error: operationCheckError } = await supabase
      .from('booking_operations')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (!operationCheckError && existingOperation) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          operation_id: existingOperation.id,
          status: existingOperation.status,
          error_message: existingOperation.error_message
        })
      }
    }

    // Check if cancellation is allowed
    const cancelCheck = await canCancelAppointment(
      supabase, 
      validatedData.appointment_id, 
      userId, 
      userRole
    )

    if (!cancelCheck.canCancel) {
      // Log failed operation
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'cancel',
          request_data: validatedData,
          status: 'failed',
          error_message: cancelCheck.reason,
          user_id: userId
        })

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Cancellation not allowed',
          reason: cancelCheck.reason
        })
      }
    }

    // Update the appointment to cancelled status
    const currentNotes = cancelCheck.appointment.internal_notes || ''
    const cancelNote = `CANCELLED on ${new Date().toISOString()} by ${userRole} (${userId}): ${validatedData.reason}`
    
    const { data: cancelledAppointment, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        internal_notes: currentNotes + '\n' + cancelNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedData.appointment_id)
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
      logger.error('Error cancelling appointment', { error: updateError })
      
      await supabase
        .from('booking_operations')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'cancel',
          request_data: validatedData,
          status: 'failed',
          error_message: 'Database update failed',
          user_id: userId
        })

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to cancel appointment' })
      }
    }

    // Log successful operation
    await supabase
      .from('booking_operations')
      .insert({
        idempotency_key: idempotencyKey,
        operation_type: 'cancel',
        appointment_id: validatedData.appointment_id,
        request_data: validatedData,
        response_data: { appointment: cancelledAppointment },
        status: 'completed',
        user_id: userId
      })

    // Check waitlist for notifications (simplified implementation)
    if (cancelledAppointment.starts_at) {
      const appointmentDate = new Date(cancelledAppointment.starts_at).toISOString().split('T')[0]
      
      // Find waitlist entries that might be interested in this slot
      const { data: waitlistEntries } = await supabase
        .from('waitlist')
        .select('*')
        .eq('service_id', cancelledAppointment.service_id)
        .eq('status', 'active')
        .gte('preferred_start_date', appointmentDate)
        .lte('preferred_end_date', appointmentDate)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(5)

      if (waitlistEntries && waitlistEntries.length > 0) {
        // Update waitlist entries to 'notified' status
        await supabase
          .from('waitlist')
          .update({ status: 'notified' })
          .in('id', waitlistEntries.map(entry => entry.id))

        logger.info('Waitlist entries notified for cancelled appointment', {
          appointmentId: validatedData.appointment_id,
          waitlistCount: waitlistEntries.length
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        appointment: cancelledAppointment
      })
    }

  } catch (error) {
    logger.error('Unexpected error in cancelAppointment', { error, idempotencyKey })
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

    logger.info('Appointment reschedule/cancel request', {
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

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', context.user.id)
      .single()

    if (profileError || !profile) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'User profile not found' })
      }
    }

    const userRole = profile.role

    try {
      if (event.httpMethod === 'PUT' && event.path?.includes('/reschedule')) {
        return await rescheduleAppointment(event, supabase, logger, context.user.id, userRole)
      }

      if (event.httpMethod === 'PUT' && event.path?.includes('/cancel')) {
        return await cancelAppointment(event, supabase, logger, context.user.id, userRole)
      }

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Endpoint not found' })
      }

    } catch (error) {
      logger.error('Unexpected error in reschedule/cancel handler', { error })
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
      maxRequests: 10   // 10 requests per minute
    }
  }
)