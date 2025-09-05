import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Admin CRUD Operations
 * Tests: Staff/Services/Customers/Appointments/Media/Settings (CRUD + Filter/Pagination)
 */

// Test configuration
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.local'
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Test123!@#'

// Helper class for admin operations
class AdminCRUDHelper {
  constructor(private page: Page) {}

  async loginAsAdmin() {
    await this.page.goto('/login')
    await this.page.fill('[data-testid="email-input"]', TEST_ADMIN_EMAIL)
    await this.page.fill('[data-testid="password-input"]', TEST_ADMIN_PASSWORD)
    await this.page.click('[data-testid="login-button"]')
    
    // Wait for admin dashboard
    await this.page.waitForURL(/\/admin/, { timeout: 15000 })
  }

  async navigateToSection(section: 'staff' | 'services' | 'customers' | 'appointments' | 'media' | 'settings') {
    await this.page.click(`[data-testid="admin-nav-${section}"]`)
    await this.page.waitForURL(`**/admin/${section}`)
  }

  // Generic CRUD operations
  async createRecord(data: Record<string, any>, formSelector = '[data-testid="create-form"]') {
    await this.page.click('[data-testid="create-button"]')
    await this.page.waitForSelector(formSelector)
    
    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'boolean') {
        if (value) {
          await this.page.check(`[data-testid="${field}"]`)
        } else {
          await this.page.uncheck(`[data-testid="${field}"]`)
        }
      } else if (Array.isArray(value)) {
        // Handle multi-select fields
        for (const item of value) {
          await this.page.click(`[data-testid="${field}-${item}"]`)
        }
      } else {
        await this.page.fill(`[data-testid="${field}"]`, String(value))
      }
    }
    
    await this.page.click('[data-testid="save-button"]')
    await this.page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 })
  }

  async updateRecord(recordId: string, data: Record<string, any>) {
    await this.page.click(`[data-testid="edit-${recordId}"]`)
    await this.page.waitForSelector('[data-testid="edit-form"]')
    
    for (const [field, value] of Object.entries(data)) {
      await this.page.fill(`[data-testid="${field}"]`, String(value))
    }
    
    await this.page.click('[data-testid="save-button"]')
    await this.page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 })
  }

  async deleteRecord(recordId: string) {
    await this.page.click(`[data-testid="delete-${recordId}"]`)
    await this.page.click('[data-testid="confirm-delete"]')
    await this.page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 })
  }

  async searchRecords(searchTerm: string) {
    await this.page.fill('[data-testid="search-input"]', searchTerm)
    await this.page.press('[data-testid="search-input"]', 'Enter')
    await this.page.waitForTimeout(1000)
  }

  async filterRecords(filterType: string, filterValue: string) {
    await this.page.click(`[data-testid="filter-${filterType}"]`)
    await this.page.click(`[data-testid="filter-option-${filterValue}"]`)
    await this.page.waitForTimeout(1000)
  }

  async changePage(page: number) {
    await this.page.click(`[data-testid="page-${page}"]`)
    await this.page.waitForTimeout(1000)
  }

  async getRecordCount(): Promise<number> {
    const countElement = this.page.locator('[data-testid="record-count"]')
    const countText = await countElement.textContent()
    return parseInt(countText?.match(/\d+/)?.[0] || '0')
  }
}

test.describe('Admin CRUD Operations', () => {
  let adminHelper: AdminCRUDHelper

  test.beforeEach(async ({ page }) => {
    adminHelper = new AdminCRUDHelper(page)
    await adminHelper.loginAsAdmin()
  })

  test.describe('Staff Management', () => {
    test('should perform full CRUD operations on staff', async ({ page }) => {
      await adminHelper.navigateToSection('staff')

      let staffId: string

      await test.step('Create new staff member', async () => {
        const staffData = {
          'full-name': 'E2E Test Staff',
          'email': `staff-e2e-${Date.now()}@test.local`,
          'phone': '+49 123 456789',
          'position': 'Junior Stylist',
          'is-active': true,
          'specialties': ['Cuts', 'Styling']
        }

        await adminHelper.createRecord(staffData)
        
        // Verify staff appears in list
        await expect(page.locator('[data-testid="staff-list"]')).toContainText('E2E Test Staff')
        
        // Get the staff ID for later operations
        const staffRow = page.locator('[data-testid*="staff-row"]').filter({ hasText: 'E2E Test Staff' })
        staffId = await staffRow.getAttribute('data-testid')?.replace('staff-row-', '') || ''
      })

      await test.step('Update staff member', async () => {
        const updateData = {
          'position': 'Senior Stylist',
          'phone': '+49 987 654321'
        }

        await adminHelper.updateRecord(staffId, updateData)
        
        // Verify updates
        await expect(page.locator(`[data-testid="staff-row-${staffId}"]`)).toContainText('Senior Stylist')
      })

      await test.step('Filter staff by status', async () => {
        await adminHelper.filterRecords('status', 'active')
        
        // Verify only active staff are shown
        const activeStaff = page.locator('[data-testid*="staff-row"][data-status="active"]')
        await expect(activeStaff).toHaveCountGreaterThan(0)
        
        const inactiveStaff = page.locator('[data-testid*="staff-row"][data-status="inactive"]')
        await expect(inactiveStaff).toHaveCount(0)
      })

      await test.step('Search staff by name', async () => {
        await adminHelper.searchRecords('E2E Test Staff')
        
        // Verify search results
        await expect(page.locator('[data-testid="staff-list"]')).toContainText('E2E Test Staff')
        const visibleStaff = page.locator('[data-testid*="staff-row"]')
        await expect(visibleStaff).toHaveCount(1)
      })

      await test.step('Delete staff member', async () => {
        await adminHelper.deleteRecord(staffId)
        
        // Verify staff is removed
        await expect(page.locator(`[data-testid="staff-row-${staffId}"]`)).toHaveCount(0)
      })
    })

    test('should manage staff availability', async ({ page }) => {
      await adminHelper.navigateToSection('staff')
      
      await test.step('Set weekly availability', async () => {
        // Find first active staff member
        const firstStaff = page.locator('[data-testid*="staff-row"]').first()
        const staffId = await firstStaff.getAttribute('data-testid')?.replace('staff-row-', '') || ''
        
        await page.click(`[data-testid="manage-availability-${staffId}"]`)
        
        // Set availability for Monday
        await page.click('[data-testid="availability-monday"]')
        await page.fill('[data-testid="monday-start-time"]', '09:00')
        await page.fill('[data-testid="monday-end-time"]', '17:00')
        
        await page.click('[data-testid="save-availability"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })

      await test.step('Add time off', async () => {
        const firstStaff = page.locator('[data-testid*="staff-row"]').first()
        const staffId = await firstStaff.getAttribute('data-testid')?.replace('staff-row-', '') || ''
        
        await page.click(`[data-testid="manage-timeoff-${staffId}"]`)
        await page.click('[data-testid="add-timeoff"]')
        
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateString = tomorrow.toISOString().split('T')[0]
        
        await page.fill('[data-testid="timeoff-date"]', dateString)
        await page.fill('[data-testid="timeoff-reason"]', 'E2E Test Time Off')
        
        await page.click('[data-testid="save-timeoff"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })
    })
  })

  test.describe('Services Management', () => {
    test('should perform CRUD operations on services', async ({ page }) => {
      await adminHelper.navigateToSection('services')

      let serviceId: string

      await test.step('Create new service', async () => {
        const serviceData = {
          'name': 'E2E Test Service',
          'description': 'Test service for E2E testing',
          'duration-minutes': '45',
          'price-cents': '5500', // 55.00 CHF
          'category': 'Cuts',
          'is-active': true
        }

        await adminHelper.createRecord(serviceData)
        
        // Verify service appears in list
        await expect(page.locator('[data-testid="services-list"]')).toContainText('E2E Test Service')
        
        const serviceRow = page.locator('[data-testid*="service-row"]').filter({ hasText: 'E2E Test Service' })
        serviceId = await serviceRow.getAttribute('data-testid')?.replace('service-row-', '') || ''
      })

      await test.step('Update service pricing', async () => {
        const updateData = {
          'price-cents': '6000' // 60.00 CHF
        }

        await adminHelper.updateRecord(serviceId, updateData)
        
        // Verify price update
        await expect(page.locator(`[data-testid="service-row-${serviceId}"]`)).toContainText('60.00')
      })

      await test.step('Filter services by category', async () => {
        await adminHelper.filterRecords('category', 'cuts')
        
        // Verify only cut services are shown
        const serviceRows = page.locator('[data-testid*="service-row"]')
        const categories = await serviceRows.locator('[data-testid="service-category"]').allTextContents()
        
        categories.forEach(category => {
          expect(category.toLowerCase()).toContain('cuts')
        })
      })

      await test.step('Test service-staff assignment', async () => {
        await page.click(`[data-testid="assign-staff-${serviceId}"]`)
        
        // Select staff member
        const staffCheckbox = page.locator('[data-testid*="staff-assignment"]').first()
        await staffCheckbox.check()
        
        await page.click('[data-testid="save-assignments"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })

      await test.step('Delete service', async () => {
        await adminHelper.deleteRecord(serviceId)
        
        // Verify service is removed
        await expect(page.locator(`[data-testid="service-row-${serviceId}"]`)).toHaveCount(0)
      })
    })
  })

  test.describe('Customer Management', () => {
    test('should perform customer CRUD with GDPR compliance', async ({ page }) => {
      await adminHelper.navigateToSection('customers')

      let customerId: string

      await test.step('Create new customer', async () => {
        const customerData = {
          'full-name': 'E2E Test Customer',
          'email': `customer-e2e-${Date.now()}@test.local`,
          'phone': '+49 555 123456',
          'notes': 'E2E test customer'
        }

        await adminHelper.createRecord(customerData)
        
        // Verify customer appears in list
        await expect(page.locator('[data-testid="customers-list"]')).toContainText('E2E Test Customer')
        
        const customerRow = page.locator('[data-testid*="customer-row"]').filter({ hasText: 'E2E Test Customer' })
        customerId = await customerRow.getAttribute('data-testid')?.replace('customer-row-', '') || ''
      })

      await test.step('Update customer information', async () => {
        const updateData = {
          'phone': '+49 555 987654',
          'notes': 'Updated E2E test customer'
        }

        await adminHelper.updateRecord(customerId, updateData)
        
        // Verify updates
        await expect(page.locator(`[data-testid="customer-row-${customerId}"]`)).toContainText('+49 555 987654')
      })

      await test.step('Search customers', async () => {
        await adminHelper.searchRecords('E2E Test Customer')
        
        // Verify search results
        const visibleCustomers = page.locator('[data-testid*="customer-row"]')
        await expect(visibleCustomers).toHaveCount(1)
      })

      await test.step('View customer booking history', async () => {
        await page.click(`[data-testid="view-history-${customerId}"]`)
        
        // Verify booking history view opens
        await expect(page.locator('[data-testid="customer-booking-history"]')).toBeVisible()
        await expect(page.locator('[data-testid="customer-name"]')).toContainText('E2E Test Customer')
      })

      await test.step('GDPR soft delete customer', async () => {
        await page.click(`[data-testid="gdpr-delete-${customerId}"]`)
        await page.click('[data-testid="confirm-gdpr-delete"]')
        
        // Verify GDPR deletion creates audit log
        await expect(page.locator('[data-testid="gdpr-success-message"]')).toBeVisible()
        
        // Customer should be marked as deleted but not physically removed
        await expect(page.locator(`[data-testid="customer-row-${customerId}"]`)).toHaveAttribute('data-status', 'deleted')
      })
    })
  })

  test.describe('Appointments Management', () => {
    test('should manage appointments with conflict detection', async ({ page }) => {
      await adminHelper.navigateToSection('appointments')

      await test.step('Create new appointment', async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const appointmentData = {
          'customer-select': 'customer@test.local',
          'service-select': 'Herrenhaarschnitt',
          'staff-select': 'staff@test.local',
          'appointment-date': tomorrow.toISOString().split('T')[0],
          'appointment-time': '10:00',
          'notes': 'E2E test appointment'
        }

        await adminHelper.createRecord(appointmentData)
        
        // Verify appointment appears in calendar/list
        await expect(page.locator('[data-testid="appointments-list"]')).toContainText('E2E test appointment')
      })

      await test.step('Try to create conflicting appointment', async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const conflictingData = {
          'customer-select': 'customer@test.local',
          'service-select': 'Damenhaarschnitt',
          'staff-select': 'staff@test.local', // Same staff
          'appointment-date': tomorrow.toISOString().split('T')[0], // Same date
          'appointment-time': '10:00', // Same time
          'notes': 'Conflicting appointment'
        }

        await page.click('[data-testid="create-button"]')
        
        for (const [field, value] of Object.entries(conflictingData)) {
          await page.fill(`[data-testid="${field}"]`, String(value))
        }
        
        await page.click('[data-testid="save-button"]')
        
        // Should show conflict error
        await expect(page.locator('[data-testid="conflict-error"]')).toBeVisible()
        await expect(page.locator('[data-testid="conflict-error"]')).toContainText('Konflikt')
      })

      await test.step('Filter appointments by date range', async () => {
        const today = new Date()
        const nextWeek = new Date()
        nextWeek.setDate(today.getDate() + 7)
        
        await page.fill('[data-testid="date-filter-start"]', today.toISOString().split('T')[0])
        await page.fill('[data-testid="date-filter-end"]', nextWeek.toISOString().split('T')[0])
        await page.click('[data-testid="apply-date-filter"]')
        
        // Verify filtered results
        const appointments = page.locator('[data-testid*="appointment-row"]')
        await expect(appointments).toHaveCountGreaterThan(0)
      })

      await test.step('Cancel appointment', async () => {
        const firstAppointment = page.locator('[data-testid*="appointment-row"]').first()
        const appointmentId = await firstAppointment.getAttribute('data-testid')?.replace('appointment-row-', '') || ''
        
        await page.click(`[data-testid="cancel-${appointmentId}"]`)
        await page.fill('[data-testid="cancellation-reason"]', 'E2E test cancellation')
        await page.click('[data-testid="confirm-cancel"]')
        
        // Verify cancellation
        await expect(page.locator(`[data-testid="appointment-row-${appointmentId}"]`)).toHaveAttribute('data-status', 'cancelled')
      })
    })
  })

  test.describe('Media Management', () => {
    test('should manage media assets with Supabase Storage', async ({ page }) => {
      await adminHelper.navigateToSection('media')

      await test.step('Upload new media file', async () => {
        // Create a test file (mock image)
        const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        
        await page.click('[data-testid="upload-media"]')
        
        // Mock file upload
        await page.setInputFiles('[data-testid="file-input"]', {
          name: 'test-image.png',
          mimeType: 'image/png',
          buffer: Buffer.from(testImageData.split(',')[1], 'base64')
        })
        
        await page.fill('[data-testid="alt-text"]', 'E2E test image')
        await page.fill('[data-testid="tags"]', 'test, e2e')
        
        await page.click('[data-testid="upload-button"]')
        await expect(page.locator('[data-testid="upload-success"]')).toBeVisible()
      })

      await test.step('Filter media by type', async () => {
        await adminHelper.filterRecords('type', 'image')
        
        // Verify only images are shown
        const mediaItems = page.locator('[data-testid*="media-item"]')
        const mediaTypes = await mediaItems.locator('[data-testid="media-type"]').allTextContents()
        
        mediaTypes.forEach(type => {
          expect(type.toLowerCase()).toContain('image')
        })
      })

      await test.step('Search media by tags', async () => {
        await adminHelper.searchRecords('test')
        
        // Verify search results
        await expect(page.locator('[data-testid="media-list"]')).toContainText('E2E test image')
      })

      await test.step('Update media metadata', async () => {
        const firstMedia = page.locator('[data-testid*="media-item"]').first()
        const mediaId = await firstMedia.getAttribute('data-testid')?.replace('media-item-', '') || ''
        
        await adminHelper.updateRecord(mediaId, {
          'alt-text': 'Updated E2E test image',
          'tags': 'test, e2e, updated'
        })
        
        // Verify updates
        await expect(page.locator(`[data-testid="media-item-${mediaId}"]`)).toContainText('Updated E2E test image')
      })

      await test.step('Delete media file', async () => {
        const firstMedia = page.locator('[data-testid*="media-item"]').first()
        const mediaId = await firstMedia.getAttribute('data-testid')?.replace('media-item-', '') || ''
        
        await adminHelper.deleteRecord(mediaId)
        
        // Verify media is removed
        await expect(page.locator(`[data-testid="media-item-${mediaId}"]`)).toHaveCount(0)
      })
    })
  })

  test.describe('Settings Management', () => {
    test('should manage business settings', async ({ page }) => {
      await adminHelper.navigateToSection('settings')

      await test.step('Update business hours', async () => {
        await page.click('[data-testid="business-hours-tab"]')
        
        // Update Monday hours
        await page.fill('[data-testid="monday-open"]', '08:00')
        await page.fill('[data-testid="monday-close"]', '18:00')
        
        await page.click('[data-testid="save-business-hours"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })

      await test.step('Update booking settings', async () => {
        await page.click('[data-testid="booking-settings-tab"]')
        
        await page.fill('[data-testid="booking-window-days"]', '21')
        await page.fill('[data-testid="buffer-minutes"]', '10')
        await page.fill('[data-testid="cancellation-hours"]', '12')
        
        await page.click('[data-testid="save-booking-settings"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })

      await test.step('Test SMTP configuration', async () => {
        await page.click('[data-testid="notifications-tab"]')
        
        await page.fill('[data-testid="smtp-host"]', 'smtp.test.local')
        await page.fill('[data-testid="smtp-port"]', '587')
        await page.fill('[data-testid="smtp-user"]', 'test@test.local')
        
        // Test SMTP connection (should be mocked)
        await page.click('[data-testid="test-smtp"]')
        await expect(page.locator('[data-testid="smtp-test-result"]')).toBeVisible()
      })

      await test.step('Manage notification templates', async () => {
        await page.click('[data-testid="templates-tab"]')
        
        // Update booking confirmation template
        await page.click('[data-testid="edit-booking-confirmation-template"]')
        await page.fill('[data-testid="template-subject"]', 'E2E Test: Booking Confirmed')
        await page.fill('[data-testid="template-body"]', 'Your booking has been confirmed. E2E Test.')
        
        await page.click('[data-testid="save-template"]')
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      })
    })
  })

  test.describe('Pagination and Bulk Operations', () => {
    test('should handle pagination correctly', async ({ page }) => {
      await adminHelper.navigateToSection('customers')

      await test.step('Navigate through pages', async () => {
        const initialCount = await adminHelper.getRecordCount()
        
        if (initialCount > 10) { // Assuming page size is 10
          await adminHelper.changePage(2)
          
          // Verify we're on page 2
          await expect(page.locator('[data-testid="current-page"]')).toContainText('2')
          
          // Verify different records are shown
          const page2Records = page.locator('[data-testid*="customer-row"]')
          await expect(page2Records).toHaveCountGreaterThan(0)
        }
      })
    })

    test('should perform bulk operations', async ({ page }) => {
      await adminHelper.navigateToSection('customers')

      await test.step('Select multiple customers for bulk action', async () => {
        // Select first 3 customers
        const customerCheckboxes = page.locator('[data-testid*="customer-checkbox"]')
        await customerCheckboxes.nth(0).check()
        await customerCheckboxes.nth(1).check()
        await customerCheckboxes.nth(2).check()
        
        // Verify bulk actions become available
        await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible()
        
        // Test bulk export
        await page.click('[data-testid="bulk-export"]')
        await expect(page.locator('[data-testid="export-started"]')).toBeVisible()
      })
    })
  })
})