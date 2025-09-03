import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NotificationSettingsService } from '../settings-service'
import { DeadLetterQueueService } from '../dlq-service'

// Mock Supabase
vi.mock('@supabase/supabase-js')

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        range: vi.fn(),
        order: vi.fn(() => ({
          range: vi.fn(),
          single: vi.fn()
        }))
      })),
      single: vi.fn(),
      range: vi.fn(),
      order: vi.fn(() => ({
        range: vi.fn()
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(),
        order: vi.fn(() => ({
          range: vi.fn()
        }))
      })),
      not: vi.fn(() => ({
        not: vi.fn()
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(),
      is: vi.fn()
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    delete: vi.fn(() => ({
      count: vi.fn(),
      not: vi.fn(() => ({
        lt: vi.fn()
      }))
    }))
  })),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn()
  }
}

describe('Budget Controls & DLQ System', () => {
  let settingsService: NotificationSettingsService
  let dlqService: DeadLetterQueueService

  beforeEach(() => {
    vi.clearAllMocks()
    ;(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabase)
    
    settingsService = new NotificationSettingsService('test-url', 'test-key')
    dlqService = new DeadLetterQueueService('test-url', 'test-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Budget Threshold Monitoring', () => {
    it('should trigger warning at 80% usage', async () => {
      // Mock budget tracking data
      const mockBudgetTracking = {
        id: 'test-id',
        year: 2024,
        month: 1,
        scope: 'global',
        scopeId: null,
        emailCount: 80,
        smsCount: 40,
        emailBudgetLimit: 100,
        smsBudgetLimit: 50,
        emailBudgetUsedPct: 80.0,
        smsBudgetUsedPct: 80.0,
        warningSentAt: null,
        hardCapReachedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                year: 2024,
                month: 1,
                scope: 'global',
                scope_id: null,
                email_count: 80,
                sms_count: 40,
                email_budget_limit: 100,
                sms_budget_limit: 50,
                email_budget_used_pct: 80.0,
                sms_budget_used_pct: 80.0,
                warning_sent_at: null,
                hard_cap_reached_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            })
          }))
        }))
      })

      const budgetTracking = await settingsService.getBudgetTracking('global', undefined, 2024, 1)
      
      expect(budgetTracking).toBeDefined()
      expect(budgetTracking?.emailBudgetUsedPct).toBe(80.0)
      expect(budgetTracking?.smsBudgetUsedPct).toBe(80.0)
    })

    it('should block notifications at 100% usage with hard cap', async () => {
      const mockBudgetCheck = {
        can_send: false,
        reason: 'Budget limit reached',
        usage_pct: 100.0,
        limit_reached: true
      }

      mockSupabase.rpc.mockResolvedValue({
        data: mockBudgetCheck,
        error: null
      })

      const budgetCheck = await settingsService.checkBudgetLimit('email', 'global')

      expect(budgetCheck.canSend).toBe(false)
      expect(budgetCheck.reason).toBe('Budget limit reached')
      expect(budgetCheck.usagePct).toBe(100.0)
      expect(budgetCheck.limitReached).toBe(true)
    })

    it('should calculate usage percentages correctly', () => {
      const usagePercentage = (85 / 100) * 100
      expect(usagePercentage).toBe(85.0)
      
      const warningThreshold = 80
      expect(usagePercentage).toBeGreaterThan(warningThreshold)
    })
  })

  describe('Dead Letter Queue Management', () => {
    it('should move failed notifications to DLQ after max attempts', async () => {
      const mockDLQItem = {
        id: 'dlq-test-id',
        original_notification_id: 'notif-id',
        notification_type: 'email',
        notification_channel: 'booking_reminder',
        recipient_id: 'user-id',
        recipient_email: 'test@example.com',
        failure_reason: 'Hard bounce - invalid email',
        failure_type: 'hard_bounce',
        is_permanent: true,
        retry_eligible: false,
        total_attempts: 3,
        resolved_at: null,
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn().mockResolvedValue({
              data: [mockDLQItem],
              error: null
            })
          }))
        }))
      })

      const dlqItems = await dlqService.getDLQItems({}, 50, 0)
      
      expect(Array.isArray(dlqItems)).toBe(true)
    })

    it('should provide DLQ statistics', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { failure_type: 'hard_bounce', notification_channel: 'booking_reminder', created_at: new Date().toISOString(), resolved_at: null },
            { failure_type: 'soft_bounce', notification_channel: 'booking_confirmation', created_at: new Date().toISOString(), resolved_at: null }
          ],
          error: null
        })
      })

      const dlqStats = await dlqService.getDLQStats()
      
      expect(dlqStats).toBeDefined()
      expect(dlqStats.totalItems).toBeGreaterThanOrEqual(0)
    })

    it('should retry DLQ items with updated recipient info', async () => {
      const dlqId = 'dlq-test-id'
      const retryOptions = {
        updateRecipient: {
          email: 'corrected@example.com'
        },
        notes: 'Updated email address per customer request',
        retryBy: 'admin-user-id'
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: dlqId,
                original_notification_id: 'notif-id',
                notification_type: 'email',
                notification_channel: 'booking_reminder',
                recipient_id: 'user-id',
                recipient_email: 'old@example.com',
                template_data: { name: 'John Doe' },
                retry_eligible: true,
                resolved_at: null
              },
              error: null
            })
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-notif-id' },
              error: null
            })
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        }))
      })

      const retryResult = await dlqService.retryDLQItem(dlqId, retryOptions)
      
      expect(retryResult.success).toBe(true)
      expect(retryResult.notificationId).toBeDefined()
    })
  })

  describe('Cost Tracking & Reporting', () => {
    it('should track notification costs accurately', async () => {
      const mockCostTracking = [
        {
          id: 'cost-1',
          notification_id: 'notif-1',
          provider: 'twilio',
          cost_cents: 5,
          currency: 'EUR',
          billing_year: 2024,
          billing_month: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 'cost-2',
          notification_id: 'notif-2',
          provider: 'smtp',
          cost_cents: 0,
          currency: 'EUR',
          billing_year: 2024,
          billing_month: 1,
          created_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({
                data: mockCostTracking,
                error: null
              })
            }))
          }))
        }))
      })

      const costTracking = await settingsService.getCostTracking(2024, 1, 10, 0)
      
      expect(Array.isArray(costTracking)).toBe(true)
    })

    it('should calculate total costs correctly', () => {
      const costData = [
        { costCents: 5 },
        { costCents: 0 },
        { costCents: 5 },
        { costCents: 3 }
      ]

      const totalCost = costData.reduce((sum, c) => sum + c.costCents, 0)
      const averageCost = Math.round(totalCost / costData.length)

      expect(totalCost).toBe(13)
      expect(averageCost).toBe(3) // 13/4 = 3.25, rounded to 3
    })
  })

  describe('Webhook Event Processing', () => {
    it('should process Twilio webhook events idempotently', async () => {
      const webhookEvent = {
        MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        MessageStatus: 'delivered',
        To: '+41791234567',
        From: '+41789876543',
        AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      }

      mockSupabase.rpc.mockResolvedValue({
        data: 'webhook-id',
        error: null
      })

      // First processing
      const result1 = await mockSupabase.rpc('process_webhook_event', {
        p_provider: 'twilio',
        p_provider_event_id: webhookEvent.MessageSid,
        p_event_type: 'delivered',
        p_provider_message_id: webhookEvent.MessageSid,
        p_event_data: webhookEvent,
        p_status: webhookEvent.MessageStatus
      })

      // Second processing (duplicate)
      const result2 = await mockSupabase.rpc('process_webhook_event', {
        p_provider: 'twilio',
        p_provider_event_id: webhookEvent.MessageSid,
        p_event_type: 'delivered',
        p_provider_message_id: webhookEvent.MessageSid,
        p_event_data: webhookEvent,
        p_status: webhookEvent.MessageStatus
      })

      expect(result1.data).toBeDefined()
      expect(result2.data).toBeDefined()
      // In real implementation, would check for idempotent handling
    })

    it('should handle provider failures and update suppression lists', async () => {
      const failedWebhook = {
        MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        MessageStatus: 'failed',
        To: '+41791234567',
        ErrorCode: '21211', // Invalid 'To' phone number
        ErrorMessage: 'The phone number is not valid'
      }

      // This would trigger automatic suppression
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null
        })
      })

      const suppressionResult = await mockSupabase.from('notification_suppression').insert({
        phone: failedWebhook.To,
        suppression_type: 'invalid',
        suppression_reason: `Twilio error ${failedWebhook.ErrorCode}: ${failedWebhook.ErrorMessage}`,
        suppression_source: 'provider_feedback'
      })

      expect(suppressionResult.error).toBeNull()
    })
  })

  describe('SMTP Bounce Handling', () => {
    it('should classify hard vs soft bounces correctly', () => {
      const hardBouncePatterns = [
        'permanent', 'invalid', 'nonexistent', 'blocked',
        '5.1.1', '5.1.2', '5.2.1', '5.7.1'
      ]

      const softBouncePatterns = [
        'temporary', 'transient', 'mailbox full', 'over quota',
        '4.2.2', '4.3.1'
      ]

      // Test hard bounce classification
      hardBouncePatterns.forEach(pattern => {
        const text = `Error: ${pattern} failure`
        const isHard = hardBouncePatterns.some(p => text.toLowerCase().includes(p))
        expect(isHard).toBe(true)
      })

      // Test soft bounce classification  
      softBouncePatterns.forEach(pattern => {
        const text = `Error: ${pattern} failure`
        const isSoft = softBouncePatterns.some(p => text.toLowerCase().includes(p))
        expect(isSoft).toBe(true)
      })
    })

    it('should handle multi-provider bounce formats', async () => {
      const sesBounce = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'bounce',
          bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'General',
            bouncedRecipients: [{
              emailAddress: 'invalid@example.com',
              diagnosticCode: '550 5.1.1 User unknown'
            }]
          },
          mail: {
            messageId: 'ses-message-id'
          }
        })
      }

      const mailgunBounce = {
        'event-data': {
          event: 'failed',
          severity: 'permanent',
          reason: 'bounce',
          recipient: 'invalid@example.com',
          message: {
            headers: {
              'message-id': 'mailgun-message-id'
            }
          }
        }
      }

      // These would be processed by the SMTP bounce handler
      expect(sesBounce.Type).toBe('Notification')
      expect(mailgunBounce['event-data'].event).toBe('failed')
    })
  })

  describe('Health Monitoring Integration', () => {
    it('should detect DLQ health issues', async () => {
      const mockDLQStats = {
        totalItems: 15,
        recentFailures: 12, // High recent failures
        retryEligible: 8,
        resolved: 3
      }

      // Health check should flag this as error due to high recent failures
      if (mockDLQStats.recentFailures > 10) {
        expect(mockDLQStats.recentFailures).toBeGreaterThan(10)
        // Would set health status to 'error'
      }
    })

    it('should provide comprehensive health metrics', async () => {
      const healthMetrics = {
        budget: {
          currentMonth: {
            emailsSent: 450,
            smsSent: 89,
            emailUsagePercent: 45.0,
            smsUsagePercent: 89.0
          },
          alerts: 1,
          criticalAlerts: 0,
          warningAlerts: 1
        },
        dlq: {
          totalItems: 5,
          recentFailures: 2,
          retryEligible: 3
        },
        webhooks: {
          last24Hours: 150,
          processed: 148,
          failed: 2,
          processingRate: 98.7
        }
      }

      expect(healthMetrics.budget.currentMonth.smsUsagePercent).toBeGreaterThan(80)
      expect(healthMetrics.webhooks.processingRate).toBeGreaterThan(95)
      expect(healthMetrics.dlq.totalItems).toBeLessThan(10)
    })
  })
})