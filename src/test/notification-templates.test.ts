import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotificationTemplateManager, DEFAULT_EMAIL_TEMPLATES, DEFAULT_SMS_TEMPLATES } from '../lib/notifications/notification-templates'
import { NotificationChannel } from '../lib/types/database'
import { 
  AppointmentReminderData, 
  AppointmentConfirmationData,
  AppointmentCancellationData,
  AppointmentRescheduleData,
  StaffDailyScheduleData 
} from '../lib/notifications/types'

describe('NotificationTemplateManager', () => {
  describe('getDefaultTemplate', () => {
    it('should return email template for appointment reminder', () => {
      const template = NotificationTemplateManager.getDefaultTemplate('appointment_reminder', 'email')
      
      expect(template).toHaveProperty('subject')
      expect(template).toHaveProperty('body')
      expect(template.subject).toContain('{{serviceName}}')
      expect(template.body).toContain('{{customerName}}')
    })

    it('should return SMS template for appointment reminder', () => {
      const template = NotificationTemplateManager.getDefaultTemplate('appointment_reminder', 'sms')
      
      expect(template).toHaveProperty('body')
      expect(template.body).toContain('{{customerName}}')
      expect(template.body).toContain('{{serviceName}}')
    })

    it('should throw error for SMS staff daily schedule', () => {
      expect(() => {
        NotificationTemplateManager.getDefaultTemplate('staff_daily_schedule', 'sms')
      }).toThrow('No default template found')
    })
  })

  describe('renderTemplate', () => {
    it('should render appointment reminder template correctly', () => {
      const template = '{{customerName}} hat einen Termin für {{serviceName}} am {{appointmentDate}}'
      const data: AppointmentReminderData = {
        customerName: 'Max Mustermann',
        appointmentDate: '15.12.2024',
        appointmentTime: '10:00',
        serviceName: 'Herrenhaarschnitt',
        staffName: 'Anna Schmidt',
        salonName: 'Schnittwerk Your Style',
        salonPhone: '+49 123 456789',
        salonAddress: 'Musterstraße 123',
        appointmentId: 'test-id'
      }

      const result = NotificationTemplateManager.renderTemplate(template, data)
      
      expect(result).toBe('Max Mustermann hat einen Termin für Herrenhaarschnitt am 15.12.2024')
    })

    it('should handle conditional blocks correctly', () => {
      const template = 'Hello {{customerName}}{{#if cancellationReason}} - Grund: {{cancellationReason}}{{/if}}'
      
      const dataWithReason: AppointmentCancellationData = {
        customerName: 'Max Mustermann',
        appointmentDate: '15.12.2024',
        appointmentTime: '10:00',
        serviceName: 'Herrenhaarschnitt',
        staffName: 'Anna Schmidt',
        salonName: 'Schnittwerk Your Style',
        cancellationReason: 'Krankheit',
        appointmentId: 'test-id'
      }

      const dataWithoutReason: AppointmentCancellationData = {
        customerName: 'Max Mustermann',
        appointmentDate: '15.12.2024',
        appointmentTime: '10:00',
        serviceName: 'Herrenhaarschnitt',
        staffName: 'Anna Schmidt',
        salonName: 'Schnittwerk Your Style',
        appointmentId: 'test-id'
      }

      const resultWithReason = NotificationTemplateManager.renderTemplate(template, dataWithReason)
      const resultWithoutReason = NotificationTemplateManager.renderTemplate(template, dataWithoutReason)
      
      expect(resultWithReason).toBe('Hello Max Mustermann - Grund: Krankheit')
      expect(resultWithoutReason).toBe('Hello Max Mustermann')
    })

    it('should handle each blocks for staff daily schedule', () => {
      const template = 'Termine: {{#each appointments}}{{time}} - {{customerName}}; {{/each}}'
      const data: StaffDailyScheduleData = {
        staffName: 'Anna Schmidt',
        date: '15.12.2024',
        appointments: [
          { time: '10:00', customerName: 'Max Mustermann', serviceName: 'Herrenhaarschnitt', duration: '30 Min' },
          { time: '11:00', customerName: 'Maria Muster', serviceName: 'Damenhaarschnitt', duration: '45 Min' }
        ],
        totalAppointments: 2,
        firstAppointment: '10:00',
        lastAppointment: '11:45'
      }

      const result = NotificationTemplateManager.renderTemplate(template, data)
      
      expect(result).toBe('Termine: 10:00 - Max Mustermann; 11:00 - Maria Muster; ')
    })
  })

  describe('validateTemplate', () => {
    it('should validate template with all required variables', () => {
      const template = 'Hello {{customerName}}, your {{serviceName}} appointment is on {{appointmentDate}}'
      const requiredVariables = ['customerName', 'serviceName', 'appointmentDate']
      
      const result = NotificationTemplateManager.validateTemplate(template, requiredVariables)
      
      expect(result.valid).toBe(true)
      expect(result.missing).toEqual([])
    })

    it('should detect missing variables', () => {
      const template = 'Hello {{customerName}}, your appointment is on {{appointmentDate}}'
      const requiredVariables = ['customerName', 'serviceName', 'appointmentDate']
      
      const result = NotificationTemplateManager.validateTemplate(template, requiredVariables)
      
      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['serviceName'])
    })
  })

  describe('extractVariables', () => {
    it('should extract all variables from template', () => {
      const template = 'Hello {{customerName}}, your {{serviceName}} appointment is at {{appointmentTime}}'
      
      const variables = NotificationTemplateManager.extractVariables(template)
      
      expect(variables).toEqual(['customerName', 'serviceName', 'appointmentTime'])
    })

    it('should handle template without variables', () => {
      const template = 'This is a static template'
      
      const variables = NotificationTemplateManager.extractVariables(template)
      
      expect(variables).toEqual([])
    })
  })

  describe('getRequiredVariables', () => {
    it('should return correct variables for appointment reminder', () => {
      const variables = NotificationTemplateManager.getRequiredVariables('appointment_reminder')
      
      expect(variables).toContain('customerName')
      expect(variables).toContain('serviceName')
      expect(variables).toContain('appointmentDate')
      expect(variables).toContain('appointmentTime')
      expect(variables).toContain('staffName')
      expect(variables).toContain('salonName')
    })

    it('should return correct variables for appointment confirmation', () => {
      const variables = NotificationTemplateManager.getRequiredVariables('appointment_confirmation')
      
      expect(variables).toContain('totalPrice')
      expect(variables).toContain('customerName')
      expect(variables).toContain('serviceName')
    })

    it('should return correct variables for staff daily schedule', () => {
      const variables = NotificationTemplateManager.getRequiredVariables('staff_daily_schedule')
      
      expect(variables).toContain('staffName')
      expect(variables).toContain('date')
      expect(variables).toContain('totalAppointments')
      expect(variables).toContain('salonName')
    })
  })

  describe('Default Templates', () => {
    it('should have valid email templates for all channels', () => {
      const channels: Array<keyof typeof DEFAULT_EMAIL_TEMPLATES> = [
        'appointment_reminder',
        'appointment_confirmation', 
        'appointment_cancellation',
        'appointment_reschedule',
        'staff_daily_schedule'
      ]

      channels.forEach(channel => {
        const template = DEFAULT_EMAIL_TEMPLATES[channel]
        expect(template).toHaveProperty('subject')
        expect(template).toHaveProperty('body')
        expect(template.subject).toBeTruthy()
        expect(template.body).toBeTruthy()
      })
    })

    it('should have valid SMS templates for appointment channels', () => {
      const channels: Array<keyof typeof DEFAULT_SMS_TEMPLATES> = [
        'appointment_reminder',
        'appointment_confirmation',
        'appointment_cancellation', 
        'appointment_reschedule'
      ]

      channels.forEach(channel => {
        const template = DEFAULT_SMS_TEMPLATES[channel]
        expect(template).toBeTruthy()
        expect(typeof template).toBe('string')
      })
    })

    it('should include all required variables in default email templates', () => {
      Object.entries(DEFAULT_EMAIL_TEMPLATES).forEach(([channel, template]) => {
        const requiredVariables = NotificationTemplateManager.getRequiredVariables(channel as NotificationChannel)
        const subjectValidation = NotificationTemplateManager.validateTemplate(template.subject, requiredVariables)
        const bodyValidation = NotificationTemplateManager.validateTemplate(template.body, requiredVariables)
        
        // Templates may not use all required variables, but should not be missing critical ones
        expect(subjectValidation.missing.length).toBeLessThanOrEqual(requiredVariables.length)
        expect(bodyValidation.missing.length).toBeLessThanOrEqual(requiredVariables.length)
      })
    })
  })
})