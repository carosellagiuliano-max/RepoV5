/**
 * Holiday and Blackout Date Management
 * Provides CRUD operations for managing holidays and blackout dates
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { createAdminClient, createLogger, generateCorrelationId, withAuthAndRateLimit } from '../../../src/lib/auth/netlify-auth'
import { z } from 'zod'

// Validation schemas
const CreateHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_recurring: z.boolean().optional().default(false),
  recurring_month: z.number().min(1).max(12).optional(),
  recurring_day: z.number().min(1).max(31).optional(),
  type: z.enum(['public_holiday', 'blackout_date', 'maintenance']).optional().default('public_holiday'),
  description: z.string().optional(),
  affects_all_staff: z.boolean().optional().default(true)
})

const UpdateHolidaySchema = CreateHolidaySchema.partial()

const QueryHolidaysSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['public_holiday', 'blackout_date', 'maintenance']).optional(),
  include_recurring: z.string().transform(val => val === 'true').optional().default(true)
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
 * Get holidays within date range
 */
async function getHolidays(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger
) {
  const query = event.queryStringParameters || {}
  const validation = QueryHolidaysSchema.safeParse(query)
  
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

  const { start_date, end_date, type, include_recurring } = validation.data

  try {
    let holidayQuery = supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true })

    if (start_date && end_date) {
      holidayQuery = holidayQuery
        .gte('date', start_date)
        .lte('date', end_date)
    } else if (start_date) {
      holidayQuery = holidayQuery.gte('date', start_date)
    } else if (end_date) {
      holidayQuery = holidayQuery.lte('date', end_date)
    }

    if (type) {
      holidayQuery = holidayQuery.eq('type', type)
    }

    const { data: holidays, error } = await holidayQuery

    if (error) {
      logger.error('Error fetching holidays', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch holidays' })
      }
    }

    // If we have date range and include_recurring is true, calculate recurring holidays
    let recurringHolidays: any[] = []
    if (include_recurring && start_date && end_date) {
      const { data: recurringData, error: recurringError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_recurring', true)

      if (!recurringError && recurringData) {
        const startYear = new Date(start_date).getFullYear()
        const endYear = new Date(end_date).getFullYear()

        for (const holiday of recurringData) {
          for (let year = startYear; year <= endYear; year++) {
            const recurringDate = new Date(year, holiday.recurring_month - 1, holiday.recurring_day)
            const dateString = recurringDate.toISOString().split('T')[0]
            
            if (dateString >= start_date && dateString <= end_date) {
              recurringHolidays.push({
                ...holiday,
                date: dateString,
                calculated_date: true
              })
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        holidays: holidays || [],
        recurring_holidays: recurringHolidays
      })
    }

  } catch (error) {
    logger.error('Unexpected error in getHolidays', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Create a new holiday
 */
async function createHoliday(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  userId: string
) {
  let holidayData
  try {
    holidayData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = CreateHolidaySchema.safeParse(holidayData)
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

  // Validate recurring holiday data
  if (validatedData.is_recurring) {
    if (!validatedData.recurring_month || !validatedData.recurring_day) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'recurring_month and recurring_day are required for recurring holidays'
        })
      }
    }
  }

  try {
    const { data: holiday, error } = await supabase
      .from('holidays')
      .insert({
        ...validatedData,
        created_by: userId
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating holiday', { error })
      
      if (error.code === '23505') {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Holiday already exists for this date' })
        }
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create holiday' })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ holiday })
    }

  } catch (error) {
    logger.error('Unexpected error in createHoliday', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Update an existing holiday
 */
async function updateHoliday(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  holidayId: string
) {
  let holidayData
  try {
    holidayData = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    }
  }

  const validation = UpdateHolidaySchema.safeParse(holidayData)
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
    const { data: holiday, error } = await supabase
      .from('holidays')
      .update(validatedData)
      .eq('id', holidayId)
      .select()
      .single()

    if (error) {
      logger.error('Error updating holiday', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update holiday' })
      }
    }

    if (!holiday) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Holiday not found' })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ holiday })
    }

  } catch (error) {
    logger.error('Unexpected error in updateHoliday', { error })
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

/**
 * Delete a holiday
 */
async function deleteHoliday(
  event: HandlerEvent,
  supabase: SupabaseClient,
  logger: Logger,
  holidayId: string
) {
  try {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', holidayId)

    if (error) {
      logger.error('Error deleting holiday', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to delete holiday' })
      }
    }

    return {
      statusCode: 204,
      headers,
      body: ''
    }

  } catch (error) {
    logger.error('Unexpected error in deleteHoliday', { error })
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

    logger.info('Holiday management request', {
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

    const pathParts = event.path?.split('/') || []
    const holidayId = pathParts[pathParts.length - 1]

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await getHolidays(event, supabase, logger)

        case 'POST':
          return await createHoliday(event, supabase, logger, context.user.id)

        case 'PUT':
          if (!holidayId || holidayId === 'holidays') {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Holiday ID is required for updates' })
            }
          }
          return await updateHoliday(event, supabase, logger, holidayId)

        case 'DELETE':
          if (!holidayId || holidayId === 'holidays') {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Holiday ID is required for deletion' })
            }
          }
          return await deleteHoliday(event, supabase, logger, holidayId)

        default:
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
          }
      }
    } catch (error) {
      logger.error('Unexpected error in holiday handler', { error })
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' })
      }
    }
  },
  {
    requiredRole: ['admin', 'staff'],
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 20   // 20 requests per minute
    }
  }
)