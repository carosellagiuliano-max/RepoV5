# RBAC Implementation Guide - Schnittwerk Your Style

## Overview

This document describes the complete implementation of Role-Based Access Control (RBAC) refinement for the hair salon booking system. The implementation adds granular permissions with support for Admin/Staff/Receptionist/Customer roles, field-level PII masking, and comprehensive security policies.

## Implementation Summary

### ✅ What Was Implemented

1. **Enhanced Role System**
   - Added `receptionist` role to existing admin/staff/customer roles
   - Updated TypeScript types to support 4-role system
   - Enhanced authentication functions with role-specific checks

2. **Comprehensive RLS Policies** 
   - Created enhanced database policies supporting receptionist permissions
   - Implemented field-level PII masking for sensitive customer data
   - Added helper functions for granular permission checks

3. **Admin Role Management UI**
   - Created React component for role assignment and overview
   - Added permissions matrix visualization
   - Implemented user role change functionality with audit logging

4. **Backend API Support**
   - Added admin-users endpoint for user management
   - Created role-permissions endpoint for matrix data
   - Enhanced JWT validation with new role checks

5. **Comprehensive Testing**
   - Created RLS policy test suite with positive/negative scenarios
   - Added field-level masking validation tests
   - Implemented role permission matrix testing

6. **Documentation**
   - Complete role matrix with permission definitions
   - Implementation guide with examples
   - Security considerations and best practices

## File Changes Made

### Database Schema & Policies
- `docs/db/17_rbac_enhanced_policies.sql` - Enhanced RLS policies with receptionist support
- `docs/db/18_rbac_tests.sql` - Comprehensive test suite for RLS policies

### TypeScript Types
- `src/lib/types/database.ts` - Updated UserRole type to include 'receptionist'
- Updated profile Insert/Update types with new role

### Authentication System
- `src/lib/auth/netlify-auth.ts` - Enhanced with new role checking functions:
  - `isReceptionistOrAdmin()` - Check receptionist or admin access
  - `hasAppointmentAccess()` - Check appointment management permissions
  - Updated `withAuth()` HOF with new options

### Admin UI Components
- `src/admin/components/role-management.tsx` - Complete role management interface

### Backend APIs
- `netlify/functions/admin-users.ts` - User management and role assignment API
- `netlify/functions/admin-role-permissions.ts` - Role permissions matrix API

### Documentation
- `docs/RBAC_ROLE_MATRIX.md` - Comprehensive role matrix and permissions guide
- `docs/RBAC_IMPLEMENTATION.md` - This implementation guide

### Configuration
- `.env.example` - Added RBAC-related environment variables

## Role Permissions Summary

| Role | Customer Mgmt | Appointment Mgmt | Staff Mgmt | System Config | PII Access |
|------|---------------|------------------|------------|---------------|------------|
| **Admin** | Full | Full | Full | Full | Full |
| **Staff** | Limited* | Own only | Read only | None | None |
| **Receptionist** | Full | Full | Read only | None | Masked |
| **Customer** | Own only | Own only | Read only | None | Own only |

*Staff can only see customers they have appointments with

## Key Security Features

### 1. Field-Level PII Masking
```sql
-- Email masking example
CREATE FUNCTION mask_email(email TEXT) RETURNS TEXT AS $$
BEGIN
  IF is_admin() THEN RETURN email; END IF;
  RETURN CASE 
    WHEN email IS NULL THEN NULL
    WHEN LENGTH(email) < 5 THEN '***'
    ELSE SUBSTRING(email FROM 1 FOR 2) || '***@***'
  END;
END;
$$ LANGUAGE plpgsql;
```

### 2. Role-Based Database Policies
```sql
-- Enhanced customer access policy
CREATE POLICY "enhanced_customers_select" ON customers FOR SELECT
  USING (
    is_admin() OR
    is_receptionist() OR
    profile_id = auth.uid() OR 
    (is_staff() AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.customer_id = customers.id AND a.staff_id = get_current_staff_id()
    ))
  );
```

### 3. JWT-Based Role Validation
```typescript
// Enhanced authentication with role checks
export const withAuth = (handler, options: {
  requireAdmin?: boolean
  requireReceptionist?: boolean
  requireAppointmentAccess?: boolean
}) => {
  // Validates JWT and checks role permissions
}
```

## Database Migration Steps

To deploy the RBAC enhancements:

1. **Update user_role enum:**
   ```sql
   ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'receptionist';
   ```

2. **Run enhanced policies:**
   ```bash
   psql -f docs/db/17_rbac_enhanced_policies.sql
   ```

3. **Test policies (optional):**
   ```bash
   psql -f docs/db/18_rbac_tests.sql
   ```

## Frontend Integration

### Using the Role Management Component
```tsx
import { RoleManagement } from '@/admin/components/role-management'

function AdminPanel() {
  return (
    <RoleManagement 
      onRoleChange={(userId, newRole) => {
        console.log(`User ${userId} role changed to ${newRole}`)
      }}
    />
  )
}
```

### Role-Based UI Rendering
```tsx
import { useAuth } from '@/contexts/auth-context'

function ProtectedComponent() {
  const { user } = useAuth()
  
  if (!user || !['admin', 'receptionist'].includes(user.role)) {
    return <AccessDenied />
  }
  
  return <CustomerManagement />
}
```

## API Endpoints

### Admin User Management
```
GET  /api/admin/users                 - List all users with roles
PUT  /api/admin/users/{id}/role       - Update user role
```

### Role Permissions
```
GET  /api/admin/role-permissions      - Get role permissions matrix
```

## Testing Strategy

### 1. RLS Policy Tests
The test suite validates:
- ✅ Admin full access to all resources
- ✅ Staff limited access and field masking
- ✅ Receptionist appointment management permissions
- ✅ Customer self-service restrictions
- ✅ Field-level PII masking functionality
- ✅ Negative access control (unauthorized operations fail)

### 2. Role Transition Tests
- Role changes require admin privileges
- Users cannot demote themselves
- Role changes are logged in audit trail

### 3. API Security Tests
- Endpoints reject unauthorized requests
- Rate limiting prevents abuse
- Input validation with Zod schemas

## Security Considerations

### 1. Principle of Least Privilege
- Each role has minimum required permissions
- No role inheritance - explicit permissions only
- Regular permission audits recommended

### 2. Data Protection
- PII fields masked for non-authorized users
- Customer data isolated by relationship
- Audit trail for all sensitive operations

### 3. Authentication & Authorization
- JWT tokens contain role claims
- Role changes require re-authentication
- Database-level policy enforcement

## Monitoring & Auditing

### Admin Audit Log
All admin operations are logged:
```sql
INSERT INTO admin_audit (
  action_type, resource_type, resource_id,
  admin_id, admin_email, action_data,
  success, ip_address, user_agent
)
```

### Key Metrics to Monitor
- Failed authorization attempts
- Role change frequency
- PII access patterns
- Policy violation attempts

## Deployment Checklist

- [ ] Run database migrations
- [ ] Update environment variables
- [ ] Deploy backend functions
- [ ] Test role assignments in staging
- [ ] Verify PII masking works correctly
- [ ] Run RLS policy tests
- [ ] Update admin user documentation
- [ ] Monitor audit logs after deployment

## Future Enhancements

### Potential Improvements
1. **Multi-Location Support** - Location-based role restrictions
2. **Time-Based Permissions** - Temporary role assignments
3. **Advanced Audit Dashboard** - Real-time security monitoring
4. **Role Templates** - Predefined permission sets
5. **API Rate Limiting by Role** - Different limits per role

### Scalability Considerations
- Consider caching role permissions for high-traffic scenarios
- Implement role-based database connection pooling
- Add performance monitoring for RLS policy execution
- Consider materialized views for complex permission queries

## Support & Troubleshooting

### Common Issues

1. **User Cannot Access Resource**
   - Check user role in profiles table
   - Verify RLS policies are enabled
   - Test with get_user_permissions() function

2. **PII Not Masked Properly**
   - Verify masking functions are deployed
   - Check user role in JWT claims
   - Test with customers_secure view

3. **Role Changes Not Working**
   - Ensure admin has proper permissions
   - Check admin_audit table for errors
   - Verify JWT contains updated role claims

### Debug Queries
```sql
-- Check user role and permissions
SELECT * FROM get_user_permissions();

-- View current user context
SELECT auth.uid(), auth.role();

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'customers';
```

## Conclusion

This RBAC implementation provides a robust, scalable security framework for the hair salon booking system. The granular permissions, field-level masking, and comprehensive audit trail ensure data protection while maintaining operational efficiency.

The implementation follows security best practices and provides a solid foundation for future enhancements and scaling requirements.