import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CancelBookingSchema = z.object({
  appointment_id: z.string().uuid(),
  reason: z.string().optional()
})

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Get user profile to check role
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

async function handleCancelBooking(event: NetlifyEvent) {
  try {
    const { user, profile } = await verifyAuth(event)
    if ('error' in profile) {
      return {
        statusCode: profile.statusCode,
        headers,
        body: JSON.stringify({ error: profile.error })
      }
    }

    let cancelData
    try {
      cancelData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      }
    }

    // Validate the cancellation data
    const validation = CancelBookingSchema.safeParse(cancelData)
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

    const { appointment_id, reason } = validation.data

    // Get the appointment to check permissions
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profile_id
        ),
        staff (
          id,
          profile_id
        )
      `)
      .eq('id', appointment_id)
      .single()

    if (appointmentError) {
      console.error('Error fetching appointment:', appointmentError)
      if (appointmentError.code === 'PGRST116') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Appointment not found' })
        }
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch appointment' })
      }
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Appointment is already cancelled' })
      }
    }

    if (appointment.status === 'completed') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Cannot cancel completed appointment' })
      }
    }

    // Check permissions
    let canCancel = false
    if (profile.role === 'admin') {
      canCancel = true
    } else if (profile.role === 'customer') {
      // Customer can only cancel their own appointments and only if pending
      canCancel = appointment.customers.profile_id === user.id && appointment.status === 'pending'
    } else if (profile.role === 'staff') {
      // Staff can cancel their own appointments
      canCancel = appointment.staff.profile_id === user.id
    }

    if (!canCancel) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Insufficient permissions to cancel this appointment' })
      }
    }

    // Check if appointment is in the past
    const appointmentStart = new Date(appointment.starts_at)
    const now = new Date()
    if (appointmentStart < now) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Cannot cancel appointments that have already started' })
      }
    }

    // Update the appointment to cancelled
    const updateData: any = {
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }

    // Add cancellation reason to internal notes
    if (reason) {
      const cancellationNote = `Cancelled by ${profile.role} (${user.email}) on ${new Date().toISOString()}: ${reason}`
      updateData.internal_notes = appointment.internal_notes 
        ? `${appointment.internal_notes}\n\n${cancellationNote}`
        : cancellationNote
    }

    const { data: updatedAppointment, error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointment_id)
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
      console.error('Error cancelling appointment:', updateError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to cancel appointment' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        appointment: updatedAppointment,
        message: 'Appointment cancelled successfully'
      })
    }

  } catch (error) {
    console.error('Error in handleCancelBooking:', error)
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  return await handleCancelBooking(event)
}