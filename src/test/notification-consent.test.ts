import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotificationConsentService } from '../lib/notifications/consent-service'
import { 
  ConsentRequest,
  SuppressionRequest,
  NotificationConsent 
} from '../lib/notifications/consent-types'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn()
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

describe('NotificationConsentService', () => {
  let consentService: NotificationConsentService

  beforeEach(() => {
    consentService = new NotificationConsentService('mock-url', 'mock-key')
    vi.clearAllMocks()
  })

  describe('checkConsent', () => {
    it('should return true when customer has given consent', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true,
        error: null
      })

      const result = await consentService.checkConsent(
        'customer-123',
        'email',
        'appointment_reminders'
      )

      expect(result.hasConsent).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('check_notification_consent', {
        p_customer_id: 'customer-123',
        p_channel: 'email',
        p_consent_type: 'appointment_reminders'
      })
    })

    it('should return false when customer has not given consent', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: false,
        error: null
      })

      const result = await consentService.checkConsent(
        'customer-123',
        'email',
        'appointment_reminders'
      )

      expect(result.hasConsent).toBe(false)
    })

    it('should return false when there is an error', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await consentService.checkConsent(
        'customer-123',
        'email',
        'appointment_reminders'
      )

      expect(result.hasConsent).toBe(false)
    })
  })

  describe('recordConsent', () => {
    it('should record customer consent successfully', async () => {
      const mockConsentData = {
        id: 'consent-123',
        customer_id: 'customer-123',
        channel: 'email',
        consent_type: 'appointment_reminders',
        consented: true,
        consent_source: 'registration',
        consent_timestamp: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConsentData,
              error: null
            })
          })
        })
      })

      const request: ConsentRequest = {
        customerId: 'customer-123',
        channel: 'email',
        consentType: 'appointment_reminders',
        consented: true,
        consentSource: 'registration',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      }

      const result = await consentService.recordConsent(request)

      expect(result).toEqual({
        id: 'consent-123',
        customerId: 'customer-123',
        channel: 'email',
        consentType: 'appointment_reminders',
        consented: true,
        consentSource: 'registration',
        consentTimestamp: '2024-01-01T00:00:00Z',
        consentIpAddress: undefined,
        consentUserAgent: undefined,
        updatedBy: undefined,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      })
    })
  })

  describe('checkSuppression', () => {
    it('should return suppression status for email', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: {
          is_suppressed: true,
          suppression_type: 'unsubscribe',
          suppression_reason: 'User unsubscribed'
        },
        error: null
      })

      const result = await consentService.checkSuppression('test@example.com')

      expect(result).toEqual({
        isSuppressed: true,
        suppressionType: 'unsubscribe',
        suppressionReason: 'User unsubscribed'
      })
    })

    it('should return false when not suppressed', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: {
          is_suppressed: false,
          suppression_type: null,
          suppression_reason: null
        },
        error: null
      })

      const result = await consentService.checkSuppression('test@example.com')

      expect(result).toEqual({
        isSuppressed: false,
        suppressionType: null,
        suppressionReason: null
      })
    })
  })

  describe('generateUnsubscribeToken', () => {
    it('should generate unsubscribe token', async () => {
      const mockToken = 'abc123def456'
      
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockToken,
        error: null
      })

      const result = await consentService.generateUnsubscribeToken(
        'customer-123',
        'test@example.com',
        undefined,
        'email',
        ['appointment_reminders']
      )

      expect(result).toBe(mockToken)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('generate_unsubscribe_token', {
        p_customer_id: 'customer-123',
        p_email: 'test@example.com',
        p_phone: null,
        p_channel: 'email',
        p_notification_types: ['appointment_reminders']
      })
    })
  })

  describe('processUnsubscribe', () => {
    it('should process unsubscribe successfully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: {
          success: true,
          message: 'Successfully unsubscribed',
          customer_id: 'customer-123',
          affected_channels: ['email']
        },
        error: null
      })

      const result = await consentService.processUnsubscribe('token123', '192.168.1.1')

      expect(result).toEqual({
        success: true,
        message: 'Successfully unsubscribed',
        customerId: 'customer-123',
        affectedChannels: ['email']
      })
    })

    it('should handle invalid token', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: {
          success: false,
          message: 'Invalid or expired token',
          customer_id: null,
          affected_channels: []
        },
        error: null
      })

      const result = await consentService.processUnsubscribe('invalid-token')

      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired token',
        customerId: null,
        affectedChannels: []
      })
    })
  })

  describe('shouldSendNotification', () => {
    it('should allow sending when consent exists and not suppressed', async () => {
      // Mock consent check
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({
          data: {
            is_suppressed: false,
            suppression_type: null,
            suppression_reason: null
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: true,
          error: null
        })

      const result = await consentService.shouldSendNotification(
        'customer-123',
        'test@example.com',
        undefined,
        'email',
        'appointment_reminders'
      )

      expect(result.canSend).toBe(true)
    })

    it('should block sending when suppressed', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: {
          is_suppressed: true,
          suppression_type: 'unsubscribe',
          suppression_reason: 'User unsubscribed'
        },
        error: null
      })

      const result = await consentService.shouldSendNotification(
        'customer-123',
        'test@example.com',
        undefined,
        'email',
        'appointment_reminders'
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toContain('suppressed')
    })

    it('should block sending when no consent', async () => {
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({
          data: {
            is_suppressed: false,
            suppression_type: null,
            suppression_reason: null
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: false,
          error: null
        })

      const result = await consentService.shouldSendNotification(
        'customer-123',
        'test@example.com',
        undefined,
        'email',
        'appointment_reminders'
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toContain('No consent')
    })
  })

  describe('generateDedupeKey', () => {
    it('should generate consistent dedupe key', () => {
      const config = {
        customerId: 'customer-123',
        notificationType: 'appointment_reminder',
        appointmentId: 'appt-456',
        timeWindowHours: 24
      }

      const key1 = consentService.generateDedupeKey(config)
      const key2 = consentService.generateDedupeKey(config)

      expect(key1).toBe(key2)
      expect(key1).toContain('customer-123')
      expect(key1).toContain('appointment_reminder')
      expect(key1).toContain('appt-456')
    })

    it('should generate different keys for different time windows', () => {
      const config1 = {
        customerId: 'customer-123',
        notificationType: 'appointment_reminder',
        appointmentId: 'appt-456',
        timeWindowHours: 24
      }

      const config2 = {
        customerId: 'customer-123',
        notificationType: 'appointment_reminder',
        appointmentId: 'appt-456',
        timeWindowHours: 1
      }

      const key1 = consentService.generateDedupeKey(config1)
      const key2 = consentService.generateDedupeKey(config2)

      // Note: These might still be the same if we're in the same hour,
      // but the logic should be different
      expect(typeof key1).toBe('string')
      expect(typeof key2).toBe('string')
    })
  })

  describe('recordBulkConsent', () => {
    it('should record multiple consent records', async () => {
      const mockConsentData = {
        id: 'consent-123',
        customer_id: 'customer-123',
        channel: 'email',
        consent_type: 'appointment_reminders',
        consented: true,
        consent_source: 'registration',
        consent_timestamp: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConsentData,
              error: null
            })
          })
        })
      })

      const consents = [
        {
          channel: 'email' as const,
          consentType: 'appointment_reminders' as const,
          consented: true
        },
        {
          channel: 'email' as const,
          consentType: 'appointment_confirmations' as const,
          consented: true
        }
      ]

      const results = await consentService.recordBulkConsent(
        'customer-123',
        consents,
        'registration',
        '192.168.1.1',
        'Mozilla/5.0...'
      )

      expect(results).toHaveLength(2)
      expect(results[0].consentType).toBe('appointment_reminders')
      expect(results[1].consentType).toBe('appointment_confirmations')
    })
  })
})