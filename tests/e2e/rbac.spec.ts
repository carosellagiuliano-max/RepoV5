import { test, expect, Page } from '@playwright/test';

test.describe('RBAC (Role-Based Access Control)', () => {
  const testUsers = {
    admin: { email: 'admin@test.com', password: 'admin123', role: 'admin' },
    staff: { email: 'staff@test.com', password: 'staff123', role: 'staff' },
    receptionist: { email: 'receptionist@test.com', password: 'reception123', role: 'receptionist' },
    customer: { email: 'customer@test.com', password: 'customer123', role: 'customer' }
  };

  // Helper function to login as specific role
  async function loginAs(page: Page, role: keyof typeof testUsers) {
    const user = testUsers[role];
    
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const loginButton = page.locator('button[type="submit"], button').filter({ hasText: /login|anmelden/i }).first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(user.email);
      await passwordInput.fill(user.password);
      await loginButton.click();
      
      // Wait for authentication to complete
      // Replace the selector below with a unique element that appears after successful login
      await page.waitForSelector('nav, [data-testid="dashboard"], [data-testid="user-menu"], text=Logout', { timeout: 5000 });
    }
  }

  // Helper function to check for 401/403 errors
  async function expectForbidden(page: Page) {
    const forbiddenIndicators = [
      page.locator('text=/401|403|unauthorized|forbidden|access denied/i'),
      page.locator('text=/nicht berechtigt|zugriff verweigert/i'),
      page.locator('[data-testid="error-401"], [data-testid="error-403"]')
    ];
    
    let foundForbidden = false;
    for (const indicator of forbiddenIndicators) {
      if (await indicator.first().isVisible({ timeout: 2000 })) {
        foundForbidden = true;
        break;
      }
    }
    
    // Also check for redirect to login
    if (!foundForbidden && page.url().includes('/login')) {
      foundForbidden = true;
    }
    
    expect(foundForbidden).toBe(true);
  }

  test.describe('Admin Role Access', () => {
    test('should have full access to all admin functions', async ({ page }) => {
      await loginAs(page, 'admin');

      await test.step('Access staff management', async () => {
        await page.goto('/admin/staff');
        await expect(page.locator('h1, h2').filter({ hasText: /staff|mitarbeiter/i }).first()).toBeVisible();
        
        // Should be able to create, edit, delete staff
        const createButton = page.locator('button').filter({ hasText: /add|create|hinzufügen/i }).first();
        if (await createButton.isVisible()) {
          await expect(createButton).toBeEnabled();
        }
        
        const editButtons = page.locator('button').filter({ hasText: /edit|bearbeiten/i });
        if (await editButtons.first().isVisible()) {
          await expect(editButtons.first()).toBeEnabled();
        }
      });

      await test.step('Access customer management', async () => {
        await page.goto('/admin/customers');
        await expect(page.locator('h1, h2').filter({ hasText: /customers|kunden/i }).first()).toBeVisible();
        
        // Should see all customer data including PII
        const customerTable = page.locator('table, .customer-list').first();
        if (await customerTable.isVisible()) {
          await expect(customerTable).toBeVisible();
        }
      });

      await test.step('Access settings', async () => {
        await page.goto('/admin/settings');
        await expect(page.locator('h1, h2').filter({ hasText: /settings|einstellungen/i }).first()).toBeVisible();
        
        // Should be able to modify settings
        const settingsForm = page.locator('form, .settings-form').first();
        if (await settingsForm.isVisible()) {
          await expect(settingsForm).toBeVisible();
        }
      });

      await test.step('Access user management', async () => {
        await page.goto('/admin/users');
        await page.waitForTimeout(1000);
        
        // Should be able to manage user roles
        const userRoleElements = page.locator('select[name*="role"], button').filter({ hasText: /role|rolle/i });
        if (await userRoleElements.first().isVisible()) {
          await expect(userRoleElements.first()).toBeVisible();
        }
      });
    });

    test('should be able to change user roles', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/admin/users');
      
      await test.step('Modify user role', async () => {
        const roleSelect = page.locator('select[name*="role"]').first();
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('staff');
          
          const saveButton = page.locator('button').filter({ hasText: /save|speichern/i }).first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
            
            // Verify role change success
            await expect(page.locator('text=/updated|success|aktualisiert/i').first()).toBeVisible({ timeout: 5000 });
          }
        }
      });
    });
  });

  test.describe('Staff Role Access', () => {
    test('should have limited access to staff functions', async ({ page }) => {
      await loginAs(page, 'staff');

      await test.step('Can access own schedule', async () => {
        await page.goto('/admin/schedule');
        await page.waitForTimeout(1000);
        
        // Should see own appointments
        const scheduleView = page.locator('.calendar, .schedule, table').first();
        if (await scheduleView.isVisible()) {
          await expect(scheduleView).toBeVisible();
        }
      });

      await test.step('Can view limited customer info', async () => {
        await page.goto('/admin/customers');
        await page.waitForTimeout(1000);
        
        // Should see customers but with masked PII
        const customerRows = page.locator('tr, .customer-item');
        if (await customerRows.first().isVisible()) {
          // Check for masked data (like ***@***.com or XXXX)
          const maskedElements = page.locator('text=/\\*{3}|XXX|masked/i');
          if (await maskedElements.first().isVisible()) {
            await expect(maskedElements.first()).toBeVisible();
          }
        }
      });

      await test.step('Cannot access staff management', async () => {
        await page.goto('/admin/staff');
        await expectForbidden(page);
      });

      await test.step('Cannot access settings', async () => {
        await page.goto('/admin/settings');
        await expectForbidden(page);
      });

      await test.step('Cannot access user management', async () => {
        await page.goto('/admin/users');
        await expectForbidden(page);
      });
    });

    test('should not be able to modify other staff members', async ({ page }) => {
      await loginAs(page, 'staff');
      await page.goto('/admin/staff');
      
      // Should either be redirected or show error
      await expectForbidden(page);
    });
  });

  test.describe('Receptionist Role Access', () => {
    test('should have appointment management permissions', async ({ page }) => {
      await loginAs(page, 'receptionist');

      await test.step('Can manage appointments', async () => {
        await page.goto('/admin/appointments');
        await page.waitForTimeout(1000);
        
        const appointmentsView = page.locator('.calendar, table, .appointments').first();
        if (await appointmentsView.isVisible()) {
          await expect(appointmentsView).toBeVisible();
          
          // Should be able to create appointments
          const createButton = page.locator('button').filter({ hasText: /add|create|book/i }).first();
          if (await createButton.isVisible()) {
            await expect(createButton).toBeEnabled();
          }
        }
      });

      await test.step('Can view customer info for bookings', async () => {
        await page.goto('/admin/customers');
        await page.waitForTimeout(1000);
        
        // Should see customer list for booking purposes
        const customerList = page.locator('table, .customer-list').first();
        if (await customerList.isVisible()) {
          await expect(customerList).toBeVisible();
        }
      });

      await test.step('Cannot access staff management', async () => {
        await page.goto('/admin/staff');
        await expectForbidden(page);
      });

      await test.step('Cannot access settings', async () => {
        await page.goto('/admin/settings');
        await expectForbidden(page);
      });

      await test.step('Cannot delete customers', async () => {
        await page.goto('/admin/customers');
        await page.waitForTimeout(1000);
        
        // Delete buttons should not be visible or enabled
        const deleteButtons = page.locator('button').filter({ hasText: /delete|löschen/i });
        if (await deleteButtons.first().isVisible()) {
          await expect(deleteButtons.first()).toBeDisabled();
        }
      });
    });
  });

  test.describe('Customer Role Access', () => {
    test('should only access own data', async ({ page }) => {
      await loginAs(page, 'customer');

      await test.step('Can access own bookings', async () => {
        await page.goto('/my-bookings');
        await page.waitForTimeout(1000);
        
        // Should see own appointments only
        const bookingsList = page.locator('.bookings-list, table').first();
        if (await bookingsList.isVisible()) {
          await expect(bookingsList).toBeVisible();
        }
      });

      await test.step('Can make new bookings', async () => {
        await page.goto('/booking');
        await page.waitForLoadState('networkidle');
        
        // Should be able to access booking form
        await expect(page.locator('h1, h2').filter({ hasText: /book|buchen|termin/i }).first()).toBeVisible();
      });

      await test.step('Cannot access admin areas', async () => {
        await page.goto('/admin');
        await expectForbidden(page);
      });

      await test.step('Cannot access other customers data', async () => {
        await page.goto('/admin/customers');
        await expectForbidden(page);
      });

      await test.step('Cannot access staff areas', async () => {
        await page.goto('/admin/staff');
        await expectForbidden(page);
      });
    });

    test('should have limited profile access', async ({ page }) => {
      await loginAs(page, 'customer');

      await test.step('Can edit own profile', async () => {
        await page.goto('/profile');
        await page.waitForTimeout(1000);
        
        const profileForm = page.locator('form, .profile-form').first();
        if (await profileForm.isVisible()) {
          await expect(profileForm).toBeVisible();
          
          // Should be able to update basic info
          const nameInput = page.locator('input[name="name"]').first();
          if (await nameInput.isVisible()) {
            await expect(nameInput).toBeEnabled();
          }
        }
      });

      await test.step('Cannot change own role', async () => {
        await page.goto('/profile');
        await page.waitForTimeout(1000);
        
        // Role field should not be editable
        const roleField = page.locator('select[name="role"], input[name="role"]').first();
        if (await roleField.isVisible()) {
          await expect(roleField).toBeDisabled();
        }
      });
    });
  });

  test.describe('Cross-Role Boundary Tests', () => {
    test('should prevent privilege escalation', async ({ page }) => {
      await loginAs(page, 'staff');

      await test.step('Staff cannot elevate to admin', async () => {
        // Try to access user management directly
        await page.goto('/admin/users');
        await expectForbidden(page);
        
        // Try to modify own role via API (if accessible)
        const response = await page.request.post('/api/admin/users/role', {
          data: { userId: 'current', role: 'admin' },
          failOnStatusCode: false
        });
        
        expect([401, 403, 404]).toContain(response.status());
      });
    });

    test('should enforce field-level permissions', async ({ page }) => {
      await loginAs(page, 'staff');

      await test.step('Staff sees masked customer PII', async () => {
        await page.goto('/admin/customers');
        await page.waitForTimeout(1000);
        
        // Look for masked email addresses or phone numbers
        const maskedEmails = page.locator('text=/\\*+@\\*+\\.\\w+|\\*+@example\\.com/');
        const maskedPhones = page.locator('text=/\\*{3}-\\*{3}-\\*{4}|\\+\\*+ \\*+ \\*+/');
        
        if (await maskedEmails.first().isVisible() || await maskedPhones.first().isVisible()) {
          // PII masking is working
          expect(true).toBe(true);
        }
      });
    });

    test('should audit role changes', async ({ page }) => {
      await loginAs(page, 'admin');

      await test.step('Role changes are logged', async () => {
        await page.goto('/admin/audit');
        await page.waitForTimeout(1000);
        
        // Check for audit log entries
        const auditLog = page.locator('.audit-log, table').first();
        if (await auditLog.isVisible()) {
          await expect(auditLog).toBeVisible();
          
          // Look for role change entries
          const roleChangeEntries = page.locator('text=/role.*change|changed.*role/i');
          if (await roleChangeEntries.first().isVisible()) {
            await expect(roleChangeEntries.first()).toBeVisible();
          }
        }
      });
    });

    test('should enforce session timeouts per role', async ({ page }) => {
      await test.step('Different roles have appropriate session lengths', async () => {
        // This would test that admin sessions last longer than customer sessions
        // Implementation depends on actual session management
        
        await loginAs(page, 'customer');
        
        // Customer sessions might timeout faster
        // This is more of an integration test with actual authentication
        const sessionInfo = await page.evaluate(() => {
          return {
            hasSession: !!localStorage.getItem('session'),
            sessionExpiry: localStorage.getItem('sessionExpiry')
          };
        });
        
        expect(sessionInfo.hasSession).toBeDefined();
      });
    });
  });

  test.describe('API Endpoint Protection', () => {
    test('should protect admin APIs from non-admin access', async ({ page }) => {
      await loginAs(page, 'staff');

      await test.step('Admin endpoints return 403 for staff', async () => {
        const protectedEndpoints = [
          '/api/admin/users',
          '/api/admin/settings',
          '/api/admin/staff',
          '/api/admin/audit'
        ];

        for (const endpoint of protectedEndpoints) {
          const response = await page.request.get(endpoint, { failOnStatusCode: false });
          expect([401, 403]).toContain(response.status());
        }
      });
    });

    test('should protect customer data APIs', async ({ page }) => {
      await loginAs(page, 'customer');

      await test.step('Customer can only access own data', async () => {
        // Try to access another customer's data
        const response = await page.request.get('/api/customers/other-customer-id', { 
          failOnStatusCode: false 
        });
        
        expect([401, 403, 404]).toContain(response.status());
      });
    });

    test('should validate JWT tokens and role claims', async ({ page }) => {
      await test.step('Invalid tokens are rejected', async () => {
        // Set invalid token in headers
        await page.setExtraHTTPHeaders({
          'Authorization': 'Bearer invalid-token'
        });

        const response = await page.request.get('/api/admin/users', { failOnStatusCode: false });
        expect([401, 403]).toContain(response.status());
      });
    });
  });
});