/**
 * Admin Appointments Conflict Checking API
 * Real-time conflict detection for appointment scheduling
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient } from '../../../src/lib/auth/netlify-auth'
import { validateBody, schemas } from '../../../src/lib/validation/schemas'
import { z } from 'zod'

const conflictCheckSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  staffId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  bufferMinutes: z.number().int().min(0).max(60).optional().default(10)
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
)

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin appointments conflict check request', {
      method: event.httpMethod,
      userId: context.user.id
    })

    if (event.httpMethod !== 'POST') {
      return createErrorResponse({
        statusCode: 405,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      })
    }

    try {
      const body = JSON.parse(event.body || '{}')
      const conflictData = validateBody(conflictCheckSchema, body)

      // Check for appointment conflicts using enhanced database function
      const { data: conflicts, error: conflictError } = await supabase
        .rpc('check_appointment_conflicts_enhanced', {
          p_staff_id: conflictData.staffId,
          p_start_time: conflictData.startTime,
          p_end_time: conflictData.endTime,
          p_buffer_minutes: conflictData.bufferMinutes,
          p_exclude_appointment_id: conflictData.appointmentId || null
        })

      if (conflictError) {
        logger.error('Failed to check appointment conflicts', { error: conflictError })
        throw conflictError
      }

      // Also check staff availability
      const { data: availability, error: availabilityError } = await supabase
        .rpc('check_staff_availability', {
          p_staff_id: conflictData.staffId,
          p_start_time: conflictData.startTime,
          p_end_time: conflictData.endTime
        })

      if (availabilityError) {
        logger.error('Failed to check staff availability', { error: availabilityError })
        throw availabilityError
      }

      const response = {
        hasConflicts: conflicts?.length > 0 || !availability,
        conflicts: conflicts || [],
        availability: availability || false,
        suggestions: await getSuggestions(supabase, conflictData, logger)
      }

      logger.info('Conflict check completed', { 
        hasConflicts: response.hasConflicts,
        conflictCount: conflicts?.length || 0
      })

      return createSuccessResponse(response)
    } catch (error) {
      logger.error('Conflict check operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireStaff: true },
  { maxRequests: 200, windowMs: 60 * 1000 } // Higher rate limit for real-time checks
)

async function getSuggestions(supabase: any, conflictData: any, logger: any) {
  try {
    // Get next available slots for the same staff member
    const requestedDate = new Date(conflictData.startTime).toISOString().split('T')[0]
    const duration = Math.ceil((new Date(conflictData.endTime).getTime() - new Date(conflictData.startTime).getTime()) / (1000 * 60))

    const { data: suggestions, error } = await supabase
      .rpc('get_next_available_slots', {
        p_staff_id: conflictData.staffId,
        p_date: requestedDate,
        p_duration_minutes: duration,
        p_buffer_minutes: conflictData.bufferMinutes,
        p_max_suggestions: 5
      })

    if (error) {
      logger.warn('Failed to get suggestions', { error })
      return []
    }

    return suggestions || []
  } catch (error) {
    logger.warn('Error generating suggestions', { error })
    return []
  }
}