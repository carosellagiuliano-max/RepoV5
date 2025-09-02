/**
 * Booking Logic with Business Settings Integration
 * Handles booking validation and availability checking with configurable business rules
 */

import { createAdminClient } from './auth/netlify-auth'

export interface BusinessHours {
  [key: string]: {
    open: string
    close: string
    closed: boolean
  }
}

export interface BookingLimits {
  booking_window_days: number
  buffer_time_minutes: number
  min_advance_booking_hours: number
  max_appointments_per_day: number
  cancellation_hours: number
}

/**
 * Fetches business settings from the database
 */
export async function getBusinessSettings(): Promise<{
  businessHours: BusinessHours
  bookingLimits: BookingLimits
}> {
  const supabase = createAdminClient()
  
  const { data: settings, error } = await supabase
    .from('business_settings')
    .select('key, value')
    .in('key', [
      'business_hours',
      'booking_window_days',
      'buffer_time_minutes',
      'min_advance_booking_hours',
      'max_appointments_per_day',
      'cancellation_hours'
    ])

  if (error) {
    throw new Error(`Failed to fetch business settings: ${error.message}`)
  }

  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, unknown>)

  return {
    businessHours: settingsMap.business_hours || {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '16:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: true }
    },
    bookingLimits: {
      booking_window_days: Number(settingsMap.booking_window_days) || 30,
      buffer_time_minutes: Number(settingsMap.buffer_time_minutes) || 15,
      min_advance_booking_hours: Number(settingsMap.min_advance_booking_hours) || 24,
      max_appointments_per_day: Number(settingsMap.max_appointments_per_day) || 50,
      cancellation_hours: Number(settingsMap.cancellation_hours) || 24
    }
  }
}

/**
 * Validates if a booking time is within business hours
 */
export function isWithinBusinessHours(
  appointmentDateTime: Date,
  businessHours: BusinessHours
): { valid: boolean; reason?: string } {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[appointmentDateTime.getDay()]
  const dayHours = businessHours[dayName]

  if (!dayHours || dayHours.closed) {
    return { valid: false, reason: `Business is closed on ${dayName}s` }
  }

  const appointmentTime = appointmentDateTime.toTimeString().slice(0, 5) // HH:MM format
  
  if (appointmentTime < dayHours.open || appointmentTime >= dayHours.close) {
    return { 
      valid: false, 
      reason: `Appointment time ${appointmentTime} is outside business hours (${dayHours.open}-${dayHours.close})` 
    }
  }

  return { valid: true }
}

/**
 * Validates booking window (how far in advance bookings are allowed)
 */
export function isWithinBookingWindow(
  appointmentDateTime: Date,
  bookingLimits: BookingLimits
): { valid: boolean; reason?: string } {
  const now = new Date()
  const maxBookingDate = new Date(now.getTime() + (bookingLimits.booking_window_days * 24 * 60 * 60 * 1000))
  const minBookingDate = new Date(now.getTime() + (bookingLimits.min_advance_booking_hours * 60 * 60 * 1000))

  if (appointmentDateTime < minBookingDate) {
    return { 
      valid: false, 
      reason: `Appointments must be booked at least ${bookingLimits.min_advance_booking_hours} hours in advance` 
    }
  }

  if (appointmentDateTime > maxBookingDate) {
    return { 
      valid: false, 
      reason: `Appointments can only be booked up to ${bookingLimits.booking_window_days} days in advance` 
    }
  }

  return { valid: true }
}

/**
 * Validates cancellation is allowed based on policy
 */
export function isCancellationAllowed(
  appointmentDateTime: Date,
  bookingLimits: BookingLimits
): { valid: boolean; reason?: string } {
  const now = new Date()
  const cancellationDeadline = new Date(
    appointmentDateTime.getTime() - (bookingLimits.cancellation_hours * 60 * 60 * 1000)
  )

  if (now > cancellationDeadline) {
    return { 
      valid: false, 
      reason: `Cancellation must be made at least ${bookingLimits.cancellation_hours} hours before the appointment` 
    }
  }

  return { valid: true }
}

/**
 * Checks if daily appointment limit is reached
 */
export async function isDailyLimitReached(
  date: string,
  bookingLimits: BookingLimits
): Promise<{ valid: boolean; reason?: string; currentCount?: number }> {
  const supabase = createAdminClient()
  
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id')
    .gte('start_time', `${date}T00:00:00`)
    .lt('start_time', `${date}T23:59:59`)
    .neq('status', 'cancelled')

  if (error) {
    throw new Error(`Failed to check daily appointment count: ${error.message}`)
  }

  const currentCount = appointments.length

  if (currentCount >= bookingLimits.max_appointments_per_day) {
    return { 
      valid: false, 
      reason: `Daily appointment limit of ${bookingLimits.max_appointments_per_day} has been reached`,
      currentCount
    }
  }

  return { valid: true, currentCount }
}

/**
 * Validates that there's no conflict with buffer time
 */
export async function hasBufferTimeConflict(
  staffId: string,
  startTime: Date,
  endTime: Date,
  bufferMinutes: number,
  excludeAppointmentId?: string
): Promise<{ valid: boolean; reason?: string }> {
  const supabase = createAdminClient()
  
  // Check for conflicts with buffer time included
  const bufferStart = new Date(startTime.getTime() - (bufferMinutes * 60 * 1000))
  const bufferEnd = new Date(endTime.getTime() + (bufferMinutes * 60 * 1000))

  let query = supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('staff_id', staffId)
    .neq('status', 'cancelled')
    .or(`start_time.gte.${bufferStart.toISOString()},end_time.lte.${bufferEnd.toISOString()}`)
    .or(`start_time.lt.${bufferEnd.toISOString()},end_time.gt.${bufferStart.toISOString()}`)

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId)
  }

  const { data: conflictingAppointments, error } = await query

  if (error) {
    throw new Error(`Failed to check buffer time conflicts: ${error.message}`)
  }

  if (conflictingAppointments && conflictingAppointments.length > 0) {
    return { 
      valid: false, 
      reason: `Appointment conflicts with buffer time requirements (${bufferMinutes} minutes buffer)` 
    }
  }

  return { valid: true }
}

/**
 * Comprehensive booking validation using business settings
 */
export async function validateBooking(
  appointmentDateTime: Date,
  endDateTime: Date,
  staffId: string,
  excludeAppointmentId?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    const { businessHours, bookingLimits } = await getBusinessSettings()

    // Check business hours
    const hoursCheck = isWithinBusinessHours(appointmentDateTime, businessHours)
    if (!hoursCheck.valid) {
      errors.push(hoursCheck.reason!)
    }

    // Check booking window
    const windowCheck = isWithinBookingWindow(appointmentDateTime, bookingLimits)
    if (!windowCheck.valid) {
      errors.push(windowCheck.reason!)
    }

    // Check daily limit
    const dateStr = appointmentDateTime.toISOString().split('T')[0]
    const limitCheck = await isDailyLimitReached(dateStr, bookingLimits)
    if (!limitCheck.valid) {
      errors.push(limitCheck.reason!)
    }

    // Check buffer time conflicts
    const bufferCheck = await hasBufferTimeConflict(
      staffId,
      appointmentDateTime,
      endDateTime,
      bookingLimits.buffer_time_minutes,
      excludeAppointmentId
    )
    if (!bufferCheck.valid) {
      errors.push(bufferCheck.reason!)
    }

    return { valid: errors.length === 0, errors }

  } catch (error: unknown) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { valid: false, errors }
  }
}

/**
 * Gets the buffer time from settings for use in availability calculations
 */
export async function getBufferTime(): Promise<number> {
  const { bookingLimits } = await getBusinessSettings()
  return bookingLimits.buffer_time_minutes
}