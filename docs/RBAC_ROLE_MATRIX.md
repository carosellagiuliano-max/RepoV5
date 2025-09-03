# RBAC Role Matrix - Schnittwerk Your Style

## Overview

This document defines the role-based access control (RBAC) matrix for the hair salon booking system. The system implements four distinct roles with specific permissions following the principle of least privilege.

## Roles

### 1. Admin
**Full system access** - Can perform all operations including system configuration and user management.

### 2. Staff 
**Service provider** - Can manage their own schedule, view assigned appointments, and access customer data for their appointments.

### 3. Receptionist
**Front desk operations** - Can manage appointments and customer data but cannot access system configuration or staff management.

### 4. Customer
**Self-service** - Can only manage their own profile and view/manage their own appointments.

## Permission Matrix

### Legend
- ✅ **Full Access** - Can perform all CRUD operations
- 🔍 **Read Only** - Can view but not modify
- 📋 **Limited** - Restricted access (see notes)
- ❌ **No Access** - Cannot access

| Resource/Action | Admin | Staff | Receptionist | Customer | Notes |
|----------------|-------|-------|--------------|----------|-------|
| **User Management** |
| View all profiles | ✅ | ❌ | ❌ | ❌ | Admin only |
| Manage user roles | ✅ | ❌ | ❌ | ❌ | Admin only |
| Create staff accounts | ✅ | ❌ | ❌ | ❌ | Admin only |
| View own profile | ✅ | ✅ | ✅ | ✅ | All users |
| Update own profile | ✅ | ✅ | ✅ | ✅ | All users |
| **Customer Management** |
| View all customers | ✅ | 📋 | ✅ | ❌ | Staff: only customers with appointments |
| Create customer accounts | ✅ | ✅ | ✅ | ❌ | |
| Update customer data | ✅ | 📋 | ✅ | 📋 | Staff: limited to appointment customers; Customer: own data only |
| Delete customer accounts | ✅ | ❌ | ❌ | ❌ | Admin only (soft delete) |
| View customer PII (email/phone) | ✅ | ❌ | ❌ | 📋 | Admin full access; Customer: own data only |
| **Appointment Management** |
| View all appointments | ✅ | 📋 | ✅ | ❌ | Staff: only assigned appointments |
| Create appointments | ✅ | ✅ | ✅ | 📋 | Customer: own appointments only |
| Update appointments | ✅ | 📋 | ✅ | 📋 | Staff: assigned appointments; Customer: own pending appointments |
| Cancel appointments | ✅ | 📋 | ✅ | 📋 | Staff: assigned appointments; Customer: own appointments |
| Delete appointments | ✅ | ❌ | ❌ | ❌ | Admin only |
| View appointment notes | ✅ | ✅ | ✅ | 🔍 | Customer: read-only access to their notes |
| **Staff Management** |
| View staff list | ✅ | 🔍 | 🔍 | 🔍 | Public: active staff only |
| Manage staff data | ✅ | ❌ | ❌ | ❌ | Admin only |
| View staff availability | ✅ | 📋 | 🔍 | 🔍 | Staff: own availability full access |
| Manage staff availability | ✅ | 📋 | ❌ | ❌ | Staff: own availability only |
| View staff time-off | ✅ | 📋 | 🔍 | ❌ | Staff: own time-off full access |
| Manage staff time-off | ✅ | 📋 | ❌ | ❌ | Staff: own time-off only |
| **Service Management** |
| View services | ✅ | 🔍 | 🔍 | 🔍 | All: active services only (Admin: all services) |
| Create services | ✅ | ❌ | ❌ | ❌ | Admin only |
| Update services | ✅ | ❌ | ❌ | ❌ | Admin only |
| Delete services | ✅ | ❌ | ❌ | ❌ | Admin only |
| Manage staff-service mappings | ✅ | ❌ | ❌ | ❌ | Admin only |
| **System Configuration** |
| Business settings | ✅ | ❌ | ❌ | ❌ | Admin only |
| Email/SMS settings | ✅ | ❌ | ❌ | ❌ | Admin only |
| Notification templates | ✅ | ❌ | ❌ | ❌ | Admin only |
| Payment settings | ✅ | ❌ | ❌ | ❌ | Admin only |
| **Media Management** |
| View public media | ✅ | ✅ | ✅ | ✅ | All users |
| Upload media | ✅ | ✅ | ❌ | ❌ | Admin and Staff only |
| Manage all media | ✅ | ❌ | ❌ | ❌ | Admin only |
| View own uploads | ✅ | ✅ | ❌ | ❌ | Uploader and Admin |
| **Analytics & Reports** |
| View business analytics | ✅ | ❌ | 🔍 | ❌ | Receptionist: basic appointment stats |
| Revenue reports | ✅ | ❌ | ❌ | ❌ | Admin only |
| Staff performance | ✅ | 📋 | ❌ | ❌ | Staff: own performance only |
| **Audit & Security** |
| View audit logs | ✅ | ❌ | ❌ | ❌ | Admin only |
| Security settings | ✅ | ❌ | ❌ | ❌ | Admin only |

## Field-Level Access Control

### Customer Data PII Masking

Personally Identifiable Information (PII) is restricted based on roles:

| Field | Admin | Staff | Receptionist | Customer |
|-------|-------|-------|--------------|----------|
| Full Name | ✅ | 📋 | ✅ | 📋 |
| Email | ✅ | ❌ | ❌ | 📋 |
| Phone | ✅ | ❌ | ❌ | 📋 |
| Address | ✅ | ❌ | ✅ | 📋 |
| Date of Birth | ✅ | ❌ | ✅ | 📋 |
| Emergency Contact | ✅ | ❌ | ✅ | 📋 |
| Customer Notes | ✅ | 📋 | ✅ | ❌ |

**Notes:**
- 📋 **Limited**: Staff can only see customer data for their assigned appointments
- 📋 **Own Data**: Customers can only see/modify their own data
- ❌ **Masked**: Field is hidden or shows masked value (e.g., "***@***.de", "+49***")

## Role Hierarchy

```
Admin (Full Access)
├── Staff (Service Provider)
├── Receptionist (Front Desk)
└── Customer (Self Service)
```

### Role Inheritance
- **No inheritance**: Each role has explicitly defined permissions
- **Principle of least privilege**: Users get minimum required access
- **Role separation**: Clear boundaries between operational roles

## Implementation Notes

### Database Level (RLS Policies)
- Row Level Security enforces access at the database level
- Policies check user role from JWT claims
- Field-level masking implemented through database functions

### Application Level
- Additional role checks in Netlify Functions
- UI components conditionally rendered based on user role
- API endpoints validate role permissions

### Security Considerations
- JWT tokens contain role claims
- Role changes require re-authentication
- All sensitive operations logged in audit trail
- Rate limiting applied per role

## Examples

### Receptionist Use Cases
```sql
-- Receptionist can view all customer appointments
SELECT * FROM appointments WHERE customer_id = ?

-- Receptionist cannot view staff personal settings
-- This query would return empty due to RLS policies
SELECT * FROM staff_availability WHERE staff_id = ?

-- Receptionist can create appointments for any customer
INSERT INTO appointments (customer_id, staff_id, service_id, ...)
```

### Staff Use Cases
```sql
-- Staff can only see their assigned appointments
SELECT * FROM appointments WHERE staff_id = get_current_staff_id()

-- Staff can manage their own availability
UPDATE staff_availability SET ... WHERE staff_id = get_current_staff_id()

-- Staff cannot see customer email (field-level masking)
SELECT first_name, last_name, 
       CASE WHEN is_admin() THEN email ELSE mask_email(email) END as email
FROM customers
```

### Field-Level Masking Examples
```sql
-- Email masking function
CREATE FUNCTION mask_email(email TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE 
    WHEN email IS NULL THEN NULL
    WHEN LENGTH(email) < 5 THEN '***'
    ELSE SUBSTRING(email FROM 1 FOR 2) || '***@***' || 
         SUBSTRING(email FROM POSITION('@' IN email) + 3)
  END;
END;
$$ LANGUAGE plpgsql;

-- Phone masking function  
CREATE FUNCTION mask_phone(phone TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN phone IS NULL THEN NULL
    WHEN LENGTH(phone) < 8 THEN '***'
    ELSE SUBSTRING(phone FROM 1 FOR 3) || '***' || 
         SUBSTRING(phone FROM LENGTH(phone) - 1)
  END;
END;
$$ LANGUAGE plpgsql;
```

## Testing Strategy

### Positive Tests
- Each role can access their permitted resources
- Operations complete successfully within role boundaries

### Negative Tests
- Roles cannot access restricted resources
- Unauthorized operations fail gracefully
- Field-level masking applied correctly

### Edge Cases
- Role transitions (staff becoming admin)
- Deactivated users lose access
- Cross-location access restrictions