import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface BookingRequest {
  user_id: string
  starts_at: string
  ends_at: string
  service_type: string
  service_name: string
  hairdresser_name: string
  price: number
  notes?: string
}

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string
}

export const handler = async (event: NetlifyEvent, context: Context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Get the Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      }
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      }
    }

    // Parse the request body
    let bookingData: BookingRequest
    try {
      bookingData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      }
    }

    // Validate required fields
    const requiredFields = ['starts_at', 'ends_at', 'service_type', 'service_name', 'hairdresser_name', 'price']
    for (const field of requiredFields) {
      if (!bookingData[field as keyof BookingRequest]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        }
      }
    }

    // Ensure user can only create bookings for themselves
    bookingData.user_id = user.id

    // Check for duplicate bookings (same user, same time slot)
    const { data: existingBookings, error: checkError } = await supabase
      .from('appointments')
      .select('id')
      .eq('user_id', user.id)
      .eq('starts_at', bookingData.starts_at)
      .eq('ends_at', bookingData.ends_at)
      .eq('status', 'confirmed')

    if (checkError) {
      console.error('Error checking existing bookings:', checkError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to check existing bookings' }),
      }
    }

    if (existingBookings && existingBookings.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Booking already exists for this time slot' }),
      }
    }

    // Create the appointment
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        ...bookingData,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating appointment:', error)
      
      // Handle specific database errors
      if (error.code === '23505') {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Appointment time slot already taken' }),
        }
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create appointment' }),
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        appointment: data,
      }),
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}