/**
 * Security Configuration
 * Centralized security settings and constants
 */

// Rate limiting configuration per role
export const RATE_LIMITS = {
  customer: {
    maxRequests: parseInt(process.env.SECURITY_RATE_LIMIT_CUSTOMER_MAX || '10'),
    windowSeconds: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW_SECONDS || '60')
  },
  staff: {
    maxRequests: parseInt(process.env.SECURITY_RATE_LIMIT_STAFF_MAX || '50'),
    windowSeconds: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW_SECONDS || '60')
  },
  admin: {
    maxRequests: parseInt(process.env.SECURITY_RATE_LIMIT_ADMIN_MAX || '100'),
    windowSeconds: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW_SECONDS || '60')
  },
  anonymous: {
    maxRequests: parseInt(process.env.SECURITY_RATE_LIMIT_ANONYMOUS_MAX || '5'),
    windowSeconds: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW_SECONDS || '60')
  }
} as const

// Idempotency configuration
export const IDEMPOTENCY_CONFIG = {
  expirationHours: parseInt(process.env.SECURITY_IDEMPOTENCY_EXPIRATION_HOURS || '24'),
  keyHeader: 'idempotency-key',
  enabledForMethods: ['POST', 'PUT'] as const
} as const

// Audit logging configuration
export const AUDIT_CONFIG = {
  enabled: process.env.SECURITY_AUDIT_LOG_ENABLED !== 'false',
  retentionDays: parseInt(process.env.VITE_AUDIT_LOG_RETENTION_DAYS || '3650'),
  logRequestBodies: true,
  logResponseBodies: false, // Avoid logging sensitive response data
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'credit_card',
    'ssn',
    'tax_id'
  ] as const
} as const

// Data retention configuration
export const DATA_RETENTION_CONFIG = {
  enabled: process.env.DATA_RETENTION_CLEANUP_ENABLED !== 'false',
  cleanupHour: parseInt(process.env.DATA_RETENTION_CLEANUP_HOUR || '2'),
  manualReviewRequired: process.env.DATA_RETENTION_MANUAL_REVIEW_REQUIRED !== 'false',
  retentionPolicies: {
    audit_logs: {
      days: parseInt(process.env.VITE_AUDIT_LOG_RETENTION_DAYS || '3650'),
      autoDelete: true
    },
    customer_data: {
      days: parseInt(process.env.VITE_GDPR_RETENTION_DAYS || '2555'),
      autoDelete: false // Requires manual review
    },
    appointments: {
      days: parseInt(process.env.VITE_GDPR_RETENTION_DAYS || '2555'),
      autoDelete: false // Business records
    },
    idempotency_keys: {
      days: 30,
      autoDelete: true
    },
    rate_limits: {
      days: 7,
      autoDelete: true
    }
  } as const
} as const

// Security features flags
export const SECURITY_FEATURES = {
  correlationIdEnabled: process.env.SECURITY_CORRELATION_ID_ENABLED !== 'false',
  abuseDetectionEnabled: process.env.SECURITY_ABUSE_DETECTION_ENABLED !== 'false',
  suspiciousActivityThreshold: parseInt(process.env.SECURITY_SUSPICIOUS_ACTIVITY_THRESHOLD || '50'),
  ipWhitelist: process.env.SECURITY_IP_WHITELIST?.split(',').filter(Boolean) || []
} as const

// Critical endpoints that require enhanced security
export const CRITICAL_ENDPOINTS = [
  '/booking-create',
  '/booking-cancel',
  '/payment-process',
  '/user-create',
  '/user-delete',
  '/settings-update'
] as const

// Security middleware presets
export const SECURITY_PRESETS = {
  // For critical operations like booking and payments
  criticalOperation: {
    auth: { required: true },
    rateLimit: {
      maxRequests: 10,
      windowSeconds: 60,
      skipForRoles: ['admin'] as const
    },
    idempotency: {
      enabled: true,
      expirationHours: IDEMPOTENCY_CONFIG.expirationHours
    },
    audit: {
      enabled: true,
      logRequestBody: true,
      logResponseBody: false
    }
  },

  // For admin-only operations
  adminOnly: {
    auth: { 
      required: true,
      allowedRoles: ['admin'] as const
    },
    rateLimit: {
      maxRequests: RATE_LIMITS.admin.maxRequests,
      windowSeconds: RATE_LIMITS.admin.windowSeconds
    },
    audit: {
      enabled: true,
      logRequestBody: true,
      logResponseBody: true
    }
  },

  // For staff operations
  staffOperation: {
    auth: { 
      required: true,
      allowedRoles: ['admin', 'staff'] as const
    },
    rateLimit: {
      maxRequests: RATE_LIMITS.staff.maxRequests,
      windowSeconds: RATE_LIMITS.staff.windowSeconds,
      skipForRoles: ['admin'] as const
    },
    audit: {
      enabled: true,
      logRequestBody: true,
      logResponseBody: false
    }
  },

  // For public endpoints with basic protection
  publicEndpoint: {
    auth: { required: false },
    rateLimit: {
      maxRequests: RATE_LIMITS.anonymous.maxRequests,
      windowSeconds: RATE_LIMITS.anonymous.windowSeconds
    },
    audit: {
      enabled: false
    }
  }
} as const

// Validation rules
export const VALIDATION_RULES = {
  // Maximum request body size (in bytes)
  maxRequestBodySize: 10 * 1024 * 1024, // 10MB
  
  // Maximum idempotency key length
  maxIdempotencyKeyLength: 255,
  
  // Minimum password requirements (if applicable)
  passwordMinLength: 8,
  passwordRequireSpecial: true,
  passwordRequireNumbers: true,
  
  // IP address validation
  ipAddressPattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  
  // Correlation ID pattern
  correlationIdPattern: /^req_\d+_[a-z0-9]+$/
} as const

// Error codes for consistent error handling
export const SECURITY_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const

// Security headers configuration
export const SECURITY_HEADERS = {
  cors: {
    'Access-Control-Allow-Origin': '*', // Restrict in production
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400' // 24 hours
  },
  security: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
} as const

// Utility functions for security configuration
export const SecurityUtils = {
  // Get rate limit configuration for a user role
  getRateLimitForRole(role: keyof typeof RATE_LIMITS) {
    return RATE_LIMITS[role] || RATE_LIMITS.anonymous
  },

  // Check if an endpoint is considered critical
  isCriticalEndpoint(path: string): boolean {
    return CRITICAL_ENDPOINTS.some(endpoint => path.includes(endpoint))
  },

  // Get security preset by name
  getSecurityPreset(presetName: keyof typeof SECURITY_PRESETS) {
    return SECURITY_PRESETS[presetName]
  },

  // Sanitize sensitive data from logs
  sanitizeLogData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data }
    
    for (const field of AUDIT_CONFIG.sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]'
      }
    }
    
    return sanitized
  },

  // Validate correlation ID format
  isValidCorrelationId(correlationId: string): boolean {
    return VALIDATION_RULES.correlationIdPattern.test(correlationId)
  },

  // Check if IP is whitelisted
  isWhitelistedIP(ip: string): boolean {
    if (SECURITY_FEATURES.ipWhitelist.length === 0) {
      return true // No whitelist configured
    }
    return SECURITY_FEATURES.ipWhitelist.includes(ip)
  }
} as const

// Export configuration for easy access
export default {
  RATE_LIMITS,
  IDEMPOTENCY_CONFIG,
  AUDIT_CONFIG,
  DATA_RETENTION_CONFIG,
  SECURITY_FEATURES,
  CRITICAL_ENDPOINTS,
  SECURITY_PRESETS,
  VALIDATION_RULES,
  SECURITY_ERROR_CODES,
  SECURITY_HEADERS,
  SecurityUtils
}