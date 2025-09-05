import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Role-Based Access Control (RBAC)
 * Tests: admin/staff/customer access permissions and forbidden actions
 */

// Test configuration
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.local'
const TEST_STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'staff@test.local'
const TEST_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer@test.local'
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Test123!@#'

interface UserCredentials {
  email: string
  password: string
  role: 'admin' | 'staff' | 'customer'
}

// Helper class for RBAC testing
class RBACHelper {
  constructor(private page: Page) {}

  async loginAsUser(user: UserCredentials) {
    await this.page.goto('/login')
    await this.page.fill('[data-testid="email-input"]', user.email)
    await this.page.fill('[data-testid="password-input"]', user.password)
    await this.page.click('[data-testid="login-button"]')
    
    // Wait for login to complete
    await this.page.waitForLoadState('networkidle')
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]')
    await this.page.click('[data-testid="logout-button"]')
    await this.page.waitForURL('/login')
  }

  async attemptToAccessPage(url: string): Promise<{ accessible: boolean, statusCode?: number }> {
    try {
      const response = await this.page.goto(url)
      const statusCode = response?.status() || 200
      
      // Check if we were redirected to login or got an error page
      const currentUrl = this.page.url()
      const isAccessDenied = currentUrl.includes('/login') || 
                            currentUrl.includes('/unauthorized') || 
                            statusCode >= 400
      
      return {
        accessible: !isAccessDenied && statusCode < 400,
        statusCode
      }
    } catch (error) {
      return { accessible: false, statusCode: 500 }
    }
  }

  async attemptAPICall(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<{ success: boolean, statusCode: number, response?: any }> {
    try {
      const requestOptions: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
        }
      }
      
      if (data && method !== 'GET') {
        requestOptions.body = JSON.stringify(data)
      }
      
      const response = await this.page.evaluate(async ({ url, options }) => {
        const res = await fetch(url, options)
        const text = await res.text()
        let json
        try {
          json = JSON.parse(text)
        } catch {
          json = { text }
        }
        return {
          status: res.status,
          data: json
        }
      }, { url: endpoint, options: requestOptions })
      
      return {
        success: response.status < 400,
        statusCode: response.status,
        response: response.data
      }
    } catch (error) {
      return { success: false, statusCode: 500 }
    }
  }

  async checkElementVisibility(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector)
      return await element.isVisible()
    } catch {
      return false
    }
  }

  async getDisplayedUserRole(): Promise<string | null> {
    try {
      const roleElement = this.page.locator('[data-testid="user-role"]')
      return await roleElement.textContent()
    } catch {
      return null
    }
  }
}

test.describe('RBAC - Role-Based Access Control', () => {
  let rbacHelper: RBACHelper

  const users: UserCredentials[] = [
    { email: TEST_ADMIN_EMAIL, password: TEST_PASSWORD, role: 'admin' },
    { email: TEST_STAFF_EMAIL, password: TEST_PASSWORD, role: 'staff' },
    { email: TEST_CUSTOMER_EMAIL, password: TEST_PASSWORD, role: 'customer' }
  ]

  test.beforeEach(async ({ page }) => {
    rbacHelper = new RBACHelper(page)
  })

  test.describe('Admin Role Permissions', () => {
    const adminUser = users.find(u => u.role === 'admin')!

    test('admin should have full access to all admin sections', async ({ page }) => {
      await rbacHelper.loginAsUser(adminUser)

      const adminSections = [
        '/admin',
        '/admin/dashboard',
        '/admin/staff',
        '/admin/services',
        '/admin/customers',
        '/admin/appointments',
        '/admin/media',
        '/admin/settings',
        '/admin/analytics',
        '/admin/users'
      ]

      for (const section of adminSections) {
        await test.step(`Access ${section}`, async () => {
          const result = await rbacHelper.attemptToAccessPage(section)
          expect(result.accessible).toBe(true)
          expect(result.statusCode).toBeLessThan(400)
        })
      }
    })

    test('admin should be able to perform all CRUD operations', async ({ page }) => {
      await rbacHelper.loginAsUser(adminUser)

      await test.step('Create staff member via API', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/staff', 'POST', {
          full_name: 'RBAC Test Staff',
          email: `rbac-staff-${Date.now()}@test.local`,
          position: 'Test Position',
          is_active: true
        })
        
        expect(result.success).toBe(true)
        expect(result.statusCode).toBeLessThan(400)
      })

      await test.step('Read all staff via API', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/staff')
        
        expect(result.success).toBe(true)
        expect(result.statusCode).toBe(200)
        expect(result.response).toHaveProperty('data')
      })

      await test.step('Update customer data via API', async () => {
        // First, get a customer ID
        const customersResult = await rbacHelper.attemptAPICall('/api/admin/customers')
        expect(customersResult.success).toBe(true)
        
        if (customersResult.response.data.length > 0) {
          const customerId = customersResult.response.data[0].id
          
          const updateResult = await rbacHelper.attemptAPICall(`/api/admin/customers/${customerId}`, 'PUT', {
            notes: 'Updated by RBAC test'
          })
          
          expect(updateResult.success).toBe(true)
        }
      })

      await test.step('Delete test data via API', async () => {
        // Find and delete the test staff we created
        const staffResult = await rbacHelper.attemptAPICall('/api/admin/staff')
        const testStaff = staffResult.response.data.find((s: any) => s.full_name === 'RBAC Test Staff')
        
        if (testStaff) {
          const deleteResult = await rbacHelper.attemptAPICall(`/api/admin/staff/${testStaff.id}`, 'DELETE')
          expect(deleteResult.success).toBe(true)
        }
      })
    })

    test('admin should see all admin UI elements', async ({ page }) => {
      await rbacHelper.loginAsUser(adminUser)
      await page.goto('/admin')

      await test.step('Check admin navigation elements', async () => {
        const adminElements = [
          '[data-testid="admin-nav-dashboard"]',
          '[data-testid="admin-nav-staff"]',
          '[data-testid="admin-nav-services"]',
          '[data-testid="admin-nav-customers"]',
          '[data-testid="admin-nav-appointments"]',
          '[data-testid="admin-nav-media"]',
          '[data-testid="admin-nav-settings"]',
          '[data-testid="admin-nav-analytics"]',
          '[data-testid="admin-nav-users"]'
        ]

        for (const element of adminElements) {
          const isVisible = await rbacHelper.checkElementVisibility(element)
          expect(isVisible).toBe(true)
        }
      })

      await test.step('Check admin action buttons', async () => {
        await page.goto('/admin/staff')
        
        const adminActions = [
          '[data-testid="create-staff-button"]',
          '[data-testid="bulk-actions"]',
          '[data-testid="export-data"]',
          '[data-testid="import-data"]'
        ]

        for (const action of adminActions) {
          const isVisible = await rbacHelper.checkElementVisibility(action)
          expect(isVisible).toBe(true)
        }
      })
    })
  })

  test.describe('Staff Role Permissions', () => {
    const staffUser = users.find(u => u.role === 'staff')!

    test('staff should have limited admin access', async ({ page }) => {
      await rbacHelper.loginAsUser(staffUser)

      await test.step('Access allowed staff sections', async () => {
        const allowedSections = [
          '/admin/appointments',
          '/admin/customers',
          '/admin/services' // Read-only
        ]

        for (const section of allowedSections) {
          const result = await rbacHelper.attemptToAccessPage(section)
          expect(result.accessible).toBe(true)
        }
      })

      await test.step('Deny access to admin-only sections', async () => {
        const deniedSections = [
          '/admin/staff',
          '/admin/settings',
          '/admin/analytics',
          '/admin/users',
          '/admin/media'
        ]

        for (const section of deniedSections) {
          const result = await rbacHelper.attemptToAccessPage(section)
          expect(result.accessible).toBe(false)
          expect([401, 403, 404]).toContain(result.statusCode || 403)
        }
      })
    })

    test('staff should have limited CRUD permissions', async ({ page }) => {
      await rbacHelper.loginAsUser(staffUser)

      await test.step('Staff can read own appointments', async () => {
        const result = await rbacHelper.attemptAPICall('/api/staff/appointments')
        expect(result.success).toBe(true)
        expect(result.statusCode).toBe(200)
      })

      await test.step('Staff can create customer appointments', async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const result = await rbacHelper.attemptAPICall('/api/staff/appointments', 'POST', {
          customer_email: TEST_CUSTOMER_EMAIL,
          service_id: 'valid-service-id',
          appointment_date: tomorrow.toISOString().split('T')[0],
          appointment_time: '14:00',
          notes: 'RBAC test appointment'
        })
        
        // Should succeed or fail due to business logic, not authorization
        expect([200, 201, 400, 409]).toContain(result.statusCode)
        if (result.statusCode >= 400) {
          expect(result.statusCode).not.toBe(401) // Not unauthorized
          expect(result.statusCode).not.toBe(403) // Not forbidden
        }
      })

      await test.step('Staff cannot access other staff data', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/staff')
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })

      await test.step('Staff cannot modify system settings', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/settings', 'PUT', {
          booking_window_days: 60
        })
        
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })
    })

    test('staff should see limited UI elements', async ({ page }) => {
      await rbacHelper.loginAsUser(staffUser)
      await page.goto('/admin')

      await test.step('Check visible staff elements', async () => {
        const visibleElements = [
          '[data-testid="admin-nav-appointments"]',
          '[data-testid="admin-nav-customers"]'
        ]

        for (const element of visibleElements) {
          const isVisible = await rbacHelper.checkElementVisibility(element)
          expect(isVisible).toBe(true)
        }
      })

      await test.step('Check hidden admin-only elements', async () => {
        const hiddenElements = [
          '[data-testid="admin-nav-staff"]',
          '[data-testid="admin-nav-settings"]',
          '[data-testid="admin-nav-analytics"]',
          '[data-testid="admin-nav-users"]'
        ]

        for (const element of hiddenElements) {
          const isVisible = await rbacHelper.checkElementVisibility(element)
          expect(isVisible).toBe(false)
        }
      })
    })
  })

  test.describe('Customer Role Permissions', () => {
    const customerUser = users.find(u => u.role === 'customer')!

    test('customer should not access any admin sections', async ({ page }) => {
      await rbacHelper.loginAsUser(customerUser)

      const adminSections = [
        '/admin',
        '/admin/dashboard',
        '/admin/staff',
        '/admin/services',
        '/admin/customers',
        '/admin/appointments',
        '/admin/media',
        '/admin/settings'
      ]

      for (const section of adminSections) {
        await test.step(`Deny access to ${section}`, async () => {
          const result = await rbacHelper.attemptToAccessPage(section)
          expect(result.accessible).toBe(false)
          expect([401, 403, 404]).toContain(result.statusCode || 403)
        })
      }
    })

    test('customer should only access own data', async ({ page }) => {
      await rbacHelper.loginAsUser(customerUser)

      await test.step('Customer can access own bookings', async () => {
        const result = await rbacHelper.attemptAPICall('/api/customer/bookings')
        expect(result.success).toBe(true)
        expect(result.statusCode).toBe(200)
      })

      await test.step('Customer can update own profile', async () => {
        const result = await rbacHelper.attemptAPICall('/api/customer/profile', 'PUT', {
          phone: '+49 999 888777',
          preferences: { communication: 'email' }
        })
        
        expect(result.success).toBe(true)
        expect(result.statusCode).toBe(200)
      })

      await test.step('Customer cannot access other customer data', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/customers')
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })

      await test.step('Customer cannot create staff appointments', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/appointments', 'POST', {
          staff_id: 'any-staff-id',
          customer_id: 'any-customer-id',
          service_id: 'any-service-id'
        })
        
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })
    })

    test('customer should access allowed customer areas', async ({ page }) => {
      await rbacHelper.loginAsUser(customerUser)

      const allowedSections = [
        '/',
        '/booking',
        '/my-bookings',
        '/profile',
        '/services'
      ]

      for (const section of allowedSections) {
        await test.step(`Access ${section}`, async () => {
          const result = await rbacHelper.attemptToAccessPage(section)
          expect(result.accessible).toBe(true)
        })
      }
    })
  })

  test.describe('Cross-Role Security Tests', () => {
    test('unauthorized access attempts should be logged', async ({ page }) => {
      const customerUser = users.find(u => u.role === 'customer')!
      await rbacHelper.loginAsUser(customerUser)

      await test.step('Attempt unauthorized admin access', async () => {
        await rbacHelper.attemptToAccessPage('/admin/settings')
        
        // Check audit log via admin
        await rbacHelper.logout()
        
        const adminUser = users.find(u => u.role === 'admin')!
        await rbacHelper.loginAsUser(adminUser)
        
        const auditResult = await rbacHelper.attemptAPICall('/api/admin/audit-logs')
        expect(auditResult.success).toBe(true)
        
        // Verify unauthorized access is logged
        const logs = auditResult.response.data
        const unauthorizedAttempt = logs.find((log: any) => 
          log.action === 'unauthorized_access_attempt' &&
          log.user_email === customerUser.email
        )
        
        expect(unauthorizedAttempt).toBeTruthy()
      })
    })

    test('role escalation should be prevented', async ({ page }) => {
      const staffUser = users.find(u => u.role === 'staff')!
      await rbacHelper.loginAsUser(staffUser)

      await test.step('Staff cannot elevate own role', async () => {
        const result = await rbacHelper.attemptAPICall('/api/admin/users/role', 'PUT', {
          role: 'admin'
        })
        
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })

      await test.step('Staff cannot modify other user roles', async () => {
        const result = await rbacHelper.attemptAPICall(`/api/admin/users/${customerUser.email}/role`, 'PUT', {
          role: 'staff'
        })
        
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })
    })

    test('session validation should prevent impersonation', async ({ page }) => {
      const adminUser = users.find(u => u.role === 'admin')!
      const customerUser = users.find(u => u.role === 'customer')!

      await test.step('Login as admin', async () => {
        await rbacHelper.loginAsUser(adminUser)
        await page.goto('/admin')
        
        const role = await rbacHelper.getDisplayedUserRole()
        expect(role).toContain('admin')
      })

      await test.step('Switch to customer - should require new login', async () => {
        await rbacHelper.logout()
        await rbacHelper.loginAsUser(customerUser)
        
        // Try to access admin - should be denied
        const result = await rbacHelper.attemptToAccessPage('/admin')
        expect(result.accessible).toBe(false)
        
        const role = await rbacHelper.getDisplayedUserRole()
        expect(role).toContain('customer')
      })
    })

    test('JWT token manipulation should be prevented', async ({ page }) => {
      const customerUser = users.find(u => u.role === 'customer')!
      await rbacHelper.loginAsUser(customerUser)

      await test.step('Attempt to manipulate authorization headers', async () => {
        // Try to set admin authorization header manually
        await page.evaluate(() => {
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: 'fake-admin-token',
            user: { role: 'admin' }
          }))
        })

        // Attempt admin access - should still be denied
        const result = await rbacHelper.attemptAPICall('/api/admin/staff')
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })
    })
  })

  test.describe('RLS Policy Enforcement', () => {
    test('database-level security should enforce row-level policies', async ({ page }) => {
      const staffUser = users.find(u => u.role === 'staff')!
      const customerUser = users.find(u => u.role === 'customer')!

      await test.step('Staff can only see own availability', async () => {
        await rbacHelper.loginAsUser(staffUser)
        
        const result = await rbacHelper.attemptAPICall('/api/staff/availability')
        expect(result.success).toBe(true)
        
        // Should only return availability for current staff member
        const availability = result.response.data
        if (availability.length > 0) {
          availability.forEach((slot: any) => {
            expect(slot.staff_email).toBe(staffUser.email)
          })
        }
      })

      await test.step('Customer can only see own appointments', async () => {
        await rbacHelper.loginAsUser(customerUser)
        
        const result = await rbacHelper.attemptAPICall('/api/customer/appointments')
        expect(result.success).toBe(true)
        
        // Should only return appointments for current customer
        const appointments = result.response.data
        if (appointments.length > 0) {
          appointments.forEach((appointment: any) => {
            expect(appointment.customer_email).toBe(customerUser.email)
          })
        }
      })
    })

    test('database policies should prevent unauthorized data access', async ({ page }) => {
      const customerUser = users.find(u => u.role === 'customer')!
      await rbacHelper.loginAsUser(customerUser)

      await test.step('Customer cannot access staff table directly', async () => {
        const result = await rbacHelper.attemptAPICall('/api/data/staff')
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })

      await test.step('Customer cannot access other customers\' data', async () => {
        const result = await rbacHelper.attemptAPICall('/api/data/customers')
        expect(result.success).toBe(false)
        expect([401, 403]).toContain(result.statusCode)
      })
    })
  })
})