/**
 * Admin Staff Management API
 * Handles CRUD operations for staff members
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../src/lib/validation/schemas'
import { StaffWithProfile, StaffInsert, StaffUpdate, ProfileInsert, ProfileUpdate } from '../../src/lib/types/database'

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin staff management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetStaff(event, supabase, logger)

        case 'POST':
          return await handleCreateStaff(event, supabase, logger, context.user.id)

        case 'PUT':
          return await handleUpdateStaff(event, supabase, logger)

        case 'DELETE':
          return await handleDeleteStaff(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Staff management operation failed', { error })
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

async function handleGetStaff(event: any, supabase: any, logger: any) {
  const query = validateQuery(schemas.staffFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('staff_with_profiles')
    .select('*')

  // Apply filters
  if (query.isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.isActive)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`first_name.ilike.%${query.search}%,last_name.ilike.%${query.search}%,email.ilike.%${query.search}%`)
  }

  if (query.specialties && query.specialties.length > 0) {
    dbQuery = dbQuery.overlaps('specialties', query.specialties)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'created_at'
  const sortOrder = query.sortOrder || 'desc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: staff, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch staff', { error })
    throw error
  }

  // Get staff services for each staff member
  if (staff && staff.length > 0) {
    const staffIds = staff.map((s: any) => s.id)
    const { data: staffServices } = await supabase
      .from('staff_services')
      .select(`
        staff_id,
        service_id,
        services (
          id,
          name,
          category,
          price_cents,
          duration_minutes
        )
      `)
      .in('staff_id', staffIds)
      .eq('is_active', true)

    // Attach services to each staff member
    staff.forEach((staffMember: any) => {
      staffMember.services = staffServices
        ?.filter((ss: any) => ss.staff_id === staffMember.id)
        .map((ss: any) => ss.services) || []
    })
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Staff fetched successfully', { count: staff?.length })

  return createSuccessResponse({
    staff,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleCreateStaff(event: any, supabase: any, logger: any, adminUserId: string) {
  const body = JSON.parse(event.body || '{}')
  
  // Validate the request body
  const profileData = validateBody(schemas.profile.create, {
    email: body.email,
    role: 'staff',
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone,
    avatar_url: body.avatar_url,
    is_active: body.is_active ?? true
  })

  const staffData = validateBody(schemas.staff.create, {
    profile_id: '', // Will be set after profile creation
    specialties: body.specialties,
    bio: body.bio,
    hire_date: body.hire_date,
    hourly_rate: body.hourly_rate,
    commission_rate: body.commission_rate,
    is_active: body.is_active ?? true
  })

  // Start transaction
  const { data: profile, error: profileError } = await supabase.auth.admin.createUser({
    email: profileData.email,
    email_confirm: true,
    user_metadata: {
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      role: 'staff'
    }
  })

  if (profileError) {
    logger.error('Failed to create user account', { error: profileError })
    throw new Error('Failed to create user account')
  }

  // Create profile record
  const { error: profileInsertError } = await supabase
    .from('profiles')
    .insert({
      id: profile.user.id,
      email: profileData.email,
      role: 'staff',
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      phone: profileData.phone,
      avatar_url: profileData.avatar_url,
      is_active: profileData.is_active
    })

  if (profileInsertError) {
    logger.error('Failed to create profile', { error: profileInsertError })
    // Cleanup - delete the auth user
    await supabase.auth.admin.deleteUser(profile.user.id)
    throw new Error('Failed to create profile')
  }

  // Create staff record
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .insert({
      ...staffData,
      profile_id: profile.user.id
    })
    .select()
    .single()

  if (staffError) {
    logger.error('Failed to create staff record', { error: staffError })
    // Cleanup
    await supabase.auth.admin.deleteUser(profile.user.id)
    throw new Error('Failed to create staff record')
  }

  // Assign services if provided
  if (body.serviceIds && body.serviceIds.length > 0) {
    const serviceAssignments = body.serviceIds.map((serviceId: string) => ({
      staff_id: staff.id,
      service_id: serviceId
    }))

    const { error: servicesError } = await supabase
      .from('staff_services')
      .insert(serviceAssignments)

    if (servicesError) {
      logger.error('Failed to assign services', { error: servicesError })
      // Continue - this is not critical
    }
  }

  // Fetch the complete staff record with profile
  const { data: completeStaff } = await supabase
    .from('staff_with_profiles')
    .select('*')
    .eq('id', staff.id)
    .single()

  logger.info('Staff member created successfully', { staffId: staff.id })

  return createSuccessResponse(completeStaff, 201)
}

async function handleUpdateStaff(event: any, supabase: any, logger: any) {
  const staffId = event.path.split('/').pop()
  if (!staffId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Staff ID is required',
      code: 'STAFF_ID_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')

  // Get existing staff record
  const { data: existingStaff, error: fetchError } = await supabase
    .from('staff_with_profiles')
    .select('*')
    .eq('id', staffId)
    .single()

  if (fetchError || !existingStaff) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Staff member not found',
      code: 'STAFF_NOT_FOUND'
    })
  }

  // Validate updates
  const profileUpdates: any = {}
  if (body.email) profileUpdates.email = body.email
  if (body.first_name !== undefined) profileUpdates.first_name = body.first_name
  if (body.last_name !== undefined) profileUpdates.last_name = body.last_name
  if (body.phone !== undefined) profileUpdates.phone = body.phone
  if (body.avatar_url !== undefined) profileUpdates.avatar_url = body.avatar_url
  if (body.is_active !== undefined) profileUpdates.is_active = body.is_active

  const staffUpdates: any = {}
  if (body.specialties !== undefined) staffUpdates.specialties = body.specialties
  if (body.bio !== undefined) staffUpdates.bio = body.bio
  if (body.hire_date !== undefined) staffUpdates.hire_date = body.hire_date
  if (body.hourly_rate !== undefined) staffUpdates.hourly_rate = body.hourly_rate
  if (body.commission_rate !== undefined) staffUpdates.commission_rate = body.commission_rate
  if (body.is_active !== undefined) staffUpdates.is_active = body.is_active

  // Update profile if needed
  if (Object.keys(profileUpdates).length > 0) {
    const validatedProfileUpdates = validateBody(schemas.profile.update, profileUpdates)
    
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update(validatedProfileUpdates)
      .eq('id', existingStaff.profile_id)

    if (profileUpdateError) {
      logger.error('Failed to update profile', { error: profileUpdateError })
      throw new Error('Failed to update profile')
    }
  }

  // Update staff record if needed
  if (Object.keys(staffUpdates).length > 0) {
    const validatedStaffUpdates = validateBody(schemas.staff.update, staffUpdates)
    
    const { error: staffUpdateError } = await supabase
      .from('staff')
      .update(validatedStaffUpdates)
      .eq('id', staffId)

    if (staffUpdateError) {
      logger.error('Failed to update staff', { error: staffUpdateError })
      throw new Error('Failed to update staff')
    }
  }

  // Update service assignments if provided
  if (body.serviceIds !== undefined) {
    // Remove existing assignments
    await supabase
      .from('staff_services')
      .delete()
      .eq('staff_id', staffId)

    // Add new assignments
    if (body.serviceIds.length > 0) {
      const serviceAssignments = body.serviceIds.map((serviceId: string) => ({
        staff_id: staffId,
        service_id: serviceId
      }))

      const { error: servicesError } = await supabase
        .from('staff_services')
        .insert(serviceAssignments)

      if (servicesError) {
        logger.error('Failed to update service assignments', { error: servicesError })
        // Continue - this is not critical
      }
    }
  }

  // Fetch updated staff record
  const { data: updatedStaff } = await supabase
    .from('staff_with_profiles')
    .select('*')
    .eq('id', staffId)
    .single()

  logger.info('Staff member updated successfully', { staffId })

  return createSuccessResponse(updatedStaff)
}

async function handleDeleteStaff(event: any, supabase: any, logger: any) {
  const staffId = event.path.split('/').pop()
  if (!staffId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Staff ID is required',
      code: 'STAFF_ID_REQUIRED'
    })
  }

  // Check if staff has future appointments
  const { data: futureAppointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id')
    .eq('staff_id', staffId)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])

  if (appointmentsError) {
    logger.error('Failed to check future appointments', { error: appointmentsError })
    throw new Error('Failed to check future appointments')
  }

  if (futureAppointments && futureAppointments.length > 0) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot delete staff member with future appointments',
      code: 'HAS_FUTURE_APPOINTMENTS'
    })
  }

  // Soft delete - deactivate instead of hard delete
  const { error: deactivateError } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', staffId)

  if (deactivateError) {
    logger.error('Failed to deactivate staff', { error: deactivateError })
    throw new Error('Failed to deactivate staff')
  }

  // Also deactivate the profile
  const { data: staff } = await supabase
    .from('staff')
    .select('profile_id')
    .eq('id', staffId)
    .single()

  if (staff?.profile_id) {
    await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', staff.profile_id)
  }

  logger.info('Staff member deactivated successfully', { staffId })

  return createSuccessResponse({ message: 'Staff member deactivated successfully' })
}