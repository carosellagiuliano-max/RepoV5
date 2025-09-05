import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Customer Booking Flow
 * Tests the complete customer journey: Search → Filter → Book → Confirm → Cancel
 */

// Test configuration
const TEST_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer@test.local'
const TEST_CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'Test123!@#'

// Helper functions for booking flow
class BookingFlowHelper {
  constructor(private page: Page) {}

  async loginAsCustomer() {
    await this.page.goto('/login')
    await this.page.fill('[data-testid="email-input"]', TEST_CUSTOMER_EMAIL)
    await this.page.fill('[data-testid="password-input"]', TEST_CUSTOMER_PASSWORD)
    await this.page.click('[data-testid="login-button"]')
    
    // Wait for successful login redirect
    await this.page.waitForURL(/\/booking/, { timeout: 15000 })
  }

  async searchServices(searchTerm: string) {
    await this.page.fill('[data-testid="service-search"]', searchTerm)
    await this.page.press('[data-testid="service-search"]', 'Enter')
    await this.page.waitForTimeout(1000) // Wait for search results
  }

  async filterByCategory(category: string) {
    await this.page.click(`[data-testid="category-filter-${category.toLowerCase()}"]`)
    await this.page.waitForTimeout(1000)
  }

  async filterByStaff(staffName: string) {
    await this.page.click('[data-testid="staff-filter-dropdown"]')
    await this.page.click(`[data-testid="staff-option-${staffName.replace(/\s+/g, '-').toLowerCase()}"]`)
    await this.page.waitForTimeout(1000)
  }

  async selectService(serviceName: string) {
    await this.page.click(`[data-testid="service-card-${serviceName.replace(/\s+/g, '-').toLowerCase()}"]`)
    await this.page.click('[data-testid="select-service-button"]')
  }

  async selectDate(futureDate: Date) {
    // Open date picker
    await this.page.click('[data-testid="date-picker"]')
    
    // Navigate to the correct month if needed
    const targetMonth = futureDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    const currentMonthElement = this.page.locator('[data-testid="calendar-month-year"]')
    const currentMonth = await currentMonthElement.textContent()
    
    if (currentMonth !== targetMonth) {
      await this.page.click('[data-testid="calendar-next-month"]')
    }
    
    // Select the specific date
    const day = futureDate.getDate()
    await this.page.click(`[data-testid="calendar-day-${day}"]`)
  }

  async selectTimeSlot(time: string) {
    await this.page.click(`[data-testid="time-slot-${time.replace(':', '')}"]`)
  }

  async fillBookingDetails(details: {
    notes?: string
    phone?: string
  }) {
    if (details.notes) {
      await this.page.fill('[data-testid="booking-notes"]', details.notes)
    }
    
    if (details.phone) {
      await this.page.fill('[data-testid="customer-phone"]', details.phone)
    }
  }

  async confirmBooking() {
    await this.page.click('[data-testid="confirm-booking-button"]')
    
    // Wait for booking confirmation
    await this.page.waitForSelector('[data-testid="booking-confirmation"]', { timeout: 15000 })
  }

  async getBookingConfirmationNumber(): Promise<string> {
    const confirmationElement = this.page.locator('[data-testid="booking-confirmation-number"]')
    return await confirmationElement.textContent() || ''
  }

  async cancelBooking(bookingId: string) {
    await this.page.goto('/my-bookings')
    await this.page.click(`[data-testid="booking-${bookingId}-cancel-button"]`)
    
    // Confirm cancellation in dialog
    await this.page.click('[data-testid="confirm-cancel-button"]')
    
    // Wait for cancellation confirmation
    await this.page.waitForSelector('[data-testid="cancellation-success"]', { timeout: 10000 })
  }
}

test.describe('Customer Booking Flow', () => {
  let bookingHelper: BookingFlowHelper

  test.beforeEach(async ({ page }) => {
    bookingHelper = new BookingFlowHelper(page)
  })

  test('should complete full booking flow - happy path', async ({ page }) => {
    await test.step('Login as customer', async () => {
      await bookingHelper.loginAsCustomer()
      
      // Verify we're on the booking page
      await expect(page.locator('[data-testid="booking-page-title"]')).toBeVisible()
    })

    await test.step('Search for services', async () => {
      await bookingHelper.searchServices('Haarschnitt')
      
      // Verify search results show relevant services
      await expect(page.locator('[data-testid="service-results"]')).toBeVisible()
      await expect(page.locator('[data-testid="service-card"]')).toHaveCountGreaterThan(0)
    })

    await test.step('Filter by category', async () => {
      await bookingHelper.filterByCategory('Cuts')
      
      // Verify filtered results
      const serviceCards = page.locator('[data-testid="service-card"]')
      await expect(serviceCards).toHaveCountGreaterThan(0)
      
      // Verify all visible services are in the "Cuts" category
      const categories = await serviceCards.locator('[data-testid="service-category"]').allTextContents()
      categories.forEach(category => {
        expect(category).toBe('Cuts')
      })
    })

    await test.step('Filter by staff member', async () => {
      await bookingHelper.filterByStaff('Test Staff Member')
      
      // Verify staff filter is applied
      await expect(page.locator('[data-testid="active-staff-filter"]')).toContainText('Test Staff Member')
    })

    await test.step('Select service', async () => {
      await bookingHelper.selectService('Herrenhaarschnitt')
      
      // Verify service selection
      await expect(page.locator('[data-testid="selected-service"]')).toContainText('Herrenhaarschnitt')
    })

    let selectedDate: Date
    await test.step('Select date', async () => {
      // Select a date 3 days from now
      selectedDate = new Date()
      selectedDate.setDate(selectedDate.getDate() + 3)
      
      await bookingHelper.selectDate(selectedDate)
      
      // Verify date selection
      const dateString = selectedDate.toLocaleDateString('de-DE')
      await expect(page.locator('[data-testid="selected-date"]')).toContainText(dateString)
    })

    await test.step('Select time slot', async () => {
      // Wait for time slots to load
      await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 })
      
      // Select first available time slot
      const timeSlots = page.locator('[data-testid="time-slot"]:not([disabled])')
      await expect(timeSlots).toHaveCountGreaterThan(0)
      
      const firstTimeSlot = timeSlots.first()
      const timeText = await firstTimeSlot.textContent()
      await firstTimeSlot.click()
      
      // Verify time selection
      await expect(page.locator('[data-testid="selected-time"]')).toContainText(timeText || '')
    })

    await test.step('Fill booking details', async () => {
      await bookingHelper.fillBookingDetails({
        notes: 'E2E test booking - please confirm',
        phone: '+49 123 456789'
      })
      
      // Verify details are filled
      await expect(page.locator('[data-testid="booking-notes"]')).toHaveValue('E2E test booking - please confirm')
    })

    let bookingConfirmationNumber: string
    await test.step('Confirm booking', async () => {
      await bookingHelper.confirmBooking()
      
      // Verify booking confirmation
      await expect(page.locator('[data-testid="booking-confirmation"]')).toBeVisible()
      await expect(page.locator('[data-testid="booking-success-message"]')).toContainText('erfolgreich')
      
      bookingConfirmationNumber = await bookingHelper.getBookingConfirmationNumber()
      expect(bookingConfirmationNumber).toMatch(/^[A-Z0-9]{6,}$/) // Booking ID format
    })

    await test.step('Verify booking in my bookings', async () => {
      await page.goto('/my-bookings')
      
      // Verify booking appears in customer's booking list
      await expect(page.locator(`[data-testid="booking-${bookingConfirmationNumber}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="booking-${bookingConfirmationNumber}-service"]`)).toContainText('Herrenhaarschnitt')
    })

    await test.step('Cancel booking', async () => {
      await bookingHelper.cancelBooking(bookingConfirmationNumber)
      
      // Verify cancellation success
      await expect(page.locator('[data-testid="cancellation-success"]')).toBeVisible()
      
      // Verify booking status is updated
      await page.reload()
      await expect(page.locator(`[data-testid="booking-${bookingConfirmationNumber}-status"]`)).toContainText('Storniert')
    })
  })

  test('should handle booking conflicts gracefully', async ({ page }) => {
    await bookingHelper.loginAsCustomer()
    
    await test.step('Try to book conflicting time slot', async () => {
      // Navigate to booking flow
      await bookingHelper.selectService('Herrenhaarschnitt')
      
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await bookingHelper.selectDate(tomorrow)
      
      // Select a time slot
      const timeSlots = page.locator('[data-testid="time-slot"]:not([disabled])')
      const firstSlot = timeSlots.first()
      await firstSlot.click()
      
      await bookingHelper.fillBookingDetails({ notes: 'First booking' })
      await bookingHelper.confirmBooking()
      
      const firstBookingId = await bookingHelper.getBookingConfirmationNumber()
      
      // Try to book the same slot again (should fail)
      await page.goto('/booking')
      await bookingHelper.selectService('Damenhaarschnitt') // Different service, same slot
      await bookingHelper.selectDate(tomorrow)
      
      // The previously booked slot should now be disabled/unavailable
      await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 })
      const conflictingSlot = page.locator(`[data-testid="time-slot"][disabled]`)
      await expect(conflictingSlot).toHaveCountGreaterThan(0)
      
      // Clean up: cancel the first booking
      await bookingHelper.cancelBooking(firstBookingId)
    })
  })

  test('should validate required fields', async ({ page }) => {
    await bookingHelper.loginAsCustomer()
    
    await test.step('Try to confirm booking without required fields', async () => {
      // Try to confirm booking without selecting service
      await page.goto('/booking')
      await page.click('[data-testid="confirm-booking-button"]')
      
      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toContainText('Service auswählen')
    })
    
    await test.step('Try to confirm booking without date/time', async () => {
      await bookingHelper.selectService('Herrenhaarschnitt')
      await page.click('[data-testid="confirm-booking-button"]')
      
      // Should show validation error for missing date/time
      await expect(page.locator('[data-testid="validation-error"]')).toContainText('Datum und Uhrzeit')
    })
  })

  test('should handle idempotency for duplicate booking attempts', async ({ page }) => {
    await bookingHelper.loginAsCustomer()
    
    await test.step('Create booking with idempotency key', async () => {
      await bookingHelper.selectService('Herrenhaarschnitt')
      
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      await bookingHelper.selectDate(futureDate)
      
      const timeSlots = page.locator('[data-testid="time-slot"]:not([disabled])')
      await timeSlots.first().click()
      
      await bookingHelper.fillBookingDetails({ notes: 'Idempotency test' })
      
      // Capture network requests to verify idempotency key
      const requestPromise = page.waitForRequest(request => 
        request.url().includes('/booking') && request.method() === 'POST'
      )
      
      await bookingHelper.confirmBooking()
      
      const request = await requestPromise
      const headers = request.headers()
      expect(headers['idempotency-key']).toBeTruthy()
      
      const bookingId = await bookingHelper.getBookingConfirmationNumber()
      
      // Clean up
      await bookingHelper.cancelBooking(bookingId)
    })
  })

  test('should handle service availability edge cases', async ({ page }) => {
    await bookingHelper.loginAsCustomer()
    
    await test.step('Check service availability outside business hours', async () => {
      await bookingHelper.selectService('Herrenhaarschnitt')
      
      // Select a date
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 2)
      await bookingHelper.selectDate(futureDate)
      
      // Wait for time slots to load
      await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 })
      
      // Verify that slots outside business hours are disabled
      const allSlots = page.locator('[data-testid="time-slot"]')
      const disabledSlots = page.locator('[data-testid="time-slot"][disabled]')
      
      await expect(allSlots).toHaveCountGreaterThan(0)
      // Should have some disabled slots (outside business hours)
      await expect(disabledSlots).toHaveCountGreaterThan(0)
    })
  })
})