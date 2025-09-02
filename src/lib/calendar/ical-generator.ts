/**
 * iCal Feed Generator
 * Generates RFC 5545 compliant iCal feeds from appointment data
 */

import { ICalEvent, ICalFeedConfig, StaffCalendarData } from './types'

/**
 * Escapes text for iCal format according to RFC 5545
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Formats a date for iCal DATETIME format
 */
function formatICalDateTime(date: string): string {
  const d = new Date(date)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Formats a date for iCal DTSTAMP format (always UTC)
 */
function formatICalDTStamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Generates a unique identifier for calendar events
 */
function generateUID(appointmentId: string, domain: string = 'schnittwerk-your-style.de'): string {
  return `appointment-${appointmentId}@${domain}`
}

/**
 * Maps appointment status to iCal status
 */
function mapAppointmentStatus(status: string): 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED' {
  switch (status) {
    case 'pending':
      return 'TENTATIVE'
    case 'confirmed':
    case 'completed':
      return 'CONFIRMED'
    case 'cancelled':
    case 'no_show':
      return 'CANCELLED'
    default:
      return 'TENTATIVE'
  }
}

/**
 * Converts appointment data to iCal event
 */
function appointmentToICalEvent(appointment: StaffCalendarData['appointments'][0], staffData: StaffCalendarData['staff']): ICalEvent {
  const customerName = `${appointment.customer.first_name} ${appointment.customer.last_name}`.trim()
  const serviceName = appointment.service.name
  
  const summary = `${serviceName} - ${customerName}`
  const description = [
    `Service: ${serviceName}`,
    `Duration: ${appointment.service.duration_minutes} minutes`,
    `Customer: ${customerName}`,
    `Email: ${appointment.customer.email}`,
    appointment.notes ? `Notes: ${appointment.notes}` : null
  ].filter(Boolean).join('\\n')

  return {
    uid: generateUID(appointment.id),
    summary: escapeICalText(summary),
    description: escapeICalText(description),
    start: appointment.start_time,
    end: appointment.end_time,
    location: process.env.VITE_BUSINESS_ADDRESS || '',
    organizer: {
      name: `${staffData.first_name} ${staffData.last_name}`,
      email: staffData.email
    },
    attendee: {
      name: customerName,
      email: appointment.customer.email
    },
    status: mapAppointmentStatus(appointment.status),
    created: appointment.start_time, // Use start_time as created for simplicity
    lastModified: appointment.start_time
  }
}

/**
 * Generates a complete iCal feed from staff calendar data
 */
export function generateICalFeed(data: StaffCalendarData, config?: Partial<ICalFeedConfig>): string {
  const defaultConfig: ICalFeedConfig = {
    title: `${data.staff.first_name} ${data.staff.last_name} - Appointments`,
    description: `Appointment schedule for ${data.staff.first_name} ${data.staff.last_name}`,
    timezone: 'Europe/Berlin',
    refreshInterval: 60 // 1 hour
  }

  const feedConfig = { ...defaultConfig, ...config }
  
  const events = data.appointments
    .filter(apt => apt.status !== 'cancelled') // Exclude cancelled appointments
    .map(apt => appointmentToICalEvent(apt, data.staff))

  const lines: string[] = []

  // Calendar header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Schnittwerk Your Style//Appointment Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${escapeICalText(feedConfig.title)}`)
  lines.push(`X-WR-CALDESC:${escapeICalText(feedConfig.description)}`)
  lines.push(`X-WR-TIMEZONE:${feedConfig.timezone}`)
  lines.push(`X-PUBLISHED-TTL:PT${feedConfig.refreshInterval}M`)
  lines.push(`X-WR-RELCALID:staff-${data.staff.id}`)

  // Timezone definition
  lines.push('BEGIN:VTIMEZONE')
  lines.push(`TZID:${feedConfig.timezone}`)
  lines.push('BEGIN:STANDARD')
  lines.push('DTSTART:20221030T030000')
  lines.push('TZOFFSETFROM:+0200')
  lines.push('TZOFFSETTO:+0100')
  lines.push('TZNAME:CET')
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU')
  lines.push('END:STANDARD')
  lines.push('BEGIN:DAYLIGHT')
  lines.push('DTSTART:20220327T020000')
  lines.push('TZOFFSETFROM:+0100')
  lines.push('TZOFFSETTO:+0200')
  lines.push('TZNAME:CEST')
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU')
  lines.push('END:DAYLIGHT')
  lines.push('END:VTIMEZONE')

  // Events
  events.forEach(event => {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.uid}`)
    lines.push(`DTSTAMP:${formatICalDTStamp()}`)
    lines.push(`DTSTART;TZID=${feedConfig.timezone}:${formatICalDateTime(event.start)}`)
    lines.push(`DTEND;TZID=${feedConfig.timezone}:${formatICalDateTime(event.end)}`)
    lines.push(`SUMMARY:${event.summary}`)
    
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description}`)
    }
    
    if (event.location) {
      lines.push(`LOCATION:${escapeICalText(event.location)}`)
    }
    
    if (event.organizer) {
      lines.push(`ORGANIZER;CN=${escapeICalText(event.organizer.name)}:mailto:${event.organizer.email}`)
    }
    
    if (event.attendee) {
      lines.push(`ATTENDEE;CN=${escapeICalText(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${event.attendee.email}`)
    }
    
    lines.push(`STATUS:${event.status}`)
    lines.push(`CREATED:${formatICalDateTime(event.created)}`)
    lines.push(`LAST-MODIFIED:${formatICalDateTime(event.lastModified)}`)
    lines.push('TRANSP:OPAQUE')
    lines.push('SEQUENCE:0')
    lines.push('END:VEVENT')
  })

  // Calendar footer
  lines.push('END:VCALENDAR')

  // Join with CRLF as per RFC 5545
  return lines.join('\r\n')
}

/**
 * Generates a minimal iCal feed for testing
 */
export function generateTestICalFeed(): string {
  const testData: StaffCalendarData = {
    staff: {
      id: 'test-staff-id',
      profile_id: 'test-profile-id',
      first_name: 'Test',
      last_name: 'Staff',
      email: 'test@example.com'
    },
    appointments: [
      {
        id: 'test-appointment-1',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
        status: 'confirmed',
        notes: 'Test appointment',
        service: {
          name: 'Haircut',
          duration_minutes: 60
        },
        customer: {
          first_name: 'Test',
          last_name: 'Customer',
          email: 'customer@example.com'
        }
      }
    ]
  }

  return generateICalFeed(testData)
}

/**
 * Validates that an iCal feed is properly formatted
 */
export function validateICalFeed(icalData: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Basic structure validation
  if (!icalData.startsWith('BEGIN:VCALENDAR')) {
    errors.push('Feed must start with BEGIN:VCALENDAR')
  }
  
  if (!icalData.endsWith('END:VCALENDAR')) {
    errors.push('Feed must end with END:VCALENDAR')
  }
  
  // Check for required properties
  const requiredProps = ['VERSION:2.0', 'PRODID:', 'CALSCALE:GREGORIAN']
  requiredProps.forEach(prop => {
    if (!icalData.includes(prop)) {
      errors.push(`Missing required property: ${prop}`)
    }
  })
  
  // Check line endings
  if (icalData.includes('\n') && !icalData.includes('\r\n')) {
    errors.push('Lines should end with CRLF (\\r\\n) as per RFC 5545')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}