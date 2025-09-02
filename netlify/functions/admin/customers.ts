/**
 * Admin Customer Management API
 * Handles CRUD operations for customers with GDPR compliance
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../src/lib/validation/schemas'
import { Database } from '../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin customer management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      // Handle different HTTP methods and paths
      // Robustly extract customerId: find "customers" and take the next segment
      const customersIdx = pathSegments.indexOf('customers')
      const customerId = (customersIdx !== -1 && pathSegments.length > customersIdx + 1)
        ? pathSegments[customersIdx + 1]
        : undefined

      switch (event.httpMethod) {
        case 'GET':
          if (customerId && customerId !== 'customers') {
            if (pathSegments.includes('audit-log')) {
              return await handleGetCustomerAuditLog(customerId, supabase, logger)
            } else if (pathSegments.includes('export')) {
              return await handleExportCustomerData(customerId, supabase, logger)
            } else {
              return await handleGetCustomer(customerId, supabase, logger)
            }
          } else {
            return await handleGetCustomers(event, supabase, logger)
          }

        case 'POST':
          return await handleCreateCustomer(event, supabase, logger, context.user.id)

        case 'PUT':
          if (!customerId || customerId === 'customers') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Customer ID is required for updates',
              code: 'CUSTOMER_ID_REQUIRED'
            })
          }
          return await handleUpdateCustomer(customerId, event, supabase, logger, context.user.id)

        case 'DELETE':
          if (!customerId || customerId === 'customers') {
            return createErrorResponse({
              statusCode: 400,
              message: 'Customer ID is required for deletion',
              code: 'CUSTOMER_ID_REQUIRED'
            })
          }
          return await handleSoftDeleteCustomer(customerId, event, supabase, logger, context.user.id)

        case 'PATCH':
          if (pathSegments.includes('restore')) {
            return await handleRestoreCustomer(customerId, supabase, logger, context.user.id)
          }
          break

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Customer management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 100, windowMs: 60 * 1000 }
)

async function handleGetCustomers(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.customerFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('customers')
    .select(`
      *,
      profiles!inner (
        id,
        email,
        full_name,
        phone,
        role,
        created_at,
        updated_at
      )
    `)

  // Apply filters
  if (query.isDeleted !== undefined) {
    dbQuery = dbQuery.eq('is_deleted', query.isDeleted)
  } else {
    // Default to non-deleted customers
    dbQuery = dbQuery.eq('is_deleted', false)
  }

  if (query.hasGdprConsent !== undefined) {
    dbQuery = dbQuery.eq('gdpr_consent_given', query.hasGdprConsent)
  }

  if (query.city) {
    dbQuery = dbQuery.ilike('address_city', `%${query.city}%`)
  }

  if (query.postalCode) {
    dbQuery = dbQuery.eq('address_postal_code', query.postalCode)
  }

  if (query.registeredAfter) {
    dbQuery = dbQuery.gte('created_at', query.registeredAfter)
  }

  if (query.registeredBefore) {
    dbQuery = dbQuery.lte('created_at', query.registeredBefore)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`
      customer_number.ilike.%${query.search}%,
      profiles.full_name.ilike.%${query.search}%,
      profiles.email.ilike.%${query.search}%,
      profiles.phone.ilike.%${query.search}%
    `)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'created_at'
  const sortOrder = query.sortOrder || 'desc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: customers, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch customers', { error })
    throw error
  }

  // Get appointment counts for each customer
  const customerStats = customers && customers.length > 0 
    ? await getCustomerStats(customers.map(c => c.id), supabase)
    : []

  // Enhance customers with stats
  const customersWithStats = customers?.map(customer => ({
    ...customer,
    stats: customerStats.find(s => s.customer_id === customer.id) || {
      total_appointments: 0,
      upcoming_appointments: 0,
      completed_appointments: 0,
      cancelled_appointments: 0,
      total_spent: 0,
      last_appointment_date: null
    }
  }))

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Customers fetched successfully', { count: customersWithStats?.length })

  return createSuccessResponse({
    customers: customersWithStats,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleGetCustomer(customerId: string, supabase: SupabaseClient, logger: Logger) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      *,
      profiles!inner (
        id,
        email,
        full_name,
        phone,
        role,
        created_at,
        updated_at
      )
    `)
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Customer not found',
      code: 'CUSTOMER_NOT_FOUND'
    })
  }

  // Get customer stats
  const stats = await getCustomerStats([customerId], supabase)
  const customerWithStats = {
    ...customer,
    stats: stats[0] || {
      total_appointments: 0,
      upcoming_appointments: 0,
      completed_appointments: 0,
      cancelled_appointments: 0,
      total_spent: 0,
      last_appointment_date: null
    }
  }

  logger.info('Customer fetched successfully', { customerId })

  return createSuccessResponse(customerWithStats)
}

async function handleCreateCustomer(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const customerData = validateBody(schemas.customer.create, body)

  // Generate customer number if not provided
  if (!customerData.customer_number) {
    customerData.customer_number = await generateCustomerNumber(supabase)
  }

  // Set audit context
  await supabase.rpc('set_config', {
    parameter: 'app.current_user_id',
    value: adminUserId
  })

  try {
    // Create or get profile
    let profileId = customerData.profile_id

    if (!profileId) {
      // Create new user account
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: customerData.email,
        email_confirm: true,
        user_metadata: {
          full_name: customerData.full_name,
          role: 'customer'
        }
      })

      if (authError) {
        logger.error('Failed to create user account', { error: authError })
        throw new Error('Failed to create user account')
      }

      profileId = authUser.user.id

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: profileId,
          email: customerData.email,
          full_name: customerData.full_name,
          phone: customerData.phone,
          role: 'customer'
        })

      if (profileError) {
        logger.error('Failed to create profile', { error: profileError })
        // Cleanup
        await supabase.auth.admin.deleteUser(profileId)
        throw new Error('Failed to create profile')
      }
    }

    // Create customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        profile_id: profileId,
        customer_number: customerData.customer_number,
        date_of_birth: customerData.date_of_birth,
        address_street: customerData.address_street,
        address_city: customerData.address_city,
        address_postal_code: customerData.address_postal_code,
        emergency_contact_name: customerData.emergency_contact_name,
        emergency_contact_phone: customerData.emergency_contact_phone,
        notes: customerData.notes,
        gdpr_consent_given: customerData.gdpr_consent_given,
        gdpr_consent_date: customerData.gdpr_consent_given ? new Date().toISOString() : null
      })
      .select(`
        *,
        profiles!inner (
          id,
          email,
          full_name,
          phone,
          role,
          created_at,
          updated_at
        )
      `)
      .single()

    if (customerError) {
      logger.error('Failed to create customer record', { error: customerError })
      if (!customerData.profile_id) {
        // Cleanup if we created the profile
        await supabase.auth.admin.deleteUser(profileId)
      }
      throw new Error('Failed to create customer record')
    }

    logger.info('Customer created successfully', { customerId: customer.id })

    return createSuccessResponse(customer, 201)
  } catch (error) {
    logger.error('Customer creation failed', { error })
    throw error
  }
}

async function handleUpdateCustomer(
  customerId: string,
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const updates = validateBody(schemas.customer.update, body)

  // Set audit context
  await supabase.rpc('set_config', {
    parameter: 'app.current_user_id',
    value: adminUserId
  })

  // Get existing customer
  const { data: existingCustomer, error: fetchError } = await supabase
    .from('customers')
    .select('*, profiles!inner(*)')
    .eq('id', customerId)
    .single()

  if (fetchError || !existingCustomer) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Customer not found',
      code: 'CUSTOMER_NOT_FOUND'
    })
  }

  if (existingCustomer.is_deleted) {
    return createErrorResponse({
      statusCode: 409,
      message: 'Cannot update deleted customer',
      code: 'CUSTOMER_DELETED'
    })
  }

  try {
    // Update profile if needed
    const profileUpdates: Record<string, string | null | undefined> = {}
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', existingCustomer.profile_id)

      if (profileError) {
        logger.error('Failed to update profile', { error: profileError })
        throw new Error('Failed to update profile')
      }
    }

    // Update customer record
    const customerUpdates: Record<string, string | boolean | Date | null | undefined> = {}
    Object.keys(updates).forEach(key => {
      if (key !== 'full_name' && key !== 'phone' && updates[key as keyof typeof updates] !== undefined) {
        customerUpdates[key] = updates[key as keyof typeof updates]
      }
    })

    if (updates.gdpr_consent_given === true && !existingCustomer.gdpr_consent_given) {
      customerUpdates.gdpr_consent_date = new Date().toISOString()
    }

    if (Object.keys(customerUpdates).length > 0) {
      const { error: customerError } = await supabase
        .from('customers')
        .update(customerUpdates)
        .eq('id', customerId)

      if (customerError) {
        logger.error('Failed to update customer', { error: customerError })
        throw new Error('Failed to update customer')
      }
    }

    // Fetch updated customer
    const { data: updatedCustomer } = await supabase
      .from('customers')
      .select(`
        *,
        profiles!inner (
          id,
          email,
          full_name,
          phone,
          role,
          created_at,
          updated_at
        )
      `)
      .eq('id', customerId)
      .single()

    logger.info('Customer updated successfully', { customerId })

    return createSuccessResponse(updatedCustomer)
  } catch (error) {
    logger.error('Customer update failed', { error })
    throw error
  }
}

async function handleSoftDeleteCustomer(
  customerId: string,
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const body = JSON.parse(event.body || '{}')
  const { reason } = validateBody(schemas.customer.softDelete, body)

  const { data: result, error } = await supabase.rpc('soft_delete_customer', {
    customer_uuid: customerId,
    deleting_user_id: adminUserId,
    reason: reason || 'Admin deletion'
  })

  if (error) {
    logger.error('Failed to soft delete customer', { error })
    throw error
  }

  if (!result.success) {
    return createErrorResponse({
      statusCode: 400,
      message: result.error || 'Failed to delete customer',
      code: 'DELETION_FAILED'
    })
  }

  logger.info('Customer soft deleted successfully', { customerId })

  return createSuccessResponse({ message: result.message })
}

async function handleRestoreCustomer(
  customerId: string,
  supabase: SupabaseClient,
  logger: Logger,
  adminUserId: string
) {
  const { data: result, error } = await supabase.rpc('restore_customer', {
    customer_uuid: customerId,
    restoring_user_id: adminUserId
  })

  if (error) {
    logger.error('Failed to restore customer', { error })
    throw error
  }

  if (!result.success) {
    return createErrorResponse({
      statusCode: 400,
      message: result.error || 'Failed to restore customer',
      code: 'RESTORATION_FAILED'
    })
  }

  logger.info('Customer restored successfully', { customerId })

  return createSuccessResponse({ message: result.message })
}

async function handleGetCustomerAuditLog(
  customerId: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  const { data: auditLog, error } = await supabase
    .from('customer_audit_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to fetch customer audit log', { error })
    throw error
  }

  logger.info('Customer audit log fetched successfully', { customerId, count: auditLog?.length })

  return createSuccessResponse({ auditLog })
}

async function handleExportCustomerData(
  customerId: string,
  supabase: SupabaseClient,
  logger: Logger
) {
  const { data: exportData, error } = await supabase.rpc('export_customer_data', {
    customer_uuid: customerId
  })

  if (error) {
    logger.error('Failed to export customer data', { error })
    throw error
  }

  logger.info('Customer data exported successfully', { customerId })

  return createSuccessResponse(exportData)
}

// Helper functions

async function generateCustomerNumber(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear()
  const { data, error } = await supabase
    .from('customers')
    .select('customer_number')
    .ilike('customer_number', `C${year}%`)
    .order('customer_number', { ascending: false })
    .limit(1)

  if (error) {
    // If query fails, generate random number
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `C${year}${randomNum}`
  }

  if (data && data.length > 0) {
    const lastNumber = data[0].customer_number
    const match = lastNumber.match(/C\d{4}(\d+)/)
    if (match) {
      const nextNum = (parseInt(match[1]) + 1).toString().padStart(4, '0')
      return `C${year}${nextNum}`
    }
  }

  return `C${year}0001`
}

async function getCustomerStats(customerIds: string[], supabase: SupabaseClient) {
  const { data: stats, error } = await supabase
    .from('appointments')
    .select(`
      customer_id,
      status,
      price,
      starts_at
    `)
    .in('customer_id', customerIds)

  if (error || !stats) {
    return []
  }

  const now = new Date()
  const statsMap = new Map()

  stats.forEach(appointment => {
    const customerId = appointment.customer_id
    const existing = statsMap.get(customerId) || {
      customer_id: customerId,
      total_appointments: 0,
      upcoming_appointments: 0,
      completed_appointments: 0,
      cancelled_appointments: 0,
      total_spent: 0,
      last_appointment_date: null
    }

    existing.total_appointments++
    
    if (appointment.status === 'completed') {
      existing.completed_appointments++
      existing.total_spent += appointment.price || 0
    } else if (appointment.status === 'cancelled') {
      existing.cancelled_appointments++
    } else if (new Date(appointment.starts_at) > now) {
      existing.upcoming_appointments++
    }

    const appointmentDate = new Date(appointment.starts_at)
    if (!existing.last_appointment_date || appointmentDate > new Date(existing.last_appointment_date)) {
      existing.last_appointment_date = appointment.starts_at
    }

    statsMap.set(customerId, existing)
  })

  return Array.from(statsMap.values())
}