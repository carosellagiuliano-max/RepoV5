import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Validation schemas
const StaffSchema = z.object({
  staff_number: z.string().min(1).max(50),
  full_name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  specialties: z.array(z.string()).default([]),
  bio: z.string().optional(),
  hire_date: z.string().optional(), // ISO date string
  hourly_rate: z.number().min(0).optional(),
  avatar_url: z.string().url().optional()
})

const StaffUpdateSchema = StaffSchema.partial()

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string
  queryStringParameters?: Record<string, string>
  path: string
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

async function verifyAuth(event: NetlifyEvent) {
  const authHeader = event.headers.authorization || event.headers.Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', statusCode: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return { error: 'Invalid or expired token', statusCode: 401 }
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found', statusCode: 403 }
  }

  return { user, profile }
}

async function handleGetStaff(event: NetlifyEvent) {
  try {
    const { user, profile } = await verifyAuth(event)
    if ('error' in profile) {
      return {
        statusCode: profile.statusCode,
        headers,
        body: JSON.stringify({ error: profile.error })
      }
    }

    const serviceId = event.queryStringParameters?.service_id
    const includeInactive = event.queryStringParameters?.include_inactive === 'true'
    const includeServices = event.queryStringParameters?.include_services === 'true'
    
    let query = supabase.from('staff').select('*')

    // Only admins can see inactive staff or include inactive flag is explicitly false
    if (!includeInactive || profile.role !== 'admin') {
      query = query.eq('status', 'active')
    }

    // Filter by service if provided
    if (serviceId) {
      // Get staff who offer this service
      const { data: staffServices, error: staffServiceError } = await supabase
        .from('staff_services')
        .select('staff_id')
        .eq('service_id', serviceId)
        .eq('is_active', true)

      if (staffServiceError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch staff services' })
        }
      }

      const staffIds = staffServices.map(ss => ss.staff_id)
      if (staffIds.length === 0) {
        // No staff offers this service
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ staff: [] })
        }
      }

      query = query.in('id', staffIds)
    }

    query = query.order('full_name', { ascending: true })

    const { data: staff, error } = await query

    if (error) {
      console.error('Error fetching staff:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch staff' })
      }
    }

    // If include_services is requested, fetch services for each staff member
    let staffWithServices = staff
    if (includeServices && staff) {
      staffWithServices = await Promise.all(
        staff.map(async (member) => {
          const { data: services, error: servicesError } = await supabase
            .from('staff_services')
            .select(`
              service_id,
              custom_price,
              estimated_duration_minutes,
              services (
                id,
                name,
                category,
                base_price,
                duration_minutes,
                is_active
              )
            `)
            .eq('staff_id', member.id)
            .eq('is_active', true)

          return {
            ...member,
            services: servicesError ? [] : services.map(s => ({
              ...s.services,
              custom_price: s.custom_price,
              estimated_duration_minutes: s.estimated_duration_minutes
            }))
          }
        })
      )
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ staff: staffWithServices })
    }
  } catch (error) {
    console.error('Error in handleGetStaff:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function handleCreateStaff(event: NetlifyEvent) {
  try {
    const { user, profile } = await verifyAuth(event)
    if ('error' in profile) {
      return {
        statusCode: profile.statusCode,
        headers,
        body: JSON.stringify({ error: profile.error })
      }
    }

    // Only admins can create staff
    if (profile.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      }
    }

    let staffData
    try {
      staffData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      }
    }

    // Validate staff data
    const validation = StaffSchema.safeParse(staffData)
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

    // Check if staff_number is unique
    const { data: existingStaff, error: checkError } = await supabase
      .from('staff')
      .select('id')
      .eq('staff_number', validation.data.staff_number)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking staff number:', checkError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to validate staff number' })
      }
    }

    if (existingStaff) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Staff number already exists' })
      }
    }

    const { data: newStaff, error } = await supabase
      .from('staff')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      console.error('Error creating staff:', error)
      if (error.code === '23505') { // Unique constraint violation
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Staff number or email already exists' })
        }
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create staff member' })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ staff: newStaff })
    }
  } catch (error) {
    console.error('Error in handleCreateStaff:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

export const handler = async (event: NetlifyEvent, context: Context) => {
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
        return await handleGetStaff(event)
      
      case 'POST':
        return await handleCreateStaff(event)
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Unexpected error in staff handler:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}