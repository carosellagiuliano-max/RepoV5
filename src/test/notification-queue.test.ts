import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { NotificationQueueManager } from '../lib/notifications/notification-queue'
import { NotificationData } from '../lib/notifications/types'
import { createClient } from '@supabase/supabase-js'

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  }
}))

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  lte: vi.fn(() => mockSupabaseClient),
  gte: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
}

describe('NotificationQueueManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createClient as Mock).mockReturnValue(mockSupabaseClient)
  })
    vi.clearAllMocks()
    ;(createClient as Mock).mockReturnValue(mockSupabase)
    mockSupabase.from.mockReturnValue(mockSupabase)
  })

  describe('enqueue', () => {
    it('should successfully enqueue a notification', async () => {
      const mockNotificationId = 'notification-123'
      mockSupabaseClient.single.mockResolvedValue({ 
        data: { id: mockNotificationId }, 
        error: null 
      })

      const notification: NotificationData = {
        id: '',
        type: 'email',
        channel: 'appointment_reminder',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        templateData: {
          customerName: 'Max Mustermann',
          serviceName: 'Herrenhaarschnitt',
          appointmentDate: '15.12.2024',
          appointmentTime: '10:00',
          staffName: 'Anna Schmidt',
          salonName: 'Schnittwerk Your Style',
          salonPhone: '+49 123 456789',
          salonAddress: 'Musterstraße 123',
          appointmentId: 'apt-123'
        },
        scheduledFor: new Date('2024-12-14T10:00:00Z')
      }

      const result = await NotificationQueueManager.enqueue(notification)

      expect(result).toBe(mockNotificationId)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notification_queue')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email',
          channel: 'appointment_reminder',
          recipient_id: 'user-123',
          recipient_email: 'test@example.com',
          template_data: notification.templateData,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        })
      )
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabaseClient.single.mockResolvedValue({ 
        data: null, 
        error: mockError 
      })
      mockSupabase.from.mockReturnValue(mockChain)

      const notification: NotificationData = {
        id: '',
        type: 'email',
        channel: 'appointment_reminder',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        templateData: {},
        scheduledFor: new Date()
      }

      await expect(NotificationQueueManager.enqueue(notification)).rejects.toThrow('Failed to enqueue notification: Database error')
    })
  })

  describe('getPendingNotifications', () => {
    it('should fetch pending notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: 'email',
          channel: 'appointment_reminder',
          recipient_id: 'user-1',
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
          scheduled_for: '2024-12-14T10:00:00Z'
        },
        {
          id: 'notif-2',
          type: 'sms',
          channel: 'appointment_confirmation',
          recipient_id: 'user-2',
          status: 'pending',
          attempts: 1,
          max_attempts: 3,
          scheduled_for: '2024-12-14T11:00:00Z'
        }
      ]

      const mockChain = setupMockChain(mockNotifications)
      mockSupabase.from.mockReturnValue(mockChain)

      const result = await NotificationQueueManager.getPendingNotifications(10)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('notif-1')
      expect(result[1].id).toBe('notif-2')
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue')
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending')
      expect(mockChain.limit).toHaveBeenCalledWith(10)
    })

    it('should return empty array when no pending notifications', async () => {
      const mockChain = setupMockChain([])
      mockSupabase.from.mockReturnValue(mockChain)

      const result = await NotificationQueueManager.getPendingNotifications()

      expect(result).toHaveLength(0)
    })
  })

  describe('markAsSent', () => {
    it('should mark notification as sent', async () => {
      const mockChain = setupMockChain()
      mockSupabase.from.mockReturnValue(mockChain)

      const notificationId = 'notif-123'
      const result = {
        success: true,
        messageId: 'msg-123',
        attempts: 1
      }

      await NotificationQueueManager.markAsSent(notificationId, result)

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue')
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(String)
        })
      )
      expect(mockChain.eq).toHaveBeenCalledWith('id', notificationId)
    })
  })

  describe('markAsFailed', () => {
    it('should mark notification as failed when max attempts reached', async () => {
      const mockNotification = { attempts: 2, max_attempts: 3 }
      const mockChain = setupMockChain(mockNotification)
      mockSupabase.from.mockReturnValue(mockChain)

      const notificationId = 'notif-123'
      const result = {
        success: false,
        error: 'Send failed',
        attempts: 3
      }

      await NotificationQueueManager.markAsFailed(notificationId, result)

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          attempts: 3,
          error_message: 'Send failed',
          failed_at: expect.any(String)
        })
      )
    })

    it('should mark notification as pending for retry when attempts available', async () => {
      const mockNotification = { attempts: 1, max_attempts: 3 }
      const mockChain = setupMockChain(mockNotification)
      mockSupabase.from.mockReturnValue(mockChain)

      const notificationId = 'notif-123'
      const result = {
        success: false,
        error: 'Temporary failure',
        attempts: 2
      }

      await NotificationQueueManager.markAsFailed(notificationId, result)

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          attempts: 2,
          error_message: 'Temporary failure'
        })
      )
    })
  })

  describe('cancelNotification', () => {
    it('should cancel pending notification', async () => {
      const mockChain = setupMockChain()
      mockSupabase.from.mockReturnValue(mockChain)

      const notificationId = 'notif-123'

      await NotificationQueueManager.cancelNotification(notificationId)

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue')
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled'
        })
      )
      expect(mockChain.eq).toHaveBeenCalledWith('id', notificationId)
      expect(mockChain.in).toHaveBeenCalledWith('status', ['pending', 'sending'])
    })
  })

  describe('scheduleNotification', () => {
    it('should schedule a notification with correct parameters', async () => {
      const mockNotificationId = 'notification-456'
      const mockChain = setupMockChain({ id: mockNotificationId })
      mockSupabase.from.mockReturnValue(mockChain)

      const scheduledFor = new Date('2024-12-15T09:00:00Z')
      const templateData = { customerName: 'John Doe', serviceName: 'Haircut' }

      const result = await NotificationQueueManager.scheduleNotification(
        'email',
        'appointment_reminder',
        'user-123',
        templateData,
        scheduledFor,
        'john@example.com'
      )

      expect(result).toBe(mockNotificationId)
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email',
          channel: 'appointment_reminder',
          recipient_id: 'user-123',
          recipient_email: 'john@example.com',
          template_data: templateData,
          scheduled_for: scheduledFor.toISOString()
        })
      )
    })
  })

  describe('cancelAppointmentNotifications', () => {
    it('should cancel all notifications for an appointment', async () => {
      const mockData = [{ id: 'notif-1' }, { id: 'notif-2' }]
      const mockChain = setupMockChain(mockData)
      mockSupabase.from.mockReturnValue(mockChain)

      const appointmentId = 'apt-123'
      const result = await NotificationQueueManager.cancelAppointmentNotifications(appointmentId)

      expect(result).toBe(2)
      expect(mockChain.eq).toHaveBeenCalledWith('template_data->>appointmentId', appointmentId)
      expect(mockChain.in).toHaveBeenCalledWith('status', ['pending', 'sending'])
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled'
        })
      )
    })
  })

  describe('getStatistics', () => {
    it('should return notification statistics', async () => {
      const mockData = [
        { status: 'sent', channel: 'appointment_reminder', type: 'email' },
        { status: 'sent', channel: 'appointment_confirmation', type: 'email' },
        { status: 'failed', channel: 'appointment_reminder', type: 'sms' },
        { status: 'pending', channel: 'appointment_reminder', type: 'email' }
      ]
      const mockChain = setupMockChain(mockData)
      mockSupabase.from.mockReturnValue(mockChain)

      const stats = await NotificationQueueManager.getStatistics(30)

      expect(stats.total).toBe(4)
      expect(stats.sent).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.pending).toBe(1)
      expect(stats.byChannel.appointment_reminder).toBe(3)
      expect(stats.byChannel.appointment_confirmation).toBe(1)
      expect(stats.byType.email).toBe(3)
      expect(stats.byType.sms).toBe(1)
    })
  })

  describe('cleanupOldNotifications', () => {
    it('should delete old completed notifications', async () => {
      const mockData = [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }]
      const mockChain = setupMockChain(mockData)
      mockSupabase.from.mockReturnValue(mockChain)

      const result = await NotificationQueueManager.cleanupOldNotifications(90)

      expect(result).toBe(3)
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue')
      expect(mockChain.delete).toHaveBeenCalled()
      expect(mockChain.in).toHaveBeenCalledWith('status', ['sent', 'failed', 'cancelled'])
    })
  })
})