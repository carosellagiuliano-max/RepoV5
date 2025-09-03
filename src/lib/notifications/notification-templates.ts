import { NotificationTemplate, NotificationChannel, NotificationType } from '../types/database'
import { 
  NotificationTemplateData, 
  AppointmentReminderData,
  AppointmentConfirmationData, 
  AppointmentCancellationData,
  AppointmentRescheduleData,
  StaffDailyScheduleData,
  TemplateError
} from './types'

// Default email templates
export const DEFAULT_EMAIL_TEMPLATES: Record<NotificationChannel, { subject: string; body: string }> = {
  appointment_reminder: {
    subject: 'Terminerinnerung - {{serviceName}} bei {{salonName}}',
    body: `
      <h2>Hallo {{customerName}},</h2>
      
      <p>wir möchten Sie daran erinnern, dass Sie morgen einen Termin bei uns haben:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Ihre Termindetails:</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Datum:</strong> {{appointmentDate}}</p>
        <p><strong>Uhrzeit:</strong> {{appointmentTime}}</p>
        <p><strong>Ihr Stylist:</strong> {{staffName}}</p>
      </div>
      
      <p>Falls Sie Ihren Termin nicht wahrnehmen können, sagen Sie bitte mindestens 24 Stunden vorher ab.</p>
      
      <p>Wir freuen uns auf Sie!</p>
      
      <hr>
      <p><strong>{{salonName}}</strong><br>
      {{salonAddress}}<br>
      Tel: {{salonPhone}}</p>
    `
  },
  appointment_confirmation: {
    subject: 'Terminbestätigung - {{serviceName}} bei {{salonName}}',
    body: `
      <h2>Hallo {{customerName}},</h2>
      
      <p>vielen Dank für Ihre Buchung! Hiermit bestätigen wir Ihren Termin:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Ihre Termindetails:</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Datum:</strong> {{appointmentDate}}</p>
        <p><strong>Uhrzeit:</strong> {{appointmentTime}}</p>
        <p><strong>Ihr Stylist:</strong> {{staffName}}</p>
        <p><strong>Preis:</strong> {{totalPrice}}</p>
      </div>
      
      <p>Falls Sie Ihren Termin nicht wahrnehmen können, sagen Sie bitte mindestens 24 Stunden vorher ab.</p>
      
      <p>Wir freuen uns auf Sie!</p>
      
      <hr>
      <p><strong>{{salonName}}</strong><br>
      {{salonAddress}}<br>
      Tel: {{salonPhone}}</p>
    `
  },
  appointment_cancellation: {
    subject: 'Terminabsage - {{serviceName}} bei {{salonName}}',
    body: `
      <h2>Hallo {{customerName}},</h2>
      
      <p>Ihr Termin wurde erfolgreich storniert:</p>
      
      <div style="background-color: #ffe6e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Stornierter Termin:</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Datum:</strong> {{appointmentDate}}</p>
        <p><strong>Uhrzeit:</strong> {{appointmentTime}}</p>
        <p><strong>Stylist:</strong> {{staffName}}</p>
        {{#if cancellationReason}}<p><strong>Grund:</strong> {{cancellationReason}}</p>{{/if}}
      </div>
      
      <p>Gerne können Sie einen neuen Termin über unsere Website oder telefonisch vereinbaren.</p>
      
      <p>Vielen Dank für Ihr Verständnis!</p>
      
      <hr>
      <p><strong>{{salonName}}</strong><br>
      {{salonAddress}}<br>
      Tel: {{salonPhone}}</p>
    `
  },
  appointment_reschedule: {
    subject: 'Terminänderung - {{serviceName}} bei {{salonName}}',
    body: `
      <h2>Hallo {{customerName}},</h2>
      
      <p>Ihr Termin wurde erfolgreich verschoben:</p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Alter Termin:</h3>
        <p><strong>Datum:</strong> {{oldAppointmentDate}}</p>
        <p><strong>Uhrzeit:</strong> {{oldAppointmentTime}}</p>
      </div>
      
      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Neuer Termin:</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Datum:</strong> {{newAppointmentDate}}</p>
        <p><strong>Uhrzeit:</strong> {{newAppointmentTime}}</p>
        <p><strong>Ihr Stylist:</strong> {{staffName}}</p>
      </div>
      
      <p>Wir freuen uns auf Sie zu Ihrem neuen Termin!</p>
      
      <hr>
      <p><strong>{{salonName}}</strong><br>
      {{salonAddress}}<br>
      Tel: {{salonPhone}}</p>
    `
  },
  staff_daily_schedule: {
    subject: 'Tagesplan für {{date}} - {{salonName}}',
    body: `
      <h2>Guten Morgen {{staffName}},</h2>
      
      <p>hier ist Ihr Tagesplan für heute ({{date}}):</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Termine heute:</h3>
        <p><strong>Anzahl Termine:</strong> {{totalAppointments}}</p>
        {{#if firstAppointment}}<p><strong>Erster Termin:</strong> {{firstAppointment}}</p>{{/if}}
        {{#if lastAppointment}}<p><strong>Letzter Termin:</strong> {{lastAppointment}}</p>{{/if}}
        
        {{#if appointments.length}}
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Zeit</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Kunde</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Service</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Dauer</th>
            </tr>
          </thead>
          <tbody>
            {{#each appointments}}
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">{{time}}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{{customerName}}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{{serviceName}}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{{duration}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
        {{/if}}
      </div>
      
      <p>Einen erfolgreichen Tag!</p>
      
      <hr>
      <p><strong>{{salonName}}</strong></p>
    `
  }
}

// Default SMS templates
export const DEFAULT_SMS_TEMPLATES: Record<Exclude<NotificationChannel, 'staff_daily_schedule'>, string> = {
  appointment_reminder: 'Hallo {{customerName}}! Terminerinnerung: {{serviceName}} morgen um {{appointmentTime}} bei {{salonName}}. Bei Absage bitte 24h vorher. Tel: {{salonPhone}}',
  appointment_confirmation: 'Hallo {{customerName}}! Ihr Termin ist bestätigt: {{serviceName}} am {{appointmentDate}} um {{appointmentTime}} bei {{salonName}}. Preis: {{totalPrice}}',
  appointment_cancellation: 'Hallo {{customerName}}! Ihr Termin am {{appointmentDate}} um {{appointmentTime}} wurde storniert. Neuer Termin: {{salonPhone}} - {{salonName}}',
  appointment_reschedule: 'Hallo {{customerName}}! Terminänderung: {{serviceName}} von {{oldAppointmentDate}} {{oldAppointmentTime}} zu {{newAppointmentDate}} {{newAppointmentTime}} - {{salonName}}'
}

/**
 * Simple template engine that replaces {{variable}} placeholders
 */
class TemplateEngine {
  /**
   * Render a template with the given data
   */
  static render(template: string, data: Record<string, unknown>): string {
    let result = template
    
    // Handle each blocks first {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, key, content) => {
      const array = data[key] as unknown[]
      if (!Array.isArray(array)) return ''
      
      return array.map(item => {
        // Render the content with the combined context (parent data + current item)
        let itemContent = content
        
        // Replace item properties first
        if (typeof item === 'object' && item !== null) {
          Object.entries(item).forEach(([itemKey, itemValue]) => {
            const regex = new RegExp(`\\{\\{${itemKey}\\}\\}`, 'g')
            itemContent = itemContent.replace(regex, String(itemValue || ''))
          })
        }
        
        // Then replace parent data properties that weren't replaced by item properties
        Object.entries(data).forEach(([dataKey, dataValue]) => {
          if (dataKey !== key) { // Don't replace the array itself
            const regex = new RegExp(`\\{\\{${dataKey}\\}\\}`, 'g')
            itemContent = itemContent.replace(regex, String(dataValue || ''))
          }
        })
        
        return itemContent
      }).join('')
    })
    
    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, key, content) => {
      return data[key] ? content : ''
    })
    
    // Replace simple variables {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || ''
    })
    
    return result
  }
}

/**
 * Notification template manager
 */
export class NotificationTemplateManager {
  /**
   * Get default template for a channel and type
   */
  static getDefaultTemplate(channel: NotificationChannel, type: NotificationType): { subject?: string; body: string } {
    if (type === 'email') {
      return DEFAULT_EMAIL_TEMPLATES[channel]
    } else if (type === 'sms' && channel !== 'staff_daily_schedule') {
      return {
        body: DEFAULT_SMS_TEMPLATES[channel as Exclude<NotificationChannel, 'staff_daily_schedule'>]
      }
    }
    throw new TemplateError(`No default template found for channel ${channel} and type ${type}`)
  }
  
  /**
   * Render a template with data
   */
  static renderTemplate(
    template: string, 
    data: NotificationTemplateData
  ): string {
    try {
      return TemplateEngine.render(template, data as Record<string, unknown>)
    } catch (error) {
      throw new TemplateError(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Validate template variables
   */
  static validateTemplate(template: string, requiredVariables: string[]): { valid: boolean; missing: string[] } {
    const usedVariables = this.extractVariables(template)
    const missing = requiredVariables.filter(variable => !usedVariables.includes(variable))
    
    return {
      valid: missing.length === 0,
      missing
    }
  }
  
  /**
   * Extract variables from template
   */
  static extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || []
    return matches.map(match => match.replace(/\{\{(\w+)\}\}/, '$1'))
  }
  
  /**
   * Get required variables for a notification channel
   */
  static getRequiredVariables(channel: NotificationChannel): string[] {
    switch (channel) {
      case 'appointment_reminder':
        return ['customerName', 'serviceName', 'appointmentDate', 'appointmentTime', 'staffName', 'salonName', 'salonPhone', 'salonAddress']
      case 'appointment_confirmation':
        return ['customerName', 'serviceName', 'appointmentDate', 'appointmentTime', 'staffName', 'salonName', 'salonPhone', 'salonAddress', 'totalPrice']
      case 'appointment_cancellation':
        return ['customerName', 'serviceName', 'appointmentDate', 'appointmentTime', 'staffName', 'salonName']
      case 'appointment_reschedule':
        return ['customerName', 'serviceName', 'oldAppointmentDate', 'oldAppointmentTime', 'newAppointmentDate', 'newAppointmentTime', 'staffName', 'salonName']
      case 'staff_daily_schedule':
        return ['staffName', 'date', 'totalAppointments', 'salonName']
      default:
        return []
    }
  }
}