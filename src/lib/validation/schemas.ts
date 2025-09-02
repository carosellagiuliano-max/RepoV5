/**
 * Validation Schemas using Zod
 * These schemas validate data for API endpoints and forms
 */

import { z } from 'zod'

// Base schemas
export const uuidSchema = z.string().uuid('Invalid UUID format')
export const emailSchema = z.string().email('Invalid email format')
export const phoneSchema = z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number')
export const timeSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
export const datetimeSchema = z.string().datetime('Invalid datetime format')

// Enums
export const userRoleSchema = z.enum(['admin', 'staff', 'customer'])
export const appointmentStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
export const dayOfWeekSchema = z.number().min(0).max(6)

// Profile schemas
export const profileCreateSchema = z.object({
  email: emailSchema,
  role: userRoleSchema.optional().default('customer'),
  first_name: z.string().min(1, 'First name is required').max(50).optional(),
  last_name: z.string().min(1, 'Last name is required').max(50).optional(),
  phone: phoneSchema.optional(),
  avatar_url: z.string().url().optional(),
  is_active: z.boolean().optional().default(true)
})

export const profileUpdateSchema = z.object({
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  phone: phoneSchema.optional(),
  avatar_url: z.string().url().optional(),
  is_active: z.boolean().optional()
})

// Staff schemas
export const staffCreateSchema = z.object({
  profile_id: uuidSchema,
  specialties: z.array(z.string()).optional(),
  bio: z.string().max(1000).optional(),
  hire_date: dateSchema.optional(),
  hourly_rate: z.number().positive().optional(),
  commission_rate: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional().default(true)
})

export const staffUpdateSchema = z.object({
  specialties: z.array(z.string()).optional(),
  bio: z.string().max(1000).optional(),
  hire_date: dateSchema.optional(),
  hourly_rate: z.number().positive().optional(),
  commission_rate: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional()
})

// Customer schemas
export const customerCreateSchema = z.object({
  profile_id: uuidSchema.optional(), // Will be set if creating with existing profile
  email: emailSchema,
  full_name: z.string().min(1, 'Full name is required').max(100),
  phone: phoneSchema.optional(),
  customer_number: z.string().optional(), // Auto-generated if not provided
  date_of_birth: dateSchema.optional(),
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: phoneSchema.optional(),
  notes: z.string().max(1000).optional(),
  gdpr_consent_given: z.boolean().optional().default(false),
  gdpr_consent_date: datetimeSchema.optional()
})

export const customerUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  date_of_birth: dateSchema.optional(),
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: phoneSchema.optional(),
  notes: z.string().max(1000).optional(),
  gdpr_consent_given: z.boolean().optional()
})

export const customerSoftDeleteSchema = z.object({
  reason: z.string().max(500).optional()
})

export const customerGdprExportSchema = z.object({
  customer_id: uuidSchema
})

export const customerFiltersSchema = paginationSchema.extend({
  isDeleted: z.coerce.boolean().optional().default(false),
  hasGdprConsent: z.coerce.boolean().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  registeredAfter: dateSchema.optional(),
  registeredBefore: dateSchema.optional()
})

// Service schemas
export const serviceCreateSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100),
  description: z.string().max(1000).optional(),
  duration_minutes: z.number().positive('Duration must be positive'),
  price_cents: z.number().int().positive('Price must be positive'),
  category: z.string().max(50).optional(),
  is_active: z.boolean().optional().default(true),
  requires_consultation: z.boolean().optional().default(false)
})

export const serviceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  duration_minutes: z.number().positive().optional(),
  price_cents: z.number().int().positive().optional(),
  category: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
  requires_consultation: z.boolean().optional()
})

// Appointment schemas
export const appointmentCreateSchema = z.object({
  customer_id: uuidSchema,
  staff_id: uuidSchema,
  service_id: uuidSchema,
  start_time: datetimeSchema,
  end_time: datetimeSchema,
  status: appointmentStatusSchema.optional().default('pending'),
  notes: z.string().max(500).optional()
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  { message: 'End time must be after start time', path: ['end_time'] }
)

export const appointmentUpdateSchema = z.object({
  staff_id: uuidSchema.optional(),
  service_id: uuidSchema.optional(),
  start_time: datetimeSchema.optional(),
  end_time: datetimeSchema.optional(),
  status: appointmentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
  cancellation_reason: z.string().max(500).optional()
}).refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time)
    }
    return true
  },
  { message: 'End time must be after start time', path: ['end_time'] }
)

// Staff availability schemas
export const staffAvailabilityCreateSchema = z.object({
  staff_id: uuidSchema,
  day_of_week: dayOfWeekSchema,
  start_time: timeSchema,
  end_time: timeSchema,
  is_available: z.boolean().optional().default(true)
}).refine(
  (data) => data.start_time < data.end_time,
  { message: 'End time must be after start time', path: ['end_time'] }
)

export const staffAvailabilityUpdateSchema = z.object({
  day_of_week: dayOfWeekSchema.optional(),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  is_available: z.boolean().optional()
}).refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return data.start_time < data.end_time
    }
    return true
  },
  { message: 'End time must be after start time', path: ['end_time'] }
)

// Staff timeoff schemas
export const staffTimeoffCreateSchema = z.object({
  staff_id: uuidSchema,
  start_date: dateSchema,
  end_date: dateSchema,
  reason: z.string().max(500).optional(),
  is_approved: z.boolean().optional().default(false)
}).refine(
  (data) => data.end_date >= data.start_date,
  { message: 'End date must be after or equal to start date', path: ['end_date'] }
)

export const staffTimeoffUpdateSchema = z.object({
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  reason: z.string().max(500).optional(),
  is_approved: z.boolean().optional(),
  approved_by: uuidSchema.optional(),
  approved_at: datetimeSchema.optional()
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.end_date >= data.start_date
    }
    return true
  },
  { message: 'End date must be after or equal to start date', path: ['end_date'] }
)

// Business settings schemas
export const businessSettingCreateSchema = z.object({
  key: z.string().min(1, 'Key is required').max(100),
  value: z.string().min(1, 'Value is required'),
  description: z.string().max(500).optional()
})

export const businessSettingUpdateSchema = z.object({
  value: z.string().min(1).optional(),
  description: z.string().max(500).optional()
})

// Media file schemas
export const mediaCreateSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255),
  original_filename: z.string().min(1, 'Original filename is required').max(255),
  file_path: z.string().min(1, 'File path is required').max(1000),
  file_size: z.number().positive('File size must be positive'),
  mime_type: z.string().min(1, 'MIME type is required'),
  storage_bucket: z.string().min(1).default('salon-media'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
  is_public: z.boolean().optional().default(false)
})

export const mediaUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional()
})

export const mediaFiltersSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional().default(true),
  mime_type: z.string().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['created_at', 'title', 'filename', 'file_size']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.number().positive().optional().default(1),
  limit: z.number().positive().max(100).optional().default(20)
})

export const mediaUploadSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
  is_public: z.boolean().optional().default(false)
})

// Legacy schema compatibility (deprecated)
export const mediaFileCreateSchema = mediaCreateSchema
export const mediaFileUpdateSchema = mediaUpdateSchema

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
})

export const appointmentFiltersSchema = paginationSchema.extend({
  staffId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),
  status: appointmentStatusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  customerId: uuidSchema.optional()
})

export const staffFiltersSchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
  serviceId: uuidSchema.optional(),
  specialties: z.array(z.string()).optional()
})

export const serviceFiltersSchema = paginationSchema.extend({
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  staffId: uuidSchema.optional()
})

// Authentication schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone: phoneSchema.optional()
})

export const passwordResetSchema = z.object({
  email: emailSchema
})

export const passwordUpdateSchema = z.object({
  current_password: z.string().min(6),
  new_password: z.string().min(6, 'Password must be at least 6 characters')
})

// Bulk operation schemas
export const bulkStaffServiceAssignmentSchema = z.object({
  staff_id: uuidSchema,
  service_ids: z.array(uuidSchema).min(1, 'At least one service must be selected')
})

export const bulkAvailabilityUpdateSchema = z.object({
  staff_id: uuidSchema,
  availability: z.array(z.object({
    day_of_week: dayOfWeekSchema,
    start_time: timeSchema,
    end_time: timeSchema,
    is_available: z.boolean()
  }))
})

// API response schemas
export const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional()
})

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: apiErrorSchema.optional(),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number()
    }).optional()
  })

// Validation helper functions
export const validateBody = <T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): z.infer<T> => {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`)
  }
  return result.data
}

export const validateQuery = <T extends z.ZodTypeAny>(
  schema: T,
  query: Record<string, unknown>
): z.infer<T> => {
  const result = schema.safeParse(query)
  if (!result.success) {
    throw new Error(`Query validation error: ${result.error.message}`)
  }
  return result.data
}

// Export all schemas as a group for easier imports
export const schemas = {
  // Base schemas
  uuid: uuidSchema,
  email: emailSchema,
  phone: phoneSchema,
  time: timeSchema,
  date: dateSchema,
  datetime: datetimeSchema,
  userRole: userRoleSchema,
  appointmentStatus: appointmentStatusSchema,
  dayOfWeek: dayOfWeekSchema,
  
  // Entity schemas
  profile: {
    create: profileCreateSchema,
    update: profileUpdateSchema
  },
  staff: {
    create: staffCreateSchema,
    update: staffUpdateSchema
  },
  customer: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
    softDelete: customerSoftDeleteSchema,
    gdprExport: customerGdprExportSchema
  },
  service: {
    create: serviceCreateSchema,
    update: serviceUpdateSchema
  },
  appointment: {
    create: appointmentCreateSchema,
    update: appointmentUpdateSchema
  },
  staffAvailability: {
    create: staffAvailabilityCreateSchema,
    update: staffAvailabilityUpdateSchema
  },
  staffTimeoff: {
    create: staffTimeoffCreateSchema,
    update: staffTimeoffUpdateSchema
  },
  businessSetting: {
    create: businessSettingCreateSchema,
    update: businessSettingUpdateSchema
  },
  media: {
    create: mediaCreateSchema,
    update: mediaUpdateSchema,
    upload: mediaUploadSchema
  },
  mediaFile: {
    create: mediaFileCreateSchema,
    update: mediaFileUpdateSchema
  },
  
  // Query schemas
  pagination: paginationSchema,
  appointmentFilters: appointmentFiltersSchema,
  staffFilters: staffFiltersSchema,
  serviceFilters: serviceFiltersSchema,
  customerFilters: customerFiltersSchema,
  mediaFilters: mediaFiltersSchema,
  
  // Auth schemas
  login: loginSchema,
  signup: signupSchema,
  passwordReset: passwordResetSchema,
  passwordUpdate: passwordUpdateSchema,
  
  // Bulk operations
  bulkStaffServiceAssignment: bulkStaffServiceAssignmentSchema,
  bulkAvailabilityUpdate: bulkAvailabilityUpdateSchema,
  
  // API response
  apiError: apiErrorSchema,
  apiResponse: apiResponseSchema
}

// Business Settings Validation Schemas
export const businessHoursSchema = z.object({
  monday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  tuesday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  wednesday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  thursday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  friday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  saturday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  }),
  sunday: z.object({
    open: timeSchema,
    close: timeSchema,
    closed: z.boolean()
  })
}).refine((data) => {
  // Validate that open time is before close time for non-closed days
  for (const [day, hours] of Object.entries(data)) {
    if (!hours.closed) {
      const openTime = new Date(`2000-01-01T${hours.open}:00`);
      const closeTime = new Date(`2000-01-01T${hours.close}:00`);
      if (openTime >= closeTime) {
        return false;
      }
    }
  }
  return true;
}, {
  message: "Opening time must be before closing time for open days"
})

export const smtpConfigSchema = z.object({
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.number().int().min(1).max(65535, 'Invalid SMTP port'),
  smtp_user: z.string().min(1, 'SMTP username is required'),
  smtp_password: z.string().min(1, 'SMTP password is required'),
  smtp_from_email: emailSchema,
  smtp_from_name: z.string().min(1, 'From name is required'),
  smtp_use_tls: z.boolean()
})

export const settingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.any(), // JSONB can be any type
  description: z.string().optional(),
  category: z.enum(['business_hours', 'booking', 'email', 'business_info', 'notifications', 'general']).optional(),
  is_public: z.boolean().optional()
})

export const settingUpdateSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
  category: z.enum(['business_hours', 'booking', 'email', 'business_info', 'notifications', 'general']).optional(),
  is_public: z.boolean().optional()
})

export const businessInfoSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  business_address: z.string().min(1, 'Business address is required'),
  business_phone: phoneSchema,
  business_email: emailSchema
})

export const bookingConfigSchema = z.object({
  booking_window_days: z.number().int().min(1).max(365, 'Booking window must be between 1-365 days'),
  buffer_time_minutes: z.number().int().min(0).max(120, 'Buffer time must be between 0-120 minutes'),
  min_advance_booking_hours: z.number().int().min(0).max(168, 'Minimum advance booking must be between 0-168 hours'),
  max_appointments_per_day: z.number().int().min(1).max(200, 'Max appointments per day must be between 1-200'),
  cancellation_hours: z.number().int().min(0).max(168, 'Cancellation hours must be between 0-168'),
  no_show_policy: z.string().min(1, 'No-show policy is required')
})

export const notificationConfigSchema = z.object({
  email_notifications_enabled: z.boolean(),
  sms_notifications_enabled: z.boolean(),
  booking_confirmation_email: z.boolean(),
  booking_reminder_email: z.boolean(),
  reminder_hours_before: z.number().int().min(1).max(168, 'Reminder hours must be between 1-168')
})

export const smtpTestSchema = z.object({
  to_email: emailSchema,
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(1000)
})