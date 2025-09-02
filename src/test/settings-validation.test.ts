/**
 * Unit tests for business settings validation
 */
import { describe, test, expect } from 'vitest'
import { 
  businessSettingsSchema, 
  emailSettingsSchema, 
  openingHoursSchema,
  dayHoursSchema,
  settingValueSchema
} from '../lib/validation/schemas'

describe('Business Settings Validation', () => {
  test('validates complete business settings', () => {
    const validBusinessSettings = {
      opening_hours: {
        "0": { is_open: false, start_time: "10:00", end_time: "14:00" },
        "1": { is_open: true, start_time: "09:00", end_time: "18:00" },
        "2": { is_open: true, start_time: "09:00", end_time: "18:00" },
        "3": { is_open: true, start_time: "09:00", end_time: "18:00" },
        "4": { is_open: true, start_time: "09:00", end_time: "18:00" },
        "5": { is_open: true, start_time: "09:00", end_time: "18:00" },
        "6": { is_open: true, start_time: "08:00", end_time: "16:00" }
      },
      max_advance_booking_days: 30,
      buffer_time_minutes: 15,
      business_name: "Schnittwerk Your Style",
      business_address: "Main Street 123, Test City",
      business_phone: "+49123456789",
      business_email: "info@schnittwerk.com"
    }

    const result = businessSettingsSchema.safeParse(validBusinessSettings)
    expect(result.success).toBe(true)
  })

  test('rejects invalid advance booking days', () => {
    const invalidSettings = {
      opening_hours: {
        "1": { is_open: true, start_time: "09:00", end_time: "18:00" }
      },
      max_advance_booking_days: 400, // Too high
      buffer_time_minutes: 15,
      business_name: "Test",
      business_address: "Test",
      business_phone: "+49123456789",
      business_email: "test@test.com"
    }

    const result = businessSettingsSchema.safeParse(invalidSettings)
    expect(result.success).toBe(false)
  })

  test('validates day hours correctly', () => {
    const validDayHours = {
      is_open: true,
      start_time: "09:00",
      end_time: "18:00"
    }

    const result = dayHoursSchema.safeParse(validDayHours)
    expect(result.success).toBe(true)
  })

  test('rejects invalid time range', () => {
    const invalidDayHours = {
      is_open: true,
      start_time: "18:00",
      end_time: "09:00" // End before start
    }

    const result = dayHoursSchema.safeParse(invalidDayHours)
    expect(result.success).toBe(false)
  })
})

describe('Email Settings Validation', () => {
  test('validates complete email settings', () => {
    const validEmailSettings = {
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      smtp_username: "test@gmail.com",
      smtp_password: "password123",
      smtp_from_email: "noreply@schnittwerk.com",
      smtp_from_name: "Schnittwerk Your Style",
      smtp_use_tls: true
    }

    const result = emailSettingsSchema.safeParse(validEmailSettings)
    expect(result.success).toBe(true)
  })

  test('rejects invalid email format', () => {
    const invalidEmailSettings = {
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      smtp_username: "test@gmail.com",
      smtp_password: "password123",
      smtp_from_email: "invalid-email", // Invalid email
      smtp_from_name: "Test",
      smtp_use_tls: true
    }

    const result = emailSettingsSchema.safeParse(invalidEmailSettings)
    expect(result.success).toBe(false)
  })
})

describe('Setting Value Schema', () => {
  test('accepts string values', () => {
    const result = settingValueSchema.safeParse("test string")
    expect(result.success).toBe(true)
  })

  test('accepts number values', () => {
    const result = settingValueSchema.safeParse(42)
    expect(result.success).toBe(true)
  })

  test('accepts boolean values', () => {
    const result = settingValueSchema.safeParse(true)
    expect(result.success).toBe(true)
  })

  test('accepts opening hours object', () => {
    const openingHours = {
      "1": { is_open: true, start_time: "09:00", end_time: "18:00" },
      "2": { is_open: false, start_time: "10:00", end_time: "14:00" }
    }
    const result = settingValueSchema.safeParse(openingHours)
    expect(result.success).toBe(true)
  })

  test('accepts record objects', () => {
    const record = { key1: "value1", key2: 42, key3: true }
    const result = settingValueSchema.safeParse(record)
    expect(result.success).toBe(true)
  })

  test('accepts arrays', () => {
    const array = ["item1", "item2", 123]
    const result = settingValueSchema.safeParse(array)
    expect(result.success).toBe(true)
  })
})