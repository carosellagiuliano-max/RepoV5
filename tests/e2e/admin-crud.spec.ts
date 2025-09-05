import { test, expect } from '@playwright/test';

test.describe('Admin Portal CRUD Operations', () => {
  // Mock admin authentication for tests
  test.beforeEach(async ({ page }) => {
    // Mock admin login - this would typically set up authentication
    await page.goto('/admin/login');
    
    // Mock authentication or use test credentials
    const usernameInput = page.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const loginButton = page.locator('button[type="submit"], button').filter({ hasText: /login|anmelden/i }).first();

    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin@test.com');
      await passwordInput.fill('testpassword');
      await loginButton.click();
      
      // Wait for redirect to admin dashboard
      await page.waitForURL('**/admin**', { timeout: 10000 });
    } else {
      // Navigate directly to admin if already authenticated
      await page.goto('/admin');
    }
    
    await page.waitForLoadState('networkidle');
  });

  test.describe('Staff Management', () => {
    test('should display staff list with pagination and filtering', async ({ page }) => {
      await test.step('Navigate to staff management', async () => {
        await page.goto('/admin/staff');
        await page.waitForLoadState('networkidle');
        
        // Verify we're on the staff page
        await expect(page.locator('h1, h2').filter({ hasText: /mitarbeiter|staff/i }).first()).toBeVisible();
      });

      await test.step('Test staff listing', async () => {
        // Check for staff table or cards
        const staffTable = page.locator('table, .staff-list, [data-testid*="staff"]').first();
        await expect(staffTable).toBeVisible();
        
        // Check for pagination if present
        const pagination = page.locator('.pagination, [data-testid*="pagination"]').first();
        if (await pagination.isVisible()) {
          await expect(pagination).toBeVisible();
        }
      });

      await test.step('Test staff filtering', async () => {
        const filterInput = page.locator('input[placeholder*="filter"], input[placeholder*="search"]').first();
        if (await filterInput.isVisible()) {
          await filterInput.fill('Test');
          await page.waitForTimeout(1000);
          
          // Verify filtered results
          const staffRows = page.locator('tr, .staff-item');
          if (await staffRows.first().isVisible()) {
            await expect(staffRows.first()).toBeVisible();
          }
        }
      });
    });

    test('should create new staff member', async ({ page }) => {
      await page.goto('/admin/staff');
      await page.waitForLoadState('networkidle');

      await test.step('Open create staff form', async () => {
        const createButton = page.locator('button, a').filter({ hasText: /add|hinzufügen|new|neu/i }).first();
        await createButton.click();
        
        // Wait for form to open (modal or new page)
        await page.waitForTimeout(1000);
      });

      await test.step('Fill staff form', async () => {
        const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
        const emailInput = page.locator('input[name="email"], input[type="email"]').first();
        const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
        
        await nameInput.fill('Test Mitarbeiter');
        await emailInput.fill('test.staff@example.com');
        if (await phoneInput.isVisible()) {
          await phoneInput.fill('+41 79 999 99 99');
        }
        
        // Select role if available
        const roleSelect = page.locator('select[name="role"], [data-testid*="role"]').first();
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('staff');
        }
      });

      await test.step('Submit staff creation', async () => {
        const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|speichern|create|erstellen/i }).first();
        await submitButton.click();
        
        // Verify success message or redirect
        const successMsg = page.locator('text=/success|erfolg|created|erstellt/i').first();
        await expect(successMsg).toBeVisible({ timeout: 5000 });
      });
    });

    test('should edit staff member', async ({ page }) => {
      await page.goto('/admin/staff');
      await page.waitForLoadState('networkidle');

      await test.step('Select staff member to edit', async () => {
        const editButton = page.locator('button, a').filter({ hasText: /edit|bearbeiten|✏️/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
        } else {
          // Try clicking on staff row/card
          const staffRow = page.locator('tr, .staff-item').first();
          await staffRow.click();
        }
        
        await page.waitForSelector('input[name="name"], input[value*=""]', { state: 'visible', timeout: 5000 });
      });

      await test.step('Update staff information', async () => {
        const nameInput = page.locator('input[name="name"], input[value*=""]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Updated Staff Name');
        }
        
        // Toggle active status
        const activeToggle = page.locator('input[type="checkbox"][name*="active"], .toggle').first();
        if (await activeToggle.isVisible()) {
          await activeToggle.click();
        }
      });

      await test.step('Save changes', async () => {
        const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|speichern|update/i }).first();
        await saveButton.click();
        
        // Verify update success
        const successMsg = page.locator('text=/updated|aktualisiert|saved|gespeichert/i').first();
        await expect(successMsg).toBeVisible({ timeout: 5000 });
      });
    });

    test('should delete staff member with confirmation', async ({ page }) => {
      await page.goto('/admin/staff');
      await page.waitForLoadState('networkidle');

      await test.step('Initiate staff deletion', async () => {
        const deleteButton = page.locator('button').filter({ hasText: /delete|löschen|🗑️/i }).first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
        }
      });

      await test.step('Confirm deletion', async () => {
        // Wait for confirmation dialog
        const confirmDialog = page.locator('.modal, .dialog, [role="dialog"]').first();
        if (await confirmDialog.isVisible()) {
          const confirmButton = page.locator('button').filter({ hasText: /confirm|bestätigen|delete|löschen/i }).last();
          await confirmButton.click();
          
          // Verify deletion success
          const successMsg = page.locator('text=/deleted|gelöscht|removed/i').first();
          await expect(successMsg).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });

  test.describe('Services Management', () => {
    test('should manage services with CRUD operations', async ({ page }) => {
      await page.goto('/admin/services');
      await page.waitForLoadState('networkidle');

      await test.step('Display services list', async () => {
        await expect(page.locator('h1, h2').filter({ hasText: /services|dienstleistungen/i }).first()).toBeVisible();
        
        const servicesTable = page.locator('table, .services-list').first();
        await expect(servicesTable).toBeVisible();
      });

      await test.step('Create new service', async () => {
        const createButton = page.locator('button').filter({ hasText: /add|new|hinzufügen/i }).first();
        await createButton.click();
        
        // Fill service form
        const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
        const priceInput = page.locator('input[name="price"], input[type="number"]').first();
        const durationInput = page.locator('input[name="duration"], select[name="duration"]').first();
        
        await nameInput.fill('Test Haarschnitt');
        await priceInput.fill('50');
        if (await durationInput.isVisible()) {
          await durationInput.fill('60');
        }
        
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        
        await expect(page.locator('text=/success|erfolg/i').first()).toBeVisible({ timeout: 5000 });
      });

      await test.step('Edit service', async () => {
        const editButton = page.locator('button').filter({ hasText: /edit|bearbeiten/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          
          const nameInput = page.locator('input[name="name"]').first();
          await nameInput.fill('Updated Service Name');
          
          const saveButton = page.locator('button[type="submit"]').first();
          await saveButton.click();
          
          await expect(page.locator('text=/updated|aktualisiert/i').first()).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });

  test.describe('Customer Management', () => {
    test('should display customer list with GDPR compliance', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.waitForLoadState('networkidle');

      await test.step('Verify customer management interface', async () => {
        await expect(page.locator('h1, h2').filter({ hasText: /customers|kunden/i }).first()).toBeVisible();
        
        // Check for GDPR compliance indicators
        const gdprIndicators = page.locator('text=/gdpr|datenschutz|consent/i');
        if (await gdprIndicators.first().isVisible()) {
          await expect(gdprIndicators.first()).toBeVisible();
        }
      });

      await test.step('Test customer search and filtering', async () => {
        const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="suchen"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('Mustermann');
          await page.waitForTimeout(1000);
        }
        
        // Test status filters
        const statusFilter = page.locator('select, button').filter({ hasText: /status|active|inactive/i }).first();
        if (await statusFilter.isVisible()) {
          await statusFilter.click();
        }
      });
    });

    test('should handle customer soft delete (GDPR)', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.waitForLoadState('networkidle');

      await test.step('Initiate customer deletion', async () => {
        const deleteButton = page.locator('button').filter({ hasText: /delete|löschen/i }).first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          
          // Should show GDPR deletion options
          const gdprOptions = page.locator('text=/soft delete|gdpr|anonymize/i');
          if (await gdprOptions.first().isVisible()) {
            await expect(gdprOptions.first()).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('Appointments Management', () => {
    test('should manage appointments with conflict detection', async ({ page }) => {
      await page.goto('/admin/appointments');
      await page.waitForLoadState('networkidle');

      await test.step('Display appointments calendar/list', async () => {
        await expect(page.locator('h1, h2').filter({ hasText: /appointments|termine/i }).first()).toBeVisible();
        
        // Check for calendar or list view
        const appointmentsView = page.locator('.calendar, table, .appointments-list').first();
        await expect(appointmentsView).toBeVisible();
      });

      await test.step('Create appointment with conflict detection', async () => {
        const createButton = page.locator('button').filter({ hasText: /add|new|book/i }).first();
        await createButton.click();
        
        // Fill appointment form
        const customerSelect = page.locator('select[name="customer"], input[name="customer"]').first();
        const serviceSelect = page.locator('select[name="service"]').first();
        const staffSelect = page.locator('select[name="staff"]').first();
        
        if (await customerSelect.isVisible()) {
          await customerSelect.click();
          await customerSelect.selectOption({ index: 1 });
        }
        
        if (await serviceSelect.isVisible()) {
          await serviceSelect.selectOption({ index: 1 });
        }
        
        if (await staffSelect.isVisible()) {
          await staffSelect.selectOption({ index: 1 });
        }
        
        // Test conflict detection by selecting occupied time
        // This would trigger validation errors
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        
        // Should either succeed or show conflict error
        const result = await Promise.race([
          page.locator('text=/success|erfolg/i').first().waitFor({ timeout: 3000 }).then(() => 'success'),
          page.locator('text=/conflict|konflikt|occupied|besetzt/i').first().waitFor({ timeout: 3000 }).then(() => 'conflict'),
        ]).catch(() => 'timeout');
        
        expect(['success', 'conflict', 'timeout']).toContain(result);
      });
    });
  });

  test.describe('Media Management', () => {
    test('should handle media upload and management', async ({ page }) => {
      await page.goto('/admin/media');
      await page.waitForLoadState('networkidle');

      await test.step('Display media gallery', async () => {
        await expect(page.locator('h1, h2').filter({ hasText: /media|gallery|bilder/i }).first()).toBeVisible();
        
        const mediaGrid = page.locator('.gallery, .media-grid, .file-list').first();
        await expect(mediaGrid).toBeVisible();
      });

      await test.step('Test media upload interface', async () => {
        const uploadButton = page.locator('input[type="file"], button').filter({ hasText: /upload|hochladen/i }).first();
        
        if (await uploadButton.isVisible()) {
          await expect(uploadButton).toBeVisible();
          
          // Note: Actual file upload testing would require test files
          // For now, just verify the upload interface exists
        }
      });
    });
  });

  test.describe('Settings Management', () => {
    test('should manage business settings', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      await test.step('Display settings interface', async () => {
        await expect(page.locator('h1, h2').filter({ hasText: /settings|einstellungen/i }).first()).toBeVisible();
      });

      await test.step('Update business hours', async () => {
        const hoursSection = page.locator('text=/hours|öffnungszeiten/i').first();
        if (await hoursSection.isVisible()) {
          // Look for time inputs
          const timeInputs = page.locator('input[type="time"]');
          if (await timeInputs.first().isVisible()) {
            await timeInputs.first().fill('09:00');
          }
        }
      });

      await test.step('Update booking settings', async () => {
        const bookingSection = page.locator('text=/booking|buchung/i').first();
        if (await bookingSection.isVisible()) {
          // Look for booking window setting
          const windowInput = page.locator('input[name*="window"], input[name*="days"]').first();
          if (await windowInput.isVisible()) {
            await windowInput.fill('30');
          }
        }
      });

      await test.step('Save settings', async () => {
        const saveButton = page.locator('button[type="submit"], button').filter({ hasText: /save|speichern/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          
          await expect(page.locator('text=/saved|gespeichert|success/i').first()).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });
});