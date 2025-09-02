/**
 * Admin Appointments Management API
 * Handles CRUD operations for appointments with conflict checking
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../src/lib/validation/schemas'

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin appointments management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetAppointments(event, supabase, logger)

        case 'POST':
          return await handleCreateAppointment(event, supabase, logger, context.user.id)

        case 'PUT':
          return await handleUpdateAppointment(event, supabase, logger)

        case 'DELETE':
          return await handleDeleteAppointment(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Appointments management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 100, windowMs: 60 * 1000 }
)

async function handleGetAppointments(event: any, supabase: any, logger: any) {
  const query = validateQuery(schemas.appointmentFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('appointments_with_details')
    .select('*')

  // Apply filters
  if (query.staffId) {
    dbQuery = dbQuery.eq('staff_id', query.staffId)
  }

  if (query.serviceId) {
    dbQuery = dbQuery.eq('service_id', query.serviceId)
  }

  if (query.customerId) {
    dbQuery = dbQuery.eq('customer_id', query.customerId)
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.startDate) {
    dbQuery = dbQuery.gte('start_time', query.startDate + 'T00:00:00Z')
  }

  if (query.endDate) {
    dbQuery = dbQuery.lte('start_time', query.endDate + 'T23:59:59Z')
  }

  if (query.search) {
    dbQuery = dbQuery.or(`customer_first_name.ilike.%${query.search}%,customer_last_name.ilike.%${query.search}%,customer_email.ilike.%${query.search}%,service_name.ilike.%${query.search}%`)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'start_time'
  const sortOrder = query.sortOrder || 'asc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: appointments, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch appointments', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Appointments fetched successfully', { count: appointments?.length })

  return createSuccessResponse({
    appointments,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleCreateAppointment(event: any, supabase: any, logger: any, adminUserId: string) {
  const body = JSON.parse(event.body || '{}')
  
  const appointmentData = validateBody(schemas.appointment.create, {
    customer_id: body.customer_id,
    staff_id: body.staff_id,
    service_id: body.service_id,
    start_time: body.start_time,
    end_time: body.end_time,
    status: body.status || 'confirmed', // Admin can directly confirm
    notes: body.notes
  })

  // Check for conflicts using our database function
  const { data: hasConflict, error: conflictError } = await supabase
    .rpc('check_appointment_conflicts', {
      p_staff_id: appointmentData.staff_id,
      p_start_time: appointmentData.start_time,
      p_end_time: appointmentData.end_time
    })

  if (conflictError) {
    logger.error('Failed to check appointment conflicts', { error: conflictError })
    throw conflictError
  }

  if (hasConflict) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Appointment conflicts with existing schedule',
      code: 'APPOINTMENT_CONFLICT'
    })
  }

  // Validate that the staff member offers this service
  const { data: staffService, error: staffServiceError } = await supabase
    .from('staff_services')
    .select('id')
    .eq('staff_id', appointmentData.staff_id)
    .eq('service_id', appointmentData.service_id)
    .eq('is_active', true)
    .single()

  if (staffServiceError || !staffService) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Staff member does not offer this service',
      code: 'STAFF_SERVICE_MISMATCH'
    })
  }

  // Create the appointment
  const { data: appointment, error: createError } = await supabase
    .from('appointments')
    .insert(appointmentData)
    .select()
    .single()

  if (createError) {
    logger.error('Failed to create appointment', { error: createError })
    throw createError
  }

  // Fetch the complete appointment with details
  const { data: completeAppointment } = await supabase
    .from('appointments_with_details')
    .select('*')
    .eq('id', appointment.id)
    .single()

  logger.info('Appointment created successfully', { 
    appointmentId: appointment.id,
    createdBy: adminUserId 
  })

  return createSuccessResponse(completeAppointment, 201)
}

async function handleUpdateAppointment(event: any, supabase: any, logger: any) {
  const appointmentId = event.path.split('/').pop()
  if (!appointmentId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Appointment ID is required',
      code: 'APPOINTMENT_ID_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')

  // Get existing appointment
  const { data: existingAppointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !existingAppointment) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Appointment not found',
      code: 'APPOINTMENT_NOT_FOUND'
    })
  }

  // Validate updates
  const updates: any = {}
  if (body.staff_id !== undefined) updates.staff_id = body.staff_id
  if (body.service_id !== undefined) updates.service_id = body.service_id
  if (body.start_time !== undefined) updates.start_time = body.start_time
  if (body.end_time !== undefined) updates.end_time = body.end_time
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'cancelled') {
      updates.cancellation_reason = body.cancellation_reason
      updates.cancelled_at = new Date().toISOString()
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0) {
    return createErrorResponse({
      statusCode: 400,
      message: 'No updates provided',
      code: 'NO_UPDATES'
    })
  }

  // If time or staff is being changed, check for conflicts
  if (updates.start_time || updates.end_time || updates.staff_id) {
    const startTime = updates.start_time || existingAppointment.start_time
    const endTime = updates.end_time || existingAppointment.end_time
    const staffId = updates.staff_id || existingAppointment.staff_id

    const { data: hasConflict, error: conflictError } = await supabase
      .rpc('check_appointment_conflicts', {
        p_staff_id: staffId,
        p_start_time: startTime,
        p_end_time: endTime,
        p_exclude_appointment_id: appointmentId
      })

    if (conflictError) {
      logger.error('Failed to check appointment conflicts', { error: conflictError })
      throw conflictError
    }

    if (hasConflict) {
      return createErrorResponse({
        statusCode: 409,
        message: 'Updated appointment conflicts with existing schedule',
        code: 'APPOINTMENT_CONFLICT'
      })
    }
  }

  // If service is being changed, validate staff offers new service
  if (updates.service_id) {
    const staffId = updates.staff_id || existingAppointment.staff_id
    
    const { data: staffService, error: staffServiceError } = await supabase
      .from('staff_services')
      .select('id')
      .eq('staff_id', staffId)
      .eq('service_id', updates.service_id)
      .eq('is_active', true)
      .single()

    if (staffServiceError || !staffService) {
      return createErrorResponse({
        statusCode: 400,
        message: 'Staff member does not offer this service',
        code: 'STAFF_SERVICE_MISMATCH'
      })
    }
  }

  const validatedUpdates = validateBody(schemas.appointment.update, updates)

  const { error: updateError } = await supabase
    .from('appointments')
    .update(validatedUpdates)
    .eq('id', appointmentId)

  if (updateError) {
    logger.error('Failed to update appointment', { error: updateError })
    throw updateError
  }

  // Fetch updated appointment
  const { data: updatedAppointment } = await supabase
    .from('appointments_with_details')
    .select('*')
    .eq('id', appointmentId)
    .single()

  logger.info('Appointment updated successfully', { appointmentId })

  return createSuccessResponse(updatedAppointment)
}

async function handleDeleteAppointment(event: any, supabase: any, logger: any) {
  const appointmentId = event.path.split('/').pop()
  if (!appointmentId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Appointment ID is required',
      code: 'APPOINTMENT_ID_REQUIRED'
    })
  }

  // Get appointment details first
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appointment) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Appointment not found',
      code: 'APPOINTMENT_NOT_FOUND'
    })
  }

  // Check if appointment is in the past and completed
  const appointmentDate = new Date(appointment.start_time)
  const now = new Date()

  if (appointmentDate < now && appointment.status === 'completed') {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot delete completed appointment',
      code: 'COMPLETED_APPOINTMENT'
    })
  }

  // Soft delete - mark as cancelled instead of hard delete
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancellation_reason: 'Cancelled by administrator',
      cancelled_at: new Date().toISOString()
    })
    .eq('id', appointmentId)

  if (updateError) {
    logger.error('Failed to cancel appointment', { error: updateError })
    throw updateError
  }

  logger.info('Appointment cancelled successfully', { appointmentId })

  return createSuccessResponse({ message: 'Appointment cancelled successfully' })
}