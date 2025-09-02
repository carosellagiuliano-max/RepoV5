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
export const mediaFileCreateSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  original_name: z.string().min(1, 'Original name is required'),
  file_path: z.string().min(1, 'File path is required'),
  file_size: z.number().positive('File size must be positive'),
  mime_type: z.string().min(1, 'MIME type is required'),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  uploaded_by: uuidSchema,
  is_public: z.boolean().optional().default(false)
})

export const mediaFileUpdateSchema = z.object({
  filename: z.string().min(1).optional(),
  original_name: z.string().min(1).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional()
})

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