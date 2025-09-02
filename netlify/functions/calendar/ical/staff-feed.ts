/**
 * Staff iCal Feed Endpoint
 * Provides secure, read-only iCal feeds for staff appointments
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { generateICalFeed } from '../../../src/lib/calendar/ical-generator'
import { hashCalendarToken, verifyCalendarToken, isValidTokenFormat, isTokenExpired, checkRateLimit } from '../../../src/lib/calendar/token-utils'
import { StaffCalendarData } from '../../../src/lib/calendar/types'

export const handler: Handler = async (event: HandlerEvent) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'GET',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
    }
  }

  try {
    // Extract token from query parameters
    const token = event.queryStringParameters?.token
    
    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Calendar token is required',
          code: 'TOKEN_REQUIRED'
        })
      }
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        })
      }
    }

    // Rate limiting based on token
    const rateLimitKey = `ical-feed:${token.slice(0, 8)}`
    if (!checkRateLimit(rateLimitKey, 60, 60 * 1000)) { // 60 requests per minute
      return {
        statusCode: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        })
      }
    }

    // Hash token for database lookup
    const tokenHash = hashCalendarToken(token)
    
    // Initialize Supabase client
    const supabase = createAdminClient()
    
    // Find calendar token in database
    const { data: calendarToken, error: tokenError } = await supabase
      .from('calendar_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('feed_type', 'ical')
      .eq('is_active', true)
      .single()

    if (tokenError || !calendarToken) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid or expired calendar token',
          code: 'INVALID_TOKEN'
        })
      }
    }

    // Check if token has expired
    if (isTokenExpired(calendarToken.expires_at)) {
      return {
        statusCode: 410,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Calendar token has expired',
          code: 'TOKEN_EXPIRED'
        })
      }
    }

    // Update last accessed timestamp
    await supabase
      .from('calendar_tokens')
      .update({ 
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', calendarToken.id)

    // Fetch staff information
    const { data: staff, error: staffError } = await supabase
      .from('staff_with_profiles')
      .select(`
        id,
        profile_id,
        first_name,
        last_name,
        email
      `)
      .eq('id', calendarToken.staff_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staff) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Staff member not found',
          code: 'STAFF_NOT_FOUND'
        })
      }
    }

    // Fetch appointments for the staff member
    // Get appointments from 30 days ago to 365 days in the future
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments_with_details')
      .select(`
        id,
        start_time,
        end_time,
        status,
        notes,
        service_name,
        service_duration_minutes,
        customer_first_name,
        customer_last_name,
        customer_email
      `)
      .eq('staff_id', calendarToken.staff_id)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .in('status', ['pending', 'confirmed', 'completed']) // Exclude cancelled appointments
      .order('start_time', { ascending: true })

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Failed to fetch appointments',
          code: 'FETCH_ERROR'
        })
      }
    }

    // Transform data to match StaffCalendarData interface
    const calendarData: StaffCalendarData = {
      staff: {
        id: staff.id,
        profile_id: staff.profile_id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email
      },
      appointments: (appointments || []).map(apt => ({
        id: apt.id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        status: apt.status,
        notes: apt.notes,
        service: {
          name: apt.service_name,
          duration_minutes: apt.service_duration_minutes
        },
        customer: {
          first_name: apt.customer_first_name,
          last_name: apt.customer_last_name,
          email: apt.customer_email
        }
      }))
    }

    // Generate iCal feed
    const timezone = event.queryStringParameters?.timezone || 'Europe/Berlin'
    const icalFeed = generateICalFeed(calendarData, {
      timezone,
      title: `${staff.first_name} ${staff.last_name} - Appointments`,
      description: `Appointment schedule for ${staff.first_name} ${staff.last_name} at ${process.env.VITE_BUSINESS_NAME || 'Schnittwerk Your Style'}`
    })

    // Return iCal feed with appropriate headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="appointments-${staff.first_name}-${staff.last_name}.ics"`,
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'X-Robots-Tag': 'noindex, nofollow', // Prevent search engine indexing
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: icalFeed
    }

  } catch (error) {
    console.error('iCal feed generation error:', error)
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}