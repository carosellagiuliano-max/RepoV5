/**
 * Timezone utilities for handling Europe/Zurich timezone with DST
 * This handles the specific requirements for Swiss timezone handling
 */

export interface TimezoneInfo {
  timezone: string
  isDST: boolean
  offset: number // in minutes
  displayName: string
}

export interface QuietHoursConfig {
  enabled: boolean
  start: string // HH:MM format
  end: string   // HH:MM format
  timezone: string
}

export interface SchedulingWindow {
  start: Date
  end: Date
  timezone: string
}

/**
 * Get timezone information for a specific date
 */
export function getTimezoneInfo(date: Date, timezone: string = 'Europe/Zurich'): TimezoneInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'long'
    })
    
    const parts = formatter.formatToParts(date)
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || timezone
    
    // Calculate offset by comparing with UTC
    const utcDate = new Date(date.toISOString())
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    const offset = (utcDate.getTime() - localDate.getTime()) / (1000 * 60)
    
    // Determine if DST is active (rough approximation for Europe/Zurich)
    const isDST = isDaylightSavingTime(date, timezone)
    
    return {
      timezone,
      isDST,
      offset,
      displayName: timeZoneName
    }
  } catch (error) {
    console.error('Error getting timezone info:', error)
    // Fallback to basic info
    return {
      timezone,
      isDST: false,
      offset: 60, // CET default
      displayName: timezone
    }
  }
}

/**
 * Check if a date is in daylight saving time for a given timezone
 */
export function isDaylightSavingTime(date: Date, timezone: string = 'Europe/Zurich'): boolean {
  try {
    // Create two dates: one in January (definitely not DST) and one in July (definitely DST)
    const january = new Date(date.getFullYear(), 0, 1)
    const july = new Date(date.getFullYear(), 6, 1)
    
    // Get the timezone offset for both dates
    const januaryOffset = getTimezoneOffset(january, timezone)
    const julyOffset = getTimezoneOffset(july, timezone)
    const currentOffset = getTimezoneOffset(date, timezone)
    
    // If current offset matches July offset, we're likely in DST
    return currentOffset === julyOffset && julyOffset !== januaryOffset
  } catch (error) {
    console.error('Error checking DST:', error)
    return false
  }
}

/**
 * Get timezone offset in minutes for a specific date and timezone
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  try {
    const utcDate = new Date(date.toISOString())
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    return (utcDate.getTime() - localDate.getTime()) / (1000 * 60)
  } catch (error) {
    console.error('Error getting timezone offset:', error)
    return 0
  }
}

/**
 * Convert a time to a specific timezone
 */
export function convertToTimezone(date: Date, timezone: string = 'Europe/Zurich'): Date {
  try {
    // Get the date string in the target timezone
    const localString = date.toLocaleString('en-US', { timeZone: timezone })
    return new Date(localString)
  } catch (error) {
    console.error('Error converting to timezone:', error)
    return date
  }
}

/**
 * Check if a time falls within quiet hours
 */
export function isInQuietHours(
  date: Date, 
  config: QuietHoursConfig
): { 
  inQuietHours: boolean
  nextAllowedTime?: Date
  reason?: string 
} {
  if (!config.enabled) {
    return { inQuietHours: false }
  }

  try {
    // Convert date to target timezone
    const localDate = convertToTimezone(date, config.timezone)
    const hours = localDate.getHours()
    const minutes = localDate.getMinutes()
    const currentTimeMinutes = hours * 60 + minutes

    // Parse quiet hours
    const [startHour, startMin] = config.start.split(':').map(Number)
    const [endHour, endMin] = config.end.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    let inQuietHours = false
    let nextAllowedTime: Date

    if (startMinutes < endMinutes) {
      // Same day quiet hours (e.g., 13:00 - 17:00)
      inQuietHours = currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes
      
      if (inQuietHours) {
        nextAllowedTime = new Date(localDate)
        nextAllowedTime.setHours(endHour, endMin, 0, 0)
      }
    } else {
      // Overnight quiet hours (e.g., 21:00 - 08:00)
      inQuietHours = currentTimeMinutes >= startMinutes || currentTimeMinutes < endMinutes
      
      if (inQuietHours) {
        nextAllowedTime = new Date(localDate)
        if (currentTimeMinutes >= startMinutes) {
          // Currently after start time, wait until next day's end time
          nextAllowedTime.setDate(nextAllowedTime.getDate() + 1)
          nextAllowedTime.setHours(endHour, endMin, 0, 0)
        } else {
          // Currently before end time, wait until today's end time
          nextAllowedTime.setHours(endHour, endMin, 0, 0)
        }
      }
    }

    // Convert back to original timezone
    if (nextAllowedTime) {
      // This is a bit complex - we need to convert the local time back to UTC
      const utcString = nextAllowedTime.toLocaleString('en-CA', { timeZone: 'UTC' })
      const localString = nextAllowedTime.toLocaleString('en-CA', { timeZone: config.timezone })
      const offset = new Date(utcString).getTime() - new Date(localString).getTime()
      nextAllowedTime = new Date(nextAllowedTime.getTime() + offset)
    }

    return {
      inQuietHours,
      nextAllowedTime,
      reason: inQuietHours ? `Quiet hours: ${config.start} - ${config.end} (${config.timezone})` : undefined
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error)
    return { inQuietHours: false }
  }
}

/**
 * Schedule cron jobs with timezone awareness
 * Converts UTC cron times to account for DST changes
 */
export function calculateCronTimeForTimezone(
  localTime: string, // HH:MM format
  timezone: string = 'Europe/Zurich',
  referenceDate?: Date
): {
  utcTime: string
  cronExpression: string
  isDST: boolean
  nextRun: Date
} {
  const ref = referenceDate || new Date()
  
  try {
    // Parse local time
    const [hours, minutes] = localTime.split(':').map(Number)
    
    // Create a date object in the target timezone
    const localDate = new Date(ref)
    localDate.setHours(hours, minutes, 0, 0)
    
    // Convert to UTC
    const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }))
    const timezoneInfo = getTimezoneInfo(localDate, timezone)
    
    // Adjust for timezone offset
    const offsetMs = timezoneInfo.offset * 60 * 1000
    const utcAdjusted = new Date(localDate.getTime() + offsetMs)
    
    const utcHours = utcAdjusted.getUTCHours()
    const utcMinutes = utcAdjusted.getUTCMinutes()
    
    // Create cron expression (minute hour * * *)
    const cronExpression = `${utcMinutes} ${utcHours} * * *`
    
    // Calculate next run time
    const nextRun = new Date()
    nextRun.setUTCHours(utcHours, utcMinutes, 0, 0)
    if (nextRun <= new Date()) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    
    return {
      utcTime: `${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`,
      cronExpression,
      isDST: timezoneInfo.isDST,
      nextRun
    }
  } catch (error) {
    console.error('Error calculating cron time:', error)
    // Fallback to provided time as UTC
    const [hours, minutes] = localTime.split(':').map(Number)
    return {
      utcTime: localTime,
      cronExpression: `${minutes} ${hours} * * *`,
      isDST: false,
      nextRun: new Date()
    }
  }
}

/**
 * Get DST transition dates for a given year
 */
export function getDSTTransitions(year: number, timezone: string = 'Europe/Zurich'): {
  springForward?: Date
  fallBack?: Date
} {
  try {
    const transitions: { springForward?: Date; fallBack?: Date } = {}
    
    // For Europe/Zurich, DST typically starts last Sunday in March, ends last Sunday in October
    // This is a simplified calculation - for production, use a timezone library
    
    // Find last Sunday in March
    const march = new Date(year, 2, 31) // March 31
    while (march.getDay() !== 0) { // Sunday = 0
      march.setDate(march.getDate() - 1)
    }
    march.setHours(2, 0, 0, 0) // 2:00 AM
    transitions.springForward = march
    
    // Find last Sunday in October
    const october = new Date(year, 9, 31) // October 31
    while (october.getDay() !== 0) { // Sunday = 0
      october.setDate(october.getDate() - 1)
    }
    october.setHours(3, 0, 0, 0) // 3:00 AM
    transitions.fallBack = october
    
    return transitions
  } catch (error) {
    console.error('Error getting DST transitions:', error)
    return {}
  }
}

/**
 * Validate that a cron job will handle DST transitions correctly
 */
export function validateDSTCronJob(
  cronExpression: string,
  timezone: string = 'Europe/Zurich',
  year?: number
): {
  isValid: boolean
  warnings: string[]
  suggestions: string[]
} {
  const warnings: string[] = []
  const suggestions: string[] = []
  const currentYear = year || new Date().getFullYear()
  
  try {
    // Parse cron expression (assume format: minute hour * * *)
    const parts = cronExpression.split(' ')
    if (parts.length < 5) {
      return {
        isValid: false,
        warnings: ['Invalid cron expression format'],
        suggestions: ['Use format: minute hour * * *']
      }
    }
    
    const minute = parseInt(parts[0])
    const hour = parseInt(parts[1])
    
    if (isNaN(minute) || isNaN(hour)) {
      return {
        isValid: false,
        warnings: ['Invalid minute or hour in cron expression'],
        suggestions: ['Ensure minute and hour are valid numbers']
      }
    }
    
    // Check DST transition dates
    const transitions = getDSTTransitions(currentYear, timezone)
    
    if (transitions.springForward) {
      const springHour = transitions.springForward.getHours()
      if (hour >= 2 && hour <= 3) {
        warnings.push(`Cron job scheduled during spring DST transition (${hour}:${minute.toString().padStart(2, '0')})`)
        suggestions.push('Consider scheduling before 2:00 AM or after 4:00 AM to avoid DST issues')
      }
    }
    
    if (transitions.fallBack) {
      const fallHour = transitions.fallBack.getHours()
      if (hour >= 2 && hour <= 3) {
        warnings.push(`Cron job may run twice during fall DST transition (${hour}:${minute.toString().padStart(2, '0')})`)
        suggestions.push('Consider adding logic to handle duplicate runs during fall DST transition')
      }
    }
    
    // General recommendations
    if (hour >= 0 && hour <= 5) {
      suggestions.push('Early morning hours (0-5 AM) are generally safest for cron jobs')
    }
    
    return {
      isValid: true,
      warnings,
      suggestions
    }
  } catch (error) {
    return {
      isValid: false,
      warnings: [`Error validating cron job: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ['Check cron expression syntax']
    }
  }
}

/**
 * Create a timezone-aware date from local time string
 */
export function createTimezoneAwareDate(
  dateString: string,
  timeString: string,
  timezone: string = 'Europe/Zurich'
): Date {
  try {
    const localDateTimeString = `${dateString}T${timeString}:00`
    const localDate = new Date(localDateTimeString)
    
    // Get the timezone offset for this specific date
    const timezoneInfo = getTimezoneInfo(localDate, timezone)
    
    // Adjust for the timezone offset
    const offsetMs = timezoneInfo.offset * 60 * 1000
    return new Date(localDate.getTime() + offsetMs)
  } catch (error) {
    console.error('Error creating timezone-aware date:', error)
    return new Date(`${dateString}T${timeString}:00`)
  }
}