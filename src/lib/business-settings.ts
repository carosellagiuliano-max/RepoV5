/**
 * Business Settings Utilities
 * Helper functions for integrating business settings into application logic
 */

import { supabase } from '@/lib/supabase'
import { OpeningHours, SettingKey } from '@/lib/types/settings'

// Cache for settings to avoid repeated database calls
const settingsCache = new Map<string, { value: unknown; expires: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get a business setting value with caching
 */
export async function getBusinessSetting<T = unknown>(key: SettingKey): Promise<T | null> {
  const cached = settingsCache.get(key)
  
  if (cached && cached.expires > Date.now()) {
    return cached.value as T
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error) {
      console.error(`Failed to fetch setting ${key}:`, error)
      return null
    }

    // Cache the result
    settingsCache.set(key, {
      value: data.value,
      expires: Date.now() + CACHE_DURATION
    })

    return data.value as T
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error)
    return null
  }
}

/**
 * Clear the settings cache (useful after updates)
 */
export function clearSettingsCache(): void {
  settingsCache.clear()
}

/**
 * Check if a given date/time is within business opening hours
 */
export async function isWithinOpeningHours(date: Date): Promise<boolean> {
  try {
    const openingHours = await getBusinessSetting<OpeningHours>('business.opening_hours')
    
    if (!openingHours) {
      console.warn('Opening hours not configured, allowing all times')
      return true
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[date.getDay()]
    const daySettings = openingHours[dayName]

    if (!daySettings?.enabled) {
      return false
    }

    const timeString = date.toTimeString().slice(0, 5) // HH:MM format
    return timeString >= daySettings.start && timeString <= daySettings.end
  } catch (error) {
    console.error('Error checking opening hours:', error)
    return true // Default to allowing if there's an error
  }
}

/**
 * Get the maximum booking date based on business settings
 */
export async function getMaxBookingDate(): Promise<Date> {
  try {
    const windowDays = await getBusinessSetting<number>('booking.window_days')
    const defaultWindowDays = 30 // fallback

    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + (windowDays || defaultWindowDays))
    
    return maxDate
  } catch (error) {
    console.error('Error getting max booking date:', error)
    const fallbackDate = new Date()
    fallbackDate.setDate(fallbackDate.getDate() + 30)
    return fallbackDate
  }
}

/**
 * Get buffer time in minutes
 */
export async function getBufferTimeMinutes(): Promise<number> {
  try {
    const bufferTime = await getBusinessSetting<number>('booking.buffer_time_minutes')
    return bufferTime || 15 // default 15 minutes
  } catch (error) {
    console.error('Error getting buffer time:', error)
    return 15
  }
}

/**
 * Check if cancellation is allowed based on business policy
 */
export async function isCancellationAllowed(appointmentDate: Date): Promise<boolean> {
  try {
    const cancellationHours = await getBusinessSetting<number>('booking.cancellation_hours')
    const defaultCancellationHours = 24

    const hoursBeforeAppointment = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60)
    
    return hoursBeforeAppointment >= (cancellationHours || defaultCancellationHours)
  } catch (error) {
    console.error('Error checking cancellation policy:', error)
    return false // Default to not allowing cancellation if there's an error
  }
}

/**
 * Get business contact information
 */
export async function getBusinessInfo() {
  try {
    const [name, address, phone, email] = await Promise.all([
      getBusinessSetting<string>('business.name'),
      getBusinessSetting<string>('business.address'),
      getBusinessSetting<string>('business.phone'),
      getBusinessSetting<string>('business.email')
    ])

    return {
      name: name || 'Schnittwerk Your Style',
      address: address || '',
      phone: phone || '',
      email: email || ''
    }
  } catch (error) {
    console.error('Error getting business info:', error)
    return {
      name: 'Schnittwerk Your Style',
      address: '',
      phone: '',
      email: ''
    }
  }
}

/**
 * Generate available time slots for a given date
 */
export async function getAvailableTimeSlots(date: Date): Promise<string[]> {
  try {
    const openingHours = await getBusinessSetting<OpeningHours>('business.opening_hours')
    const bufferMinutes = await getBufferTimeMinutes()

    if (!openingHours) {
      return []
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[date.getDay()]
    const daySettings = openingHours[dayName]

    if (!daySettings?.enabled) {
      return []
    }

    const slots: string[] = []
    const [startHour, startMinute] = daySettings.start.split(':').map(Number)
    const [endHour, endMinute] = daySettings.end.split(':').map(Number)

    let currentTime = startHour * 60 + startMinute // convert to minutes
    const endTime = endHour * 60 + endMinute

    while (currentTime + bufferMinutes <= endTime) {
      const hours = Math.floor(currentTime / 60)
      const minutes = currentTime % 60
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      
      slots.push(timeString)
      currentTime += bufferMinutes
    }

    return slots
  } catch (error) {
    console.error('Error generating time slots:', error)
    return []
  }
}

/**
 * Validate a booking request against business rules
 */
export async function validateBookingRequest(appointmentDate: Date): Promise<{
  isValid: boolean
  errors: string[]
}> {
  const errors: string[] = []

  try {
    // Check if date is not in the past
    if (appointmentDate < new Date()) {
      errors.push('Cannot book appointments in the past')
    }

    // Check if date is within booking window
    const maxDate = await getMaxBookingDate()
    if (appointmentDate > maxDate) {
      const windowDays = await getBusinessSetting<number>('booking.window_days') || 30
      errors.push(`Cannot book more than ${windowDays} days in advance`)
    }

    // Check if date/time is within opening hours
    const withinHours = await isWithinOpeningHours(appointmentDate)
    if (!withinHours) {
      errors.push('Appointment time is outside business hours')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  } catch (error) {
    console.error('Error validating booking request:', error)
    return {
      isValid: false,
      errors: ['Unable to validate booking request']
    }
  }
}