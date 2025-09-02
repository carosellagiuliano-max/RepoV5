/**
 * Waitlist Management
 * Provides functionality for managing customer waitlists when appointments are not available
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { createAdminClient, createLogger, generateCorrelationId, withAuthAndRateLimit } from '../../../src/lib/auth/netlify-auth'
import { z } from 'zod'

// Validation schemas
const CreateWaitlistSchema = z.object({
  customer_id: z.string().uuid(),
  service_id: z.string().uuid(),
  staff_id: z.string().uuid().optional(),
  preferred_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
  preferred_days: z.array(z.number().min(0).max(6)).optional(),
  notes: z.string().optional(),
  priority: z.number().min(0).max(10).optional().default(0)
})

const UpdateWaitlistSchema = CreateWaitlistSchema.partial()

const QueryWaitlistSchema = z.object({
  customer_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  status: z.enum(['active', 'notified', 'booked', 'cancelled']).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

/**
 * Get waitlist entries based on filters
 */
async function getWaitlistEntries(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string,
  userRole: string
) {
  const query = event.queryStringParameters || {}
  const validation = QueryWaitlistSchema.safeParse(query)
  
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

  const { customer_id, service_id, staff_id, status, date_from, date_to } = validation.data

  try {
    let waitlistQuery = supabase
      .from('waitlist')
      .select(`
        *,
        customers (
          id,
          profiles (full_name, email, phone)
        ),
        services (
          id,
          name,
          description,
          duration_minutes,
          base_price
        ),
        staff (
          id,
          full_name,
          email
        )
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    // Apply filters
    if (customer_id) {
      waitlistQuery = waitlistQuery.eq('customer_id', customer_id)
    }

    if (service_id) {
      waitlistQuery = waitlistQuery.eq('service_id', service_id)
    }

    if (staff_id) {
      waitlistQuery = waitlistQuery.eq('staff_id', staff_id)
    }

    if (status) {
      waitlistQuery = waitlistQuery.eq('status', status)
    }

    if (date_from) {
      waitlistQuery = waitlistQuery.gte('preferred_start_date', date_from)
    }

    if (date_to) {
      waitlistQuery = waitlistQuery.lte('preferred_end_date', date_to)
    }

    // If user is a customer, only show their own waitlist entries
    if (userRole === 'customer') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', userId)
        .single()

      if (customerError || !customer) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Customer profile not found' })
        }
      }

      waitlistQuery = waitlistQuery.eq('customer_id', customer.id)
    }

    const { data: waitlistEntries, error } = await waitlistQuery

    if (error) {
      logger.error('Error fetching waitlist entries', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch waitlist entries' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ waitlist_entries: waitlistEntries || [] })
    }

  } catch (error) {
    logger.error('Unexpected error in getWaitlistEntries', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Create a new waitlist entry
 */
async function createWaitlistEntry(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string,
  userRole: string
) {
  let waitlistData
  try {
    waitlistData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = CreateWaitlistSchema.safeParse(waitlistData)
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

  // Validate date range
  if (validatedData.preferred_start_date > validatedData.preferred_end_date) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'preferred_end_date must be after preferred_start_date'
      })
    }
  }

  // If user is a customer, ensure they can only create waitlist entries for themselves
  if (userRole === 'customer') {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', userId)
      .single()

    if (customerError || !customer) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Customer profile not found' })
      }
    }

    if (validatedData.customer_id !== customer.id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Cannot create waitlist entries for other customers' })
      }
    }
  }

  try {
    // Check if customer already has an active waitlist entry for this service
    const { data: existingEntry, error: checkError } = await supabase
      .from('waitlist')
      .select('id')
      .eq('customer_id', validatedData.customer_id)
      .eq('service_id', validatedData.service_id)
      .eq('status', 'active')
      .maybeSingle()

    if (checkError) {
      logger.error('Error checking existing waitlist entry', { error: checkError })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to check existing waitlist entries' })
      }
    }

    if (existingEntry) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'Customer already has an active waitlist entry for this service'
        })
      }
    }

    const { data: waitlistEntry, error } = await supabase
      .from('waitlist')
      .insert(validatedData)
      .select(`
        *,
        customers (
          id,
          profiles (full_name, email, phone)
        ),
        services (
          id,
          name,
          description,
          duration_minutes,
          base_price
        ),
        staff (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      logger.error('Error creating waitlist entry', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create waitlist entry' })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ waitlist_entry: waitlistEntry })
    }

  } catch (error) {
    logger.error('Unexpected error in createWaitlistEntry', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Update waitlist entry status
 */
async function updateWaitlistEntry(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  waitlistId: string,
  userId: string,
  userRole: string
) {
  let updateData
  try {
    updateData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = UpdateWaitlistSchema.safeParse(updateData)
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
    // Check if waitlist entry exists and user has permission
    let waitlistQuery = supabase
      .from('waitlist')
      .select('customer_id, status')
      .eq('id', waitlistId)

    if (userRole === 'customer') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', userId)
        .single()

      if (customerError || !customer) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Customer profile not found' })
        }
      }

      waitlistQuery = waitlistQuery.eq('customer_id', customer.id)
    }

    const { data: existingEntry, error: fetchError } = await waitlistQuery.single()

    if (fetchError || !existingEntry) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Waitlist entry not found' })
      }
    }

    const { data: waitlistEntry, error } = await supabase
      .from('waitlist')
      .update(validatedData)
      .eq('id', waitlistId)
      .select(`
        *,
        customers (
          id,
          profiles (full_name, email, phone)
        ),
        services (
          id,
          name,
          description,
          duration_minutes,
          base_price
        ),
        staff (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      logger.error('Error updating waitlist entry', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update waitlist entry' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ waitlist_entry: waitlistEntry })
    }

  } catch (error) {
    logger.error('Unexpected error in updateWaitlistEntry', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Delete waitlist entry
 */
async function deleteWaitlistEntry(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  waitlistId: string,
  userId: string,
  userRole: string
) {
  try {
    // Check permissions
    if (userRole === 'customer') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', userId)
        .single()

      if (customerError || !customer) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Customer profile not found' })
        }
      }

      const { data: waitlistEntry, error: checkError } = await supabase
        .from('waitlist')
        .select('customer_id')
        .eq('id', waitlistId)
        .eq('customer_id', customer.id)
        .single()

      if (checkError || !waitlistEntry) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Waitlist entry not found' })
        }
      }
    }

    const { error } = await supabase
      .from('waitlist')
      .delete()
      .eq('id', waitlistId)

    if (error) {
      logger.error('Error deleting waitlist entry', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to delete waitlist entry' })
      }
    }

    return {
      statusCode: 204,
      headers,
      body: ''
    }

  } catch (error) {
    logger.error('Unexpected error in deleteWaitlistEntry', { error })
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

    logger.info('Waitlist management request', {
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
    const pathParts = event.path?.split('/') || []
    const waitlistId = pathParts[pathParts.length - 1]

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await getWaitlistEntries(event, supabase, logger, context.user.id, userRole)

        case 'POST':
          return await createWaitlistEntry(event, supabase, logger, context.user.id, userRole)

        case 'PUT':
          if (!waitlistId || waitlistId === 'waitlist') {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Waitlist ID is required for updates' })
            }
          }
          return await updateWaitlistEntry(event, supabase, logger, waitlistId, context.user.id, userRole)

        case 'DELETE':
          if (!waitlistId || waitlistId === 'waitlist') {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Waitlist ID is required for deletion' })
            }
          }
          return await deleteWaitlistEntry(event, supabase, logger, waitlistId, context.user.id, userRole)

        default:
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
          }
      }
    } catch (error) {
      logger.error('Unexpected error in waitlist handler', { error })
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
      maxRequests: 20   // 20 requests per minute
    }
  }
)