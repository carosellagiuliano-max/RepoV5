/**
 * Admin Users API - Manage user roles and permissions
 * Only accessible by admin users
 */

import { Handler } from '@netlify/functions'
import { z } from 'zod'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, generateCorrelationId, createLogger } from '../../src/lib/auth/netlify-auth'
import { createAdminClient } from '../../src/lib/auth/netlify-auth'

// Validation schemas
const UpdateRoleSchema = z.object({
  role: z.enum(['admin', 'staff', 'receptionist', 'customer'])
})

// GET /api/admin/users - List all users with roles
const getUsersHandler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    try {
      logger.info('Fetching all users for admin', { 
        adminId: context.user.id,
        adminEmail: context.user.email 
      })

      // Get all profiles with user details
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          first_name,
          last_name,
          phone,
          avatar_url,
          is_active,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to fetch users', { error: error.message })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to fetch users',
          code: 'FETCH_USERS_FAILED'
        })
      }

      // Log audit event
      await supabase
        .from('admin_audit')
        .insert({
          action_type: 'list_users',
          resource_type: 'profiles',
          resource_id: 'all',
          admin_id: context.user.id,
          admin_email: context.user.email,
          action_data: { count: profiles?.length || 0 },
          success: true,
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || 'unknown'
        })

      return createSuccessResponse(profiles)
    } catch (error) {
      logger.error('Error in getUsersHandler', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 50, windowMs: 60 * 1000 }
)

// PUT /api/admin/users/{userId}/role - Update user role
const updateUserRoleHandler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    try {
      // Extract user ID from path
      const pathParts = event.path.split('/')
      const userId = pathParts[pathParts.indexOf('users') + 1]

      if (!userId) {
        return createErrorResponse({
          statusCode: 400,
          message: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        })
      }

      // Validate request body
      if (!event.body) {
        return createErrorResponse({
          statusCode: 400,
          message: 'Request body is required',
          code: 'BODY_REQUIRED'
        })
      }

      const body = JSON.parse(event.body)
      const validation = UpdateRoleSchema.safeParse(body)

      if (!validation.success) {
        return createErrorResponse({
          statusCode: 400,
          message: 'Invalid request data',
          code: 'VALIDATION_ERROR'
        })
      }

      const { role } = validation.data

      logger.info('Updating user role', { 
        userId,
        newRole: role,
        adminId: context.user.id,
        adminEmail: context.user.email 
      })

      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single()

      if (fetchError || !existingUser) {
        logger.error('User not found', { userId, error: fetchError?.message })
        return createErrorResponse({
          statusCode: 404,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        })
      }

      // Prevent admins from demoting themselves
      if (userId === context.user.id && role !== 'admin') {
        return createErrorResponse({
          statusCode: 403,
          message: 'Cannot change your own admin role',
          code: 'CANNOT_DEMOTE_SELF'
        })
      }

      // Update user role
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        logger.error('Failed to update user role', { 
          userId, 
          role, 
          error: updateError.message 
        })
        return createErrorResponse({
          statusCode: 500,
          message: 'Failed to update user role',
          code: 'UPDATE_ROLE_FAILED'
        })
      }

      // Log audit event
      await supabase
        .from('admin_audit')
        .insert({
          action_type: 'update_user_role',
          resource_type: 'profiles',
          resource_id: userId,
          admin_id: context.user.id,
          admin_email: context.user.email,
          action_data: { 
            old_role: existingUser.role,
            new_role: role,
            target_user_email: existingUser.email
          },
          success: true,
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || 'unknown'
        })

      logger.info('User role updated successfully', { 
        userId, 
        oldRole: existingUser.role,
        newRole: role 
      })

      return createSuccessResponse(updatedUser)
    } catch (error) {
      logger.error('Error in updateUserRoleHandler', { error })
      
      // Log failed audit event
      const supabase = createAdminClient()
      await supabase
        .from('admin_audit')
        .insert({
          action_type: 'update_user_role',
          resource_type: 'profiles',
          resource_id: event.path.split('/')[4] || 'unknown',
          admin_id: context.user.id,
          admin_email: context.user.email,
          action_data: { error: error instanceof Error ? error.message : 'Unknown error' },
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || 'unknown'
        })

      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 20, windowMs: 60 * 1000 }
)

// Route handler
export const handler: Handler = async (event, context) => {
  const method = event.httpMethod
  const path = event.path

  // Handle different routes
  if (method === 'GET' && path.endsWith('/users')) {
    return getUsersHandler(event, context)
  }
  
  if (method === 'PUT' && path.includes('/users/') && path.endsWith('/role')) {
    return updateUserRoleHandler(event, context)
  }

  return createErrorResponse({
    statusCode: 404,
    message: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND'
  })
}