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
const ServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().min(1).max(100),
  duration_minutes: z.number().int().min(1).max(480), // max 8 hours
  price_cents: z.number().min(0),  // ✅ FIXED: Changed from base_price
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0)
})

const ServiceUpdateSchema = ServiceSchema.partial()

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

async function handleGetServices(event: NetlifyEvent) {
  try {
    const { user, profile } = await verifyAuth(event)
    if ('error' in profile) {
      return {
        statusCode: profile.statusCode,
        headers,
        body: JSON.stringify({ error: profile.error })
      }
    }

    const includeInactive = event.queryStringParameters?.include_inactive === 'true'
    
    let query = supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // Only admins can see inactive services
    if (!includeInactive || profile.role !== 'admin') {
      query = query.eq('is_active', true)
    }

    const { data: services, error } = await query

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch services' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ services })
    }
  } catch (error) {
    console.error('Error in handleGetServices:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function handleCreateService(event: NetlifyEvent) {
  try {
    const { user, profile } = await verifyAuth(event)
    if ('error' in profile) {
      return {
        statusCode: profile.statusCode,
        headers,
        body: JSON.stringify({ error: profile.error })
      }
    }

    // Only admins can create services
    if (profile.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      }
    }

    let serviceData
    try {
      serviceData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      }
    }

    // Validate service data
    const validation = ServiceSchema.safeParse(serviceData)
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

    const { data: service, error } = await supabase
      .from('services')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      console.error('Error creating service:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create service' })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ service })
    }
  } catch (error) {
    console.error('Error in handleCreateService:', error)
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
        return await handleGetServices(event)
      
      case 'POST':
        return await handleCreateService(event)
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Unexpected error in services handler:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}