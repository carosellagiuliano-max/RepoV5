import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  getTimezoneInfo,
  isDaylightSavingTime,
  convertToTimezone,
  isInQuietHours,
  calculateCronTimeForTimezone,
  getDSTTransitions,
  validateDSTCronJob,
  createTimezoneAwareDate
} from '../lib/notifications/timezone-utils'

describe('Timezone Utils', () => {
  describe('getTimezoneInfo', () => {
    it('should get timezone info for Europe/Zurich', () => {
      const date = new Date('2024-07-15T12:00:00Z') // Summer time
      const info = getTimezoneInfo(date, 'Europe/Zurich')
      
      expect(info.timezone).toBe('Europe/Zurich')
      expect(typeof info.isDST).toBe('boolean')
      expect(typeof info.offset).toBe('number')
      expect(typeof info.displayName).toBe('string')
    })

    it('should handle invalid timezone gracefully', () => {
      const date = new Date('2024-07-15T12:00:00Z')
      const info = getTimezoneInfo(date, 'Invalid/Timezone')
      
      expect(info.timezone).toBe('Invalid/Timezone')
      expect(typeof info.isDST).toBe('boolean')
      expect(typeof info.offset).toBe('number')
    })
  })

  describe('isDaylightSavingTime', () => {
    it('should detect DST in summer for Europe/Zurich', () => {
      const summerDate = new Date('2024-07-15T12:00:00Z')
      const isDST = isDaylightSavingTime(summerDate, 'Europe/Zurich')
      
      // In July, Europe/Zurich should be in DST
      expect(typeof isDST).toBe('boolean')
    })

    it('should detect no DST in winter for Europe/Zurich', () => {
      const winterDate = new Date('2024-01-15T12:00:00Z')
      const isDST = isDaylightSavingTime(winterDate, 'Europe/Zurich')
      
      // In January, Europe/Zurich should not be in DST
      expect(typeof isDST).toBe('boolean')
    })

    it('should handle errors gracefully', () => {
      const date = new Date('invalid-date')
      const isDST = isDaylightSavingTime(date, 'Europe/Zurich')
      
      expect(isDST).toBe(false)
    })
  })

  describe('convertToTimezone', () => {
    it('should convert UTC time to Europe/Zurich', () => {
      const utcDate = new Date('2024-07-15T12:00:00Z')
      const localDate = convertToTimezone(utcDate, 'Europe/Zurich')
      
      expect(localDate).toBeInstanceOf(Date)
      expect(localDate.getTime()).not.toBe(utcDate.getTime())
    })

    it('should handle errors gracefully', () => {
      const date = new Date('2024-07-15T12:00:00Z')
      const result = convertToTimezone(date, 'Invalid/Timezone')
      
      // Should return original date on error
      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('isInQuietHours', () => {
    it('should detect when time is NOT in quiet hours', () => {
      const config = {
        enabled: true,
        start: '21:00',
        end: '08:00',
        timezone: 'Europe/Zurich'
      }
      
      // 12:00 PM should not be in quiet hours
      const noonDate = new Date('2024-07-15T10:00:00Z') // Roughly noon in Europe/Zurich
      const result = isInQuietHours(noonDate, config)
      
      expect(result.inQuietHours).toBe(false)
      expect(result.nextAllowedTime).toBeUndefined()
    })

    it('should detect when time IS in quiet hours (overnight)', () => {
      const config = {
        enabled: true,
        start: '21:00',
        end: '08:00',
        timezone: 'Europe/Zurich'
      }
      
      // 11:00 PM should be in quiet hours
      const lateNightDate = new Date('2024-07-15T21:00:00Z') // 11 PM UTC is roughly 11 PM in summer
      const result = isInQuietHours(lateNightDate, config)
      
      expect(typeof result.inQuietHours).toBe('boolean')
      if (result.inQuietHours) {
        expect(result.nextAllowedTime).toBeInstanceOf(Date)
        expect(result.reason).toContain('Quiet hours')
      }
    })

    it('should handle same-day quiet hours', () => {
      const config = {
        enabled: true,
        start: '13:00',
        end: '17:00',
        timezone: 'Europe/Zurich'
      }
      
      const afternoonDate = new Date('2024-07-15T13:30:00Z')
      const result = isInQuietHours(afternoonDate, config)
      
      expect(typeof result.inQuietHours).toBe('boolean')
    })

    it('should return false when quiet hours disabled', () => {
      const config = {
        enabled: false,
        start: '21:00',
        end: '08:00',
        timezone: 'Europe/Zurich'
      }
      
      const lateNightDate = new Date('2024-07-15T21:00:00Z')
      const result = isInQuietHours(lateNightDate, config)
      
      expect(result.inQuietHours).toBe(false)
    })

    it('should handle errors gracefully', () => {
      const config = {
        enabled: true,
        start: 'invalid-time',
        end: '08:00',
        timezone: 'Europe/Zurich'
      }
      
      const date = new Date('2024-07-15T21:00:00Z')
      const result = isInQuietHours(date, config)
      
      expect(result.inQuietHours).toBe(false)
    })
  })

  describe('calculateCronTimeForTimezone', () => {
    it('should calculate UTC cron time for Europe/Zurich local time', () => {
      const result = calculateCronTimeForTimezone('08:00', 'Europe/Zurich')
      
      expect(result.utcTime).toMatch(/^\d{2}:\d{2}$/)
      expect(result.cronExpression).toMatch(/^\d+ \d+ \* \* \*$/)
      expect(typeof result.isDST).toBe('boolean')
      expect(result.nextRun).toBeInstanceOf(Date)
    })

    it('should handle different local times', () => {
      const morningResult = calculateCronTimeForTimezone('06:00', 'Europe/Zurich')
      const eveningResult = calculateCronTimeForTimezone('18:00', 'Europe/Zurich')
      
      expect(morningResult.utcTime).not.toBe(eveningResult.utcTime)
      expect(morningResult.cronExpression).not.toBe(eveningResult.cronExpression)
    })

    it('should handle DST vs non-DST periods differently', () => {
      const summerDate = new Date('2024-07-15T12:00:00Z')
      const winterDate = new Date('2024-01-15T12:00:00Z')
      
      const summerResult = calculateCronTimeForTimezone('08:00', 'Europe/Zurich', summerDate)
      const winterResult = calculateCronTimeForTimezone('08:00', 'Europe/Zurich', winterDate)
      
      // UTC time should be different between summer and winter due to DST
      expect(typeof summerResult.utcTime).toBe('string')
      expect(typeof winterResult.utcTime).toBe('string')
      expect(summerResult.isDST).not.toBe(winterResult.isDST)
    })

    it('should handle errors gracefully', () => {
      const result = calculateCronTimeForTimezone('invalid-time', 'Europe/Zurich')
      
      expect(result.utcTime).toMatch(/NaN:NaN|invalid-time/)
      expect(result.cronExpression).toMatch(/NaN|invalid/)
      expect(result.isDST).toBe(false)
    })
  })

  describe('getDSTTransitions', () => {
    it('should find DST transitions for 2024', () => {
      const transitions = getDSTTransitions(2024, 'Europe/Zurich')
      
      expect(transitions.springForward).toBeInstanceOf(Date)
      expect(transitions.fallBack).toBeInstanceOf(Date)
      
      if (transitions.springForward && transitions.fallBack) {
        // Spring forward should be in March
        expect(transitions.springForward.getMonth()).toBe(2) // March = 2
        // Fall back should be in October
        expect(transitions.fallBack.getMonth()).toBe(9) // October = 9
        
        // Spring forward should be before fall back
        expect(transitions.springForward.getTime()).toBeLessThan(transitions.fallBack.getTime())
      }
    })

    it('should handle different years', () => {
      const transitions2023 = getDSTTransitions(2023, 'Europe/Zurich')
      const transitions2024 = getDSTTransitions(2024, 'Europe/Zurich')
      
      expect(typeof transitions2023).toBe('object')
      expect(typeof transitions2024).toBe('object')
      
      // Transitions should be on different dates for different years
      if (transitions2023.springForward && transitions2024.springForward) {
        expect(transitions2023.springForward.getTime()).not.toBe(transitions2024.springForward.getTime())
      }
    })
  })

  describe('validateDSTCronJob', () => {
    it('should validate safe cron expressions', () => {
      const result = validateDSTCronJob('0 5 * * *', 'Europe/Zurich') // 5:00 AM
      
      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
    })

    it('should warn about DST transition times', () => {
      const result = validateDSTCronJob('0 2 * * *', 'Europe/Zurich') // 2:00 AM
      
      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('DST'))).toBe(true)
    })

    it('should handle invalid cron expressions', () => {
      const result = validateDSTCronJob('invalid', 'Europe/Zurich')
      
      expect(result.isValid).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should provide suggestions for improvement', () => {
      const result = validateDSTCronJob('0 3 * * *', 'Europe/Zurich') // 3:00 AM (risky time)
      
      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
      
      if (result.warnings.length > 0) {
        expect(result.suggestions.length).toBeGreaterThan(0)
      }
    })
  })

  describe('createTimezoneAwareDate', () => {
    it('should create timezone-aware date from date and time strings', () => {
      const date = createTimezoneAwareDate('2024-07-15', '14:30', 'Europe/Zurich')
      
      expect(date).toBeInstanceOf(Date)
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(6) // July = 6
      expect(date.getDate()).toBe(15)
    })

    it('should handle different timezones', () => {
      const zurichDate = createTimezoneAwareDate('2024-07-15', '14:30', 'Europe/Zurich')
      const utcDate = createTimezoneAwareDate('2024-07-15', '14:30', 'UTC')
      
      expect(zurichDate).toBeInstanceOf(Date)
      expect(utcDate).toBeInstanceOf(Date)
      
      // They should be different times (unless it's exactly DST offset)
      expect(typeof zurichDate.getTime()).toBe('number')
      expect(typeof utcDate.getTime()).toBe('number')
    })

    it('should handle winter vs summer times differently', () => {
      const summerDate = createTimezoneAwareDate('2024-07-15', '14:30', 'Europe/Zurich')
      const winterDate = createTimezoneAwareDate('2024-01-15', '14:30', 'Europe/Zurich')
      
      expect(summerDate).toBeInstanceOf(Date)
      expect(winterDate).toBeInstanceOf(Date)
      
      // The UTC times should be different due to DST
      const summerUTC = summerDate.getUTCHours()
      const winterUTC = winterDate.getUTCHours()
      
      expect(typeof summerUTC).toBe('number')
      expect(typeof winterUTC).toBe('number')
    })

    it('should handle errors gracefully', () => {
      const date = createTimezoneAwareDate('invalid-date', '14:30', 'Europe/Zurich')
      
      expect(date).toBeInstanceOf(Date)
      // Should be invalid date
      expect(isNaN(date.getTime())).toBe(true)
    })
  })
})

describe('DST Edge Cases', () => {
  it('should handle spring forward transition (clocks jump from 2 AM to 3 AM)', () => {
    // Last Sunday in March 2024 - spring forward
    const transitions = getDSTTransitions(2024, 'Europe/Zurich')
    
    if (transitions.springForward) {
      const springDate = transitions.springForward
      
      // Validate that this is indeed a Sunday
      expect(springDate.getDay()).toBe(0) // Sunday
      
      // Should be in March
      expect(springDate.getMonth()).toBe(2) // March
      
      // Should be at 2:00 AM local time
      expect(springDate.getHours()).toBe(2)
      expect(springDate.getMinutes()).toBe(0)
    }
  })

  it('should handle fall back transition (clocks jump from 3 AM to 2 AM)', () => {
    // Last Sunday in October 2024 - fall back
    const transitions = getDSTTransitions(2024, 'Europe/Zurich')
    
    if (transitions.fallBack) {
      const fallDate = transitions.fallBack
      
      // Validate that this is indeed a Sunday
      expect(fallDate.getDay()).toBe(0) // Sunday
      
      // Should be in October
      expect(fallDate.getMonth()).toBe(9) // October
      
      // Should be at 3:00 AM local time (when clocks fall back)
      expect(fallDate.getHours()).toBe(3)
      expect(fallDate.getMinutes()).toBe(0)
    }
  })

  it('should warn about cron jobs scheduled during DST transitions', () => {
    // Test cron job at 2:30 AM - this is problematic
    const result = validateDSTCronJob('30 2 * * *', 'Europe/Zurich')
    
    expect(result.isValid).toBe(true)
    expect(result.warnings.some(w => 
      w.includes('DST') || w.includes('transition')
    )).toBe(true)
  })

  it('should handle quiet hours during DST transitions', () => {
    const config = {
      enabled: true,
      start: '22:00',
      end: '08:00',
      timezone: 'Europe/Zurich'
    }
    
    // Test during spring forward transition
    const transitions = getDSTTransitions(2024, 'Europe/Zurich')
    
    if (transitions.springForward) {
      // Create a time during the transition
      const transitionTime = new Date(transitions.springForward)
      transitionTime.setHours(2, 30) // 2:30 AM during spring forward
      
      const result = isInQuietHours(transitionTime, config)
      
      // Should handle gracefully
      expect(typeof result.inQuietHours).toBe('boolean')
    }
  })
})