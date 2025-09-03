/**
 * Admin Role Permissions API - Get role permissions matrix
 * Only accessible by admin users
 */

import { Handler } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, generateCorrelationId, createLogger } from '../../lib/auth/netlify-auth'
import { createAdminClient } from '../../lib/auth/netlify-auth'

// GET /api/admin/role-permissions - Get role permissions matrix
const getRolePermissionsHandler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    try {
      logger.info('Fetching role permissions matrix', { 
        adminId: context.user.id,
        adminEmail: context.user.email 
      })

      // Define the role permissions matrix
      const rolePermissions = {
        admin: [
          { resource: 'profiles', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'customers', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'staff', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'appointments', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'services', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'settings', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'media', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'payments', can_read: true, can_create: true, can_update: true, can_delete: true }
        ],
        staff: [
          { resource: 'profiles', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'customers', can_read: true, can_create: true, can_update: false, can_delete: false },
          { resource: 'staff', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'appointments', can_read: true, can_create: true, can_update: true, can_delete: false },
          { resource: 'services', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'settings', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'media', can_read: true, can_create: true, can_update: true, can_delete: true },
          { resource: 'payments', can_read: false, can_create: false, can_update: false, can_delete: false }
        ],
        receptionist: [
          { resource: 'profiles', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'customers', can_read: true, can_create: true, can_update: true, can_delete: false },
          { resource: 'staff', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'appointments', can_read: true, can_create: true, can_update: true, can_delete: false },
          { resource: 'services', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'settings', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'media', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'payments', can_read: false, can_create: false, can_update: false, can_delete: false }
        ],
        customer: [
          { resource: 'profiles', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'customers', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'staff', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'appointments', can_read: false, can_create: true, can_update: true, can_delete: false },
          { resource: 'services', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'settings', can_read: false, can_create: false, can_update: false, can_delete: false },
          { resource: 'media', can_read: true, can_create: false, can_update: false, can_delete: false },
          { resource: 'payments', can_read: false, can_create: false, can_update: false, can_delete: false }
        ]
      }

      // Log audit event
      await supabase
        .from('admin_audit')
        .insert({
          action_type: 'view_role_permissions',
          resource_type: 'role_permissions',
          resource_id: 'all',
          admin_id: context.user.id,
          admin_email: context.user.email,
          action_data: { requested_by: context.user.email },
          success: true,
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || 'unknown'
        })

      return createSuccessResponse(rolePermissions)
    } catch (error) {
      logger.error('Error in getRolePermissionsHandler', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 30, windowMs: 60 * 1000 }
)

// Route handler
export const handler: Handler = async (event, context) => {
  const method = event.httpMethod

  if (method === 'GET') {
    return getRolePermissionsHandler(event, context)
  }

  return createErrorResponse({
    statusCode: 405,
    message: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  })
}