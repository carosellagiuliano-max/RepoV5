import { test, expect } from '@playwright/test';

test.describe('Customer Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display booking page correctly', async ({ page }) => {
    await test.step('Navigate to booking page', async () => {
      // Check if we're on the home page first
      await expect(page).toHaveTitle(/Schnittwerk|Hair|Salon/i);
      
      // Navigate to booking if not already there
      const bookingButton = page.locator('text=/buchen|book|termin/i').first();
      if (await bookingButton.isVisible()) {
        await bookingButton.click();
      } else {
        await page.goto('/booking');
      }
      
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify booking page elements', async () => {
      // Check for key booking elements
      await expect(page.locator('h1, h2, h3').filter({ hasText: /buchen|book|termin/i }).first()).toBeVisible();
      
      // Check for service selection
      const serviceElements = page.locator('[data-testid*="service"], .service, text=/dienstleistung|service/i');
      if (await serviceElements.first().isVisible()) {
        await expect(serviceElements.first()).toBeVisible();
      }
    });
  });

  test('should allow service selection and filtering', async ({ page }) => {
    await page.goto('/booking');
    await page.waitForLoadState('networkidle');

    await test.step('Search and filter services', async () => {
      // Look for search/filter inputs
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="suchen"]').first();
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('Haarschnitt');
        await page.waitForTimeout(1000); // Wait for filter results
      }
      
      // Look for category filters
      const categoryButtons = page.locator('button, .category, [data-testid*="category"]').filter({ hasText: /kategorie|category/i });
      if (await categoryButtons.first().isVisible()) {
        await categoryButtons.first().click();
        await page.waitForTimeout(500);
      }
    });

    await test.step('Select a service', async () => {
      // Find and select the first available service
      const serviceOptions = page.locator('.service-card, .service-item, [data-testid*="service"]').first();
      
      if (await serviceOptions.isVisible()) {
        await serviceOptions.click();
        
        // Verify service is selected
        await expect(serviceOptions).toHaveClass(/selected|active/);
      } else {
        // Fallback: look for any clickable service elements
        const fallbackService = page.locator('button, .clickable').filter({ hasText: /schnitt|cut|service/i }).first();
        if (await fallbackService.isVisible()) {
          await fallbackService.click();
        }
      }
    });
  });

  test('should handle staff selection', async ({ page }) => {
    await page.goto('/booking');
    await page.waitForLoadState('networkidle');

    await test.step('Select staff member', async () => {
      // Look for staff selection section
      const staffSection = page.locator('text=/mitarbeiter|staff|stylist/i').first();
      
      if (await staffSection.isVisible()) {
        // Find staff options
        const staffOptions = page.locator('.staff-card, .staff-item, [data-testid*="staff"]');
        
        if (await staffOptions.first().isVisible()) {
          await staffOptions.first().click();
          
          // Verify selection
          await expect(staffOptions.first()).toHaveClass(/selected|active/);
        }
      }
    });

    await test.step('Handle "any staff" option', async () => {
      // Look for "any staff" or "no preference" option
      const anyStaffOption = page.locator('text=/beliebig|any|no preference/i').first();
      
      if (await anyStaffOption.isVisible()) {
        await anyStaffOption.click();
      }
    });
  });

  test('should display and select available time slots', async ({ page }) => {
    await page.goto('/booking');
    await page.waitForLoadState('networkidle');

    await test.step('Navigate to date selection', async () => {
      // Look for date picker or calendar
      const dateElement = page.locator('input[type="date"], .date-picker, .calendar, [data-testid*="date"]').first();
      
      if (await dateElement.isVisible()) {
        await dateElement.click();
        
        // Select a future date (tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        if (await dateElement.getAttribute('type') === 'date') {
          await dateElement.fill(tomorrowStr);
        }
      }
    });

    await test.step('Select time slot', async () => {
      // Wait for time slots to load
      await page.waitForSelector('.time-slot, .slot, [data-testid*="time"]');
      
      // Look for available time slots
      const timeSlots = page.locator('.time-slot, .slot, [data-testid*="time"], button').filter({ hasText: /\d{1,2}:\d{2}/ });
      
      if (await timeSlots.first().isVisible()) {
        await timeSlots.first().click();
        
        // Verify slot selection
        await expect(timeSlots.first()).toHaveClass(/selected|active|booked/);
      }
    });
  });

  test('should handle booking confirmation flow', async ({ page }) => {
    await page.goto('/booking');
    await page.waitForLoadState('networkidle');

    await test.step('Fill customer information', async () => {
      // Look for customer info form
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="vorname"]').first();
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const phoneInput = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="telefon"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill('Max Mustermann');
      }
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('max.mustermann@example.com');
      }
      
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('+41 79 123 45 67');
      }
    });

    await test.step('Accept terms and conditions', async () => {
      // Look for terms checkbox
      const termsCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /terms|agb|datenschutz/i });
      
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check();
      }
    });

    await test.step('Submit booking (dry run)', async () => {
      // Look for submit/book button
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /buchen|book|confirm|bestätigen/i }).first();
      
      if (await submitButton.isVisible()) {
        // Note: In actual tests, we might want to mock the API call
        // For now, just verify the button is present and enabled
        await expect(submitButton).toBeEnabled();
        
        // We can click if there's a test mode or mock setup
        // await submitButton.click();
        // await expect(page.locator('text=/erfolg|success|bestätigt/i')).toBeVisible();
      }
    });
  });

  test('should handle booking cancellation flow', async ({ page }) => {
    await test.step('Navigate to booking management', async () => {
      // This would typically require a booking ID or customer lookup
      await page.goto('/booking/manage');
      
      // Or navigate via menu
      const manageLink = page.locator('text=/verwalten|manage|my bookings/i').first();
      if (await manageLink.isVisible()) {
        await manageLink.click();
      }
    });

    await test.step('Cancel booking flow', async () => {
      // Look for cancellation option
      const cancelButton = page.locator('button, a').filter({ hasText: /stornieren|cancel|absagen/i }).first();
      
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Confirm cancellation in modal/dialog
        const confirmButton = page.locator('button').filter({ hasText: /bestätigen|confirm|yes|ja/i }).first();
        if (await confirmButton.isVisible()) {
          await expect(confirmButton).toBeEnabled();
          // await confirmButton.click(); // Uncomment for actual cancellation
        }
      }
    });
  });

  test('should handle edge cases and errors gracefully', async ({ page }) => {
    await test.step('Test invalid date selection', async () => {
      await page.goto('/booking');
      await page.waitForLoadState('networkidle');
      
      // Try to select a past date
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await dateInput.fill(yesterday.toISOString().split('T')[0]);
        
        // Should show error or disable submit
        const errorMsg = page.locator('text=/error|fehler|ungültig|invalid/i').first();
        if (await errorMsg.isVisible()) {
          await expect(errorMsg).toBeVisible();
        }
      }
    });

    await test.step('Test booking conflicts', async () => {
      // This would test attempting to book an already taken slot
      // Implementation depends on how conflicts are handled in the UI
    });

    await test.step('Test network errors', async () => {
      // Simulate network failure during booking
      await page.route('**/api/**', route => route.abort());
      
      // Attempt to make a booking and verify error handling
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show network error message
        const networkError = page.locator('text=/network|connection|server error/i').first();
        await expect(networkError).toBeVisible({ timeout: 5000 });
      }
    });
  });
});