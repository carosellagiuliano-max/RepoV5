/**
 * Template rendering utilities
 * Handles variable replacement in notification templates
 */

interface TemplateVariables {
  [key: string]: unknown
}

interface BusinessInfo {
  name: string
  address: string
  phone: string
  email: string
  website?: string
}

interface AppointmentInfo {
  id: string
  date: string
  time: string
  service_name: string
  staff_name: string
  customer_name: string
  customer_phone?: string
  notes?: string
  price?: number
  cancellation_reason?: string
}

interface StaffSchedule {
  staff_name: string
  date: string
  appointments: AppointmentInfo[]
}

export class TemplateRenderer {
  private businessInfo: BusinessInfo

  constructor() {
    // Get business info from environment variables
    this.businessInfo = {
      name: process.env.VITE_BUSINESS_NAME || 'Salon',
      address: process.env.VITE_BUSINESS_ADDRESS || '',
      phone: process.env.VITE_BUSINESS_PHONE || '',
      email: process.env.VITE_BUSINESS_EMAIL || '',
      website: process.env.VITE_SITE_URL || ''
    }
  }

  /**
   * Render a template with variables using simple mustache-like syntax
   */
  render(template: string, variables: TemplateVariables): string {
    let rendered = template

    // Replace simple variables: {{variable_name}}
    rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const value = this.getNestedValue(variables, variableName.trim())
      return value !== undefined ? String(value) : ''
    })

    // Handle conditional blocks: {{#condition}}content{{/condition}}
    rendered = rendered.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(variables, condition.trim())
      return this.isTruthy(value) ? content : ''
    })

    // Handle negative conditional blocks: {{^condition}}content{{/condition}}
    rendered = rendered.replace(/\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(variables, condition.trim())
      return !this.isTruthy(value) ? content : ''
    })

    return rendered.trim()
  }

  /**
   * Create variables for appointment reminder templates
   */
  createReminderVariables(appointment: AppointmentInfo): TemplateVariables {
    const appointmentDate = new Date(appointment.date)
    
    return {
      ...this.businessInfo,
      business_name: this.businessInfo.name,
      business_address: this.businessInfo.address,
      business_phone: this.businessInfo.phone,
      business_email: this.businessInfo.email,
      website_url: this.businessInfo.website,
      
      customer_name: appointment.customer_name,
      appointment_date: this.formatDate(appointmentDate),
      appointment_time: appointment.time,
      service_name: appointment.service_name,
      staff_name: appointment.staff_name,
      notes: appointment.notes,
      price: appointment.price ? this.formatPrice(appointment.price) : undefined
    }
  }

  /**
   * Create variables for cancellation templates
   */
  createCancellationVariables(appointment: AppointmentInfo): TemplateVariables {
    const reminderVars = this.createReminderVariables(appointment)
    
    return {
      ...reminderVars,
      cancellation_reason: appointment.cancellation_reason
    }
  }

  /**
   * Create variables for daily schedule templates
   */
  createDailyScheduleVariables(schedule: StaffSchedule): TemplateVariables {
    const scheduleDate = new Date(schedule.date)
    
    return {
      ...this.businessInfo,
      business_name: this.businessInfo.name,
      
      staff_name: schedule.staff_name,
      date: this.formatDate(scheduleDate),
      appointments: schedule.appointments.map(apt => ({
        time: apt.time,
        service_name: apt.service_name,
        customer_name: apt.customer_name,
        customer_phone: apt.customer_phone,
        notes: apt.notes
      }))
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' && current !== null && key in current 
        ? (current as Record<string, unknown>)[key] 
        : undefined
    }, obj)
  }

  private isTruthy(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return !!value
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  private formatPrice(priceInCents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(priceInCents / 100)
  }
}

export const templateRenderer = new TemplateRenderer()