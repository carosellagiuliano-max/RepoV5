/**
 * Admin Services Management API
 * Handles CRUD operations for services
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../src/lib/validation/schemas'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin services management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetServices(event, supabase, logger)

        case 'POST':
          return await handleCreateService(event, supabase, logger)

        case 'PUT':
          return await handleUpdateService(event, supabase, logger)

        case 'DELETE':
          return await handleDeleteService(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Services management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 50, windowMs: 60 * 1000 }
)

async function handleGetServices(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.serviceFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('services')
    .select(`
      *,
      staff_services!inner (
        staff_id,
        staff:staff_id (
          id,
          profiles:profile_id (
            first_name,
            last_name,
            is_active
          ),
          is_active
        )
      )
    `)

  // Apply filters
  if (query.isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.isActive)
  }

  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`name.ilike.%${query.search}%,description.ilike.%${query.search}%,category.ilike.%${query.search}%`)
  }

  if (query.staffId) {
    dbQuery = dbQuery.eq('staff_services.staff_id', query.staffId)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'name'
  const sortOrder = query.sortOrder || 'asc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: services, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch services', { error })
    throw error
  }

  // Transform the data to include assigned staff
  const transformedServices = services?.map((service: Database['public']['Tables']['services']['Row'] & {
    staff_services?: Array<{
      staff: Database['public']['Tables']['staff']['Row'] & {
        profiles: Database['public']['Tables']['profiles']['Row']
      }
    }>
  }) => ({
    ...service,
    assigned_staff: service.staff_services
      ?.filter((ss) => ss.staff?.is_active && ss.staff?.profiles?.is_active)
      .map((ss) => ({
        id: ss.staff.id,
        name: `${ss.staff.profiles.first_name} ${ss.staff.profiles.last_name}`.trim()
      })) || []
  }))

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Services fetched successfully', { count: transformedServices?.length })

  return createSuccessResponse({
    services: transformedServices,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleCreateService(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const body = JSON.parse(event.body || '{}')
  
  const serviceData = validateBody(schemas.service.create, {
    name: body.name,
    description: body.description,
    duration_minutes: body.duration_minutes,
    price_cents: body.price_cents,
    category: body.category,
    is_active: body.is_active ?? true,
    requires_consultation: body.requires_consultation ?? false
  })

  const { data: service, error } = await supabase
    .from('services')
    .insert(serviceData)
    .select()
    .single()

  if (error) {
    logger.error('Failed to create service', { error })
    throw error
  }

  // Assign to staff if provided
  if (body.staffIds && body.staffIds.length > 0) {
    const staffAssignments = body.staffIds.map((staffId: string) => ({
      staff_id: staffId,
      service_id: service.id
    }))

    const { error: assignmentError } = await supabase
      .from('staff_services')
      .insert(staffAssignments)

    if (assignmentError) {
      logger.error('Failed to assign service to staff', { error: assignmentError })
      // Continue - service was created successfully
    }
  }

  logger.info('Service created successfully', { serviceId: service.id })

  return createSuccessResponse(service, 201)
}

async function handleUpdateService(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const serviceId = event.path.split('/').pop()
  if (!serviceId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Service ID is required',
      code: 'SERVICE_ID_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')

  // Validate updates
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes
  if (body.price_cents !== undefined) updates.price_cents = body.price_cents
  if (body.category !== undefined) updates.category = body.category
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.requires_consultation !== undefined) updates.requires_consultation = body.requires_consultation

  if (Object.keys(updates).length === 0 && !body.staffIds) {
    return createErrorResponse({
      statusCode: 400,
      message: 'No updates provided',
      code: 'NO_UPDATES'
    })
  }

  // Update service
  if (Object.keys(updates).length > 0) {
    const validatedUpdates = validateBody(schemas.service.update, updates)
    
    const { error: updateError } = await supabase
      .from('services')
      .update(validatedUpdates)
      .eq('id', serviceId)

    if (updateError) {
      logger.error('Failed to update service', { error: updateError })
      throw updateError
    }
  }

  // Update staff assignments if provided
  if (body.staffIds !== undefined) {
    // Remove existing assignments
    await supabase
      .from('staff_services')
      .delete()
      .eq('service_id', serviceId)

    // Add new assignments
    if (body.staffIds.length > 0) {
      const staffAssignments = body.staffIds.map((staffId: string) => ({
        staff_id: staffId,
        service_id: serviceId
      }))

      const { error: assignmentError } = await supabase
        .from('staff_services')
        .insert(staffAssignments)

      if (assignmentError) {
        logger.error('Failed to update staff assignments', { error: assignmentError })
        // Continue - service was updated successfully
      }
    }
  }

  // Fetch updated service
  const { data: updatedService } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()

  logger.info('Service updated successfully', { serviceId })

  return createSuccessResponse(updatedService)
}

async function handleDeleteService(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const serviceId = event.path.split('/').pop()
  if (!serviceId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Service ID is required',
      code: 'SERVICE_ID_REQUIRED'
    })
  }

  // Check if service has future appointments
  const { data: futureAppointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id')
    .eq('service_id', serviceId)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])

  if (appointmentsError) {
    logger.error('Failed to check future appointments', { error: appointmentsError })
    throw appointmentsError
  }

  if (futureAppointments && futureAppointments.length > 0) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot delete service with future appointments',
      code: 'HAS_FUTURE_APPOINTMENTS'
    })
  }

  // Soft delete - deactivate instead of hard delete
  const { error: deactivateError } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', serviceId)

  if (deactivateError) {
    logger.error('Failed to deactivate service', { error: deactivateError })
    throw deactivateError
  }

  logger.info('Service deactivated successfully', { serviceId })

  return createSuccessResponse({ message: 'Service deactivated successfully' })
}