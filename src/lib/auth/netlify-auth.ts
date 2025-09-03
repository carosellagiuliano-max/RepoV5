/**
 * Authentication utilities for Netlify Functions
 * Handles JWT validation, role-based access control, and Supabase integration
 */

import { Context, Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Database, UserRole } from '../types/database'

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JWT_SECRET = process.env.JWT_SECRET!

// Create admin Supabase client
export const createAdminClient = () => {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Types for authenticated requests
export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  profile?: {
    first_name: string | null
    last_name: string | null
    phone: string | null
    avatar_url: string | null
    is_active: boolean
  }
}

export interface AuthenticatedContext extends Context {
  user: AuthenticatedUser
}

export interface AuthError {
  statusCode: number
  message: string
  code?: string
}

// Helper function to create error responses
export const createErrorResponse = (error: AuthError) => ({
  statusCode: error.statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  },
  body: JSON.stringify({
    success: false,
    error: {
      message: error.message,
      code: error.code
    }
  })
})

// Helper function to create success responses
export const createSuccessResponse = (data: unknown, statusCode = 200) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  },
  body: JSON.stringify({
    success: true,
    data
  })
})

// Extract JWT token from Authorization header
export const extractToken = (event: { headers: Record<string, string | undefined> }): string | null => {
  const authHeader = event.headers.authorization || event.headers.Authorization
  if (!authHeader) return null
  
  const [bearer, token] = authHeader.split(' ')
  if (bearer !== 'Bearer' || !token) return null
  
  return token
}

// Validate JWT token and get user from Supabase
export const validateToken = async (token: string): Promise<AuthenticatedUser> => {
  const supabase = createAdminClient()
  
  try {
    // Verify JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw {
        statusCode: 401,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      }
    }

    // Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw {
        statusCode: 404,
        message: 'User profile not found',
        code: 'PROFILE_NOT_FOUND'
      }
    }

    if (!profile.is_active) {
      throw {
        statusCode: 403,
        message: 'User account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      }
    }

    return {
      id: user.id,
      email: user.email!,
      role: profile.role,
      profile: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw {
      statusCode: 401,
      message: 'Token validation failed',
      code: 'TOKEN_VALIDATION_FAILED'
    }
  }
}

// Check if user has required role
export const hasRole = (user: AuthenticatedUser, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(user.role)
}

// Check if user is admin
export const isAdmin = (user: AuthenticatedUser): boolean => {
  return user.role === 'admin'
}

// Check if user is staff, receptionist, or admin
export const isStaffOrAdmin = (user: AuthenticatedUser): boolean => {
  return ['admin', 'staff', 'receptionist'].includes(user.role)
}

// Check if user is receptionist or admin
export const isReceptionistOrAdmin = (user: AuthenticatedUser): boolean => {
  return ['admin', 'receptionist'].includes(user.role)
}

// Check if user has appointment management permissions (staff, receptionist, or admin)
export const hasAppointmentAccess = (user: AuthenticatedUser): boolean => {
  return ['admin', 'staff', 'receptionist'].includes(user.role)
}

// HOF to create authenticated handlers
export const withAuth = (
  handler: (event: HandlerEvent, context: AuthenticatedContext) => Promise<Response>,
  options: {
    requiredRoles?: UserRole[]
    requireAdmin?: boolean
    requireStaff?: boolean
    requireReceptionist?: boolean
    requireAppointmentAccess?: boolean
  } = {}
): Handler => {
  return async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
      }
    }

    try {
      // Extract and validate token
      const token = extractToken(event)
      if (!token) {
        return createErrorResponse({
          statusCode: 401,
          message: 'Authorization token required',
          code: 'TOKEN_REQUIRED'
        })
      }

      const user = await validateToken(token)

      // Check role-based access
      if (options.requireAdmin && !isAdmin(user)) {
        return createErrorResponse({
          statusCode: 403,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        })
      }

      if (options.requireStaff && !isStaffOrAdmin(user)) {
        return createErrorResponse({
          statusCode: 403,
          message: 'Staff access required',
          code: 'STAFF_REQUIRED'
        })
      }

      if (options.requireReceptionist && !isReceptionistOrAdmin(user)) {
        return createErrorResponse({
          statusCode: 403,
          message: 'Receptionist access required',
          code: 'RECEPTIONIST_REQUIRED'
        })
      }

      if (options.requireAppointmentAccess && !hasAppointmentAccess(user)) {
        return createErrorResponse({
          statusCode: 403,
          message: 'Appointment management access required',
          code: 'APPOINTMENT_ACCESS_REQUIRED'
        })
      }

      if (options.requiredRoles && !hasRole(user, options.requiredRoles)) {
        return createErrorResponse({
          statusCode: 403,
          message: `Required roles: ${options.requiredRoles.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      }

      // Add user to context and call handler
      const authenticatedContext: AuthenticatedContext = {
        ...context,
        user
      }

      return await handler(event, authenticatedContext)
    } catch (error) {
      console.error('Authentication error:', error)
      
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return createErrorResponse(error as AuthError)
      }

      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}

// Rate limiting utilities
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export const checkRateLimit = (
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): boolean => {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// Get rate limit key for a request
export const getRateLimitKey = (event: HandlerEvent, user?: AuthenticatedUser): string => {
  const ip = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
  const userId = user?.id || 'anonymous'
  return `${ip}:${userId}`
}

// HOF to add rate limiting to handlers
export const withRateLimit = (
  handler: Handler,
  options: {
    maxRequests?: number
    windowMs?: number
    skipSuccessfulAuth?: boolean
  } = {}
): Handler => {
  return async (event, context) => {
    const { maxRequests = 100, windowMs = 60 * 1000 } = options

    const rateLimitKey = getRateLimitKey(event)
    
    if (!checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
      return createErrorResponse({
        statusCode: 429,
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      })
    }

    return handler(event, context)
  }
}

// Combine auth and rate limiting
export const withAuthAndRateLimit = (
  handler: (event: HandlerEvent, context: AuthenticatedContext) => Promise<Response>,
  authOptions: Parameters<typeof withAuth>[1] = {},
  rateLimitOptions: Parameters<typeof withRateLimit>[1] = {}
): Handler => {
  return withRateLimit(
    withAuth(handler, authOptions),
    rateLimitOptions
  )
}

// Correlation ID for request tracing
export const generateCorrelationId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// Enhanced logging with correlation ID
export const logWithCorrelation = (
  correlationId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
) => {
  const logData = {
    timestamp: new Date().toISOString(),
    correlationId,
    level,
    message,
    ...meta
  }
  
  console.log(JSON.stringify(logData))
}

// Create logger for a request
export const createLogger = (correlationId: string) => ({
  info: (message: string, meta?: Record<string, unknown>) =>
    logWithCorrelation(correlationId, 'info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    logWithCorrelation(correlationId, 'warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    logWithCorrelation(correlationId, 'error', message, meta)
})

// Generic error handling wrapper
export const handleErrors = async <T>(
  operation: () => Promise<T>,
  logger: ReturnType<typeof createLogger>
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    logger.error('Operation failed', { error: error instanceof Error ? error.message : error })
    throw error
  }
}