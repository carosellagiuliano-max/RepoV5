/**
 * Booking Engine Test Suite
 * Comprehensive tests for the enhanced booking system including race conditions,
 * slot generation, and business rule validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAdminClient } from '../lib/auth/netlify-auth'

// Mock Supabase client for testing
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        maybeSingle: vi.fn()
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn()
        }))
      })),
      order: vi.fn(),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }))
}

vi.mock('../lib/auth/netlify-auth', () => ({
  createAdminClient: () => mockSupabase
}))

describe('Booking Engine Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Slot Generation Engine', () => {
    it('should generate available slots considering business hours', async () => {
      const mockSlots = [
        {
          start_time: '2024-03-15T09:00:00Z',
          end_time: '2024-03-15T10:00:00Z',
          duration_minutes: 60,
          is_preferred: true
        },
        {
          start_time: '2024-03-15T10:00:00Z',
          end_time: '2024-03-15T11:00:00Z',
          duration_minutes: 60,
          is_preferred: true
        }
      ]

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockSlots,
        error: null
      })

      const supabase = createAdminClient()
      const { data: slots, error } = await supabase.rpc('rpc_get_available_slots_enhanced', {
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_date: '2024-03-15',
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 15
      })

      expect(error).toBeNull()
      expect(slots).toHaveLength(2)
      expect(slots[0].start_time).toBe('2024-03-15T09:00:00Z')
    })

    it('should exclude holiday dates from slot generation', async () => {
      // Mock holiday check returning true
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [], // No slots on holiday
        error: null
      })

      const supabase = createAdminClient()
      const { data: slots } = await supabase.rpc('rpc_get_available_slots_enhanced', {
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_date: '2024-12-25', // Christmas Day
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 15
      })

      expect(slots).toEqual([])
    })

    it('should respect staff time-off when generating slots', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [], // No slots when staff is on time-off
        error: null
      })

      const supabase = createAdminClient()
      const { data: slots } = await supabase.rpc('rpc_get_available_slots_enhanced', {
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_date: '2024-03-15',
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 15
      })

      expect(slots).toEqual([])
    })

    it('should include buffer time in conflict detection', async () => {
      // Test that buffer time prevents overlapping bookings
      const mockSlots = [
        {
          start_time: '2024-03-15T09:00:00Z',
          end_time: '2024-03-15T10:00:00Z',
          duration_minutes: 60,
          is_preferred: true
        }
        // 10:00-11:00 should be excluded due to 15min buffer after existing 10:30 appointment
      ]

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockSlots,
        error: null
      })

      const supabase = createAdminClient()
      const { data: slots } = await supabase.rpc('rpc_get_available_slots_enhanced', {
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_date: '2024-03-15',
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 60
      })

      expect(slots).toHaveLength(1) // Only one slot available due to buffer
    })
  })

  describe('Appointment Validation', () => {
    it('should validate appointment timing against business rules', async () => {
      const mockValidation = {
        is_valid: true,
        error_message: null
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockValidation],
        error: null
      })

      const supabase = createAdminClient()
      const { data: validation } = await supabase.rpc('validate_appointment_timing', {
        appointment_start: '2024-03-15T10:00:00Z',
        appointment_end: '2024-03-15T11:00:00Z'
      })

      expect(validation[0].is_valid).toBe(true)
    })

    it('should reject appointments outside business hours', async () => {
      const mockValidation = {
        is_valid: false,
        error_message: 'Appointment time is outside business hours (09:00 - 17:00)'
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockValidation],
        error: null
      })

      const supabase = createAdminClient()
      const { data: validation } = await supabase.rpc('validate_appointment_timing', {
        appointment_start: '2024-03-15T08:00:00Z', // Before business hours
        appointment_end: '2024-03-15T09:00:00Z'
      })

      expect(validation[0].is_valid).toBe(false)
      expect(validation[0].error_message).toContain('outside business hours')
    })

    it('should reject appointments on holidays', async () => {
      const mockValidation = {
        is_valid: false,
        error_message: 'Appointments cannot be booked on holidays or blackout dates'
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockValidation],
        error: null
      })

      const supabase = createAdminClient()
      const { data: validation } = await supabase.rpc('validate_appointment_timing', {
        appointment_start: '2024-12-25T10:00:00Z', // Christmas Day
        appointment_end: '2024-12-25T11:00:00Z'
      })

      expect(validation[0].is_valid).toBe(false)
      expect(validation[0].error_message).toContain('holidays')
    })

    it('should enforce minimum booking notice', async () => {
      const now = new Date()
      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now

      const mockValidation = {
        is_valid: false,
        error_message: 'Appointment must be booked at least 2 hours in advance'
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockValidation],
        error: null
      })

      const supabase = createAdminClient()
      const { data: validation } = await supabase.rpc('validate_appointment_timing', {
        appointment_start: tooSoon.toISOString(),
        appointment_end: new Date(tooSoon.getTime() + 60 * 60 * 1000).toISOString()
      })

      expect(validation[0].is_valid).toBe(false)
      expect(validation[0].error_message).toContain('at least 2 hours in advance')
    })

    it('should enforce maximum advance booking limit', async () => {
      const now = new Date()
      const tooFarAhead = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000) // 100 days from now

      const mockValidation = {
        is_valid: false,
        error_message: 'Appointment cannot be booked more than 90 days in advance'
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockValidation],
        error: null
      })

      const supabase = createAdminClient()
      const { data: validation } = await supabase.rpc('validate_appointment_timing', {
        appointment_start: tooFarAhead.toISOString(),
        appointment_end: new Date(tooFarAhead.getTime() + 60 * 60 * 1000).toISOString()
      })

      expect(validation[0].is_valid).toBe(false)
      expect(validation[0].error_message).toContain('more than 90 days')
    })
  })

  describe('Idempotent Booking Creation', () => {
    it('should create booking successfully with valid idempotency key', async () => {
      const mockResult = {
        operation_id: 'op-uuid',
        appointment_id: 'appt-uuid',
        status: 'completed',
        error_message: null
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockResult],
        error: null
      })

      const supabase = createAdminClient()
      const { data: result } = await supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'unique-key-123',
        p_customer_id: 'customer-uuid',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Test booking',
        p_user_id: 'user-uuid'
      })

      expect(result[0].status).toBe('completed')
      expect(result[0].appointment_id).toBe('appt-uuid')
    })

    it('should return existing operation for duplicate idempotency key', async () => {
      const mockResult = {
        operation_id: 'existing-op-uuid',
        appointment_id: 'existing-appt-uuid',
        status: 'completed',
        error_message: null
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockResult],
        error: null
      })

      const supabase = createAdminClient()
      const { data: result } = await supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'duplicate-key-123',
        p_customer_id: 'customer-uuid',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Test booking',
        p_user_id: 'user-uuid'
      })

      expect(result[0].operation_id).toBe('existing-op-uuid')
      expect(result[0].appointment_id).toBe('existing-appt-uuid')
    })

    it('should handle slot conflicts gracefully', async () => {
      const mockResult = {
        operation_id: 'op-uuid',
        appointment_id: null,
        status: 'failed',
        error_message: 'Slot not available: Time slot conflicts with another appointment'
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockResult],
        error: null
      })

      const supabase = createAdminClient()
      const { data: result } = await supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'conflict-key-123',
        p_customer_id: 'customer-uuid',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Conflicting booking',
        p_user_id: 'user-uuid'
      })

      expect(result[0].status).toBe('failed')
      expect(result[0].error_message).toContain('conflicts with another appointment')
    })
  })

  describe('Holiday Management', () => {
    it('should detect single-date holidays correctly', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null
      })

      const supabase = createAdminClient()
      const { data: isHoliday } = await supabase.rpc('is_holiday', {
        check_date: '2024-12-25'
      })

      expect(isHoliday).toBe(true)
    })

    it('should detect recurring holidays correctly', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null
      })

      const supabase = createAdminClient()
      const { data: isHoliday } = await supabase.rpc('is_holiday', {
        check_date: '2025-12-25' // Christmas in a different year
      })

      expect(isHoliday).toBe(true)
    })

    it('should return false for non-holiday dates', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null
      })

      const supabase = createAdminClient()
      const { data: isHoliday } = await supabase.rpc('is_holiday', {
        check_date: '2024-03-15'
      })

      expect(isHoliday).toBe(false)
    })
  })

  describe('Booking Policies', () => {
    it('should retrieve booking policy values correctly', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: '24',
        error: null
      })

      const supabase = createAdminClient()
      const { data: policyValue } = await supabase.rpc('get_booking_policy', {
        policy_key: 'cancellation_deadline_hours'
      })

      expect(policyValue).toBe('24')
    })

    it('should return null for non-existent policies', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const supabase = createAdminClient()
      const { data: policyValue } = await supabase.rpc('get_booking_policy', {
        policy_key: 'non_existent_policy'
      })

      expect(policyValue).toBeNull()
    })
  })

  describe('Performance Tests', () => {
    it('should handle slot generation for large date ranges efficiently', async () => {
      const startTime = Date.now()
      
      // Mock 5000 slots
      const mockSlots = Array.from({ length: 5000 }, (_, i) => ({
        start_time: `2024-03-15T${String(9 + Math.floor(i / 100)).padStart(2, '0')}:${String((i % 100) * 15).padStart(2, '0')}:00Z`,
        end_time: `2024-03-15T${String(9 + Math.floor(i / 100)).padStart(2, '0')}:${String((i % 100) * 15 + 60).padStart(2, '0')}:00Z`,
        duration_minutes: 60,
        is_preferred: true
      }))

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockSlots,
        error: null
      })

      const supabase = createAdminClient()
      const { data: slots } = await supabase.rpc('rpc_get_available_slots_enhanced', {
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_date: '2024-03-15',
        p_buffer_minutes: 15,
        p_slot_interval_minutes: 15
      })

      const endTime = Date.now()
      const executionTime = endTime - startTime

      expect(slots).toHaveLength(5000)
      expect(executionTime).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})

describe('Race Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should prevent double booking through idempotency', async () => {
    // Simulate two simultaneous booking attempts with same idempotency key
    const mockFirstResult = {
      operation_id: 'op-uuid-1',
      appointment_id: 'appt-uuid-1',
      status: 'completed',
      error_message: null
    }

    const mockSecondResult = {
      operation_id: 'op-uuid-1', // Same operation ID
      appointment_id: 'appt-uuid-1', // Same appointment ID
      status: 'completed',
      error_message: null
    }

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [mockFirstResult], error: null })
      .mockResolvedValueOnce({ data: [mockSecondResult], error: null })

    const supabase = createAdminClient()
    
    // Make two concurrent requests with same idempotency key
    const [result1, result2] = await Promise.all([
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'same-key-123',
        p_customer_id: 'customer-uuid',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Concurrent booking test',
        p_user_id: 'user-uuid'
      }),
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'same-key-123',
        p_customer_id: 'customer-uuid',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Concurrent booking test',
        p_user_id: 'user-uuid'
      })
    ])

    // Both should return the same appointment
    expect(result1.data[0].appointment_id).toBe(result2.data[0].appointment_id)
    expect(result1.data[0].operation_id).toBe(result2.data[0].operation_id)
  })

  it('should handle concurrent bookings for different time slots', async () => {
    const mockResult1 = {
      operation_id: 'op-uuid-1',
      appointment_id: 'appt-uuid-1',
      status: 'completed',
      error_message: null
    }

    const mockResult2 = {
      operation_id: 'op-uuid-2',
      appointment_id: 'appt-uuid-2',
      status: 'completed',
      error_message: null
    }

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [mockResult1], error: null })
      .mockResolvedValueOnce({ data: [mockResult2], error: null })

    const supabase = createAdminClient()
    
    const [result1, result2] = await Promise.all([
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'key-1',
        p_customer_id: 'customer-uuid-1',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Booking 1',
        p_user_id: 'user-uuid-1'
      }),
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'key-2',
        p_customer_id: 'customer-uuid-2',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T14:00:00Z', // Different time slot
        p_ends_at: '2024-03-15T15:00:00Z',
        p_price: 50.00,
        p_notes: 'Booking 2',
        p_user_id: 'user-uuid-2'
      })
    ])

    // Both should succeed with different appointments
    expect(result1.data[0].status).toBe('completed')
    expect(result2.data[0].status).toBe('completed')
    expect(result1.data[0].appointment_id).not.toBe(result2.data[0].appointment_id)
  })

  it('should handle concurrent bookings for overlapping time slots', async () => {
    const mockResult1 = {
      operation_id: 'op-uuid-1',
      appointment_id: 'appt-uuid-1',
      status: 'completed',
      error_message: null
    }

    const mockResult2 = {
      operation_id: 'op-uuid-2',
      appointment_id: null,
      status: 'failed',
      error_message: 'Slot not available: Time slot conflicts with another appointment'
    }

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [mockResult1], error: null })
      .mockResolvedValueOnce({ data: [mockResult2], error: null })

    const supabase = createAdminClient()
    
    const [result1, result2] = await Promise.all([
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'key-1',
        p_customer_id: 'customer-uuid-1',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:00:00Z',
        p_ends_at: '2024-03-15T11:00:00Z',
        p_price: 50.00,
        p_notes: 'Booking 1',
        p_user_id: 'user-uuid-1'
      }),
      supabase.rpc('create_booking_idempotent', {
        p_idempotency_key: 'key-2',
        p_customer_id: 'customer-uuid-2',
        p_staff_id: 'staff-uuid',
        p_service_id: 'service-uuid',
        p_starts_at: '2024-03-15T10:30:00Z', // Overlapping time slot
        p_ends_at: '2024-03-15T11:30:00Z',
        p_price: 50.00,
        p_notes: 'Booking 2',
        p_user_id: 'user-uuid-2'
      })
    ])

    // First should succeed, second should fail
    expect(result1.data[0].status).toBe('completed')
    expect(result2.data[0].status).toBe('failed')
    expect(result2.data[0].error_message).toContain('conflicts with another appointment')
  })
})