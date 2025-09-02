import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  return { user }
}

async function handleGetAvailability(event: NetlifyEvent) {
  try {
    const authResult = await verifyAuth(event)
    if ('error' in authResult) {
      return {
        statusCode: authResult.statusCode,
        headers,
        body: JSON.stringify({ error: authResult.error })
      }
    }

    const { service_id, staff_id, date, buffer_minutes } = event.queryStringParameters || {}

    // Validate required parameters
    if (!service_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'service_id is required' })
      }
    }

    if (!date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'date is required (YYYY-MM-DD format)' })
      }
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' })
      }
    }

    const bufferMinutes = buffer_minutes ? parseInt(buffer_minutes) : 10

    if (staff_id) {
      // Get available slots for specific staff member
      const { data: slots, error } = await supabase
        .rpc('rpc_get_available_slots', {
          p_staff_id: staff_id,
          p_service_id: service_id,
          p_date: date,
          p_buffer_minutes: bufferMinutes
        })

      if (error) {
        console.error('Error fetching available slots:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch available slots' })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          type: 'slots',
          staff_id,
          service_id,
          date,
          slots: slots || []
        })
      }
    } else {
      // Get available staff for the service on this date
      // We'll check availability for the entire day and return staff who have any availability
      const startOfDay = `${date}T00:00:00Z`
      const endOfDay = `${date}T23:59:59Z`

      const { data: availableStaff, error } = await supabase
        .rpc('rpc_get_available_staff', {
          p_service_id: service_id,
          p_starts_at: startOfDay,
          p_ends_at: endOfDay,
          p_buffer_minutes: bufferMinutes
        })

      if (error) {
        console.error('Error fetching available staff:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch available staff' })
        }
      }

      // For each available staff member, get their availability windows for the day
      const staffWithAvailability = await Promise.all(
        (availableStaff || []).map(async (staff) => {
          const { data: slots, error: slotsError } = await supabase
            .rpc('rpc_get_available_slots', {
              p_staff_id: staff.staff_id,
              p_service_id: service_id,
              p_date: date,
              p_buffer_minutes: bufferMinutes
            })

          return {
            ...staff,
            available_slots: slotsError ? [] : slots
          }
        })
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          type: 'staff_availability',
          service_id,
          date,
          staff: staffWithAvailability
        })
      }
    }

  } catch (error) {
    console.error('Error in handleGetAvailability:', error)
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  return await handleGetAvailability(event)
}