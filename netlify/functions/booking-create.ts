import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { z } from 'zod'
import { validateBooking } from '../src/lib/booking-logic'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Updated booking request schema to match new database structure
const BookingSchema = z.object({
  customer_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  price: z.number().min(0),
  notes: z.string().optional()
})

interface BookingRequest {
  customer_id: string
  staff_id: string
  service_id: string
  starts_at: string
  ends_at: string
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

    // Validate the booking data
    const validation = BookingSchema.safeParse(bookingData)
    if (!validation.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Validation failed',
          details: validation.error.errors
        }),
      }
    }

    const validatedData = validation.data

    // Check if the user has permission to create this booking
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      }
    }

    // If user is a customer, they can only book for themselves
    if (profile.role === 'customer') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (customerError || !customer) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Customer profile not found' }),
        }
      }

      if (validatedData.customer_id !== customer.id) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Cannot book for other customers' }),
        }
      }
    }

    // Validate the appointment using business settings
    const appointmentStart = new Date(validatedData.starts_at)
    const appointmentEnd = new Date(validatedData.ends_at)
    
    const businessValidation = await validateBooking(
      appointmentStart,
      appointmentEnd,
      validatedData.staff_id
    )

    if (!businessValidation.valid) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          error: 'Booking violates business rules',
          details: businessValidation.errors
        }),
      }
    }

    // Additional database-level validation using our database function
    const { data: validationResult, error: validationError } = await supabase
      .rpc('rpc_validate_appointment_slot', {
        p_staff_id: validatedData.staff_id,
        p_service_id: validatedData.service_id,
        p_starts_at: validatedData.starts_at,
        p_ends_at: validatedData.ends_at,
        p_buffer_minutes: 10, // This will be overridden by our settings-based validation
        p_exclude_appointment_id: null
      })

    if (validationError) {
      console.error('Error validating appointment slot:', validationError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to validate appointment slot' }),
      }
    }

    if (!validationResult.is_valid) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          error: 'Appointment slot is not available',
          details: validationResult.errors
        }),
      }
    }

    // Create the appointment
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        ...validatedData,
        status: 'pending'
      })
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