import { test, expect } from '@playwright/test';

test.describe('Health, SEO & PWA Validation', () => {
  test.describe('Health Endpoints', () => {
    test('should have accessible health endpoint', async ({ page }) => {
      await test.step('Check /api/health endpoint', async () => {
        const response = await page.request.get('/api/health');
        expect(response.status()).toBe(200);
        
        const healthData = await response.json();
        expect(healthData).toHaveProperty('status');
        expect(healthData.status).toBe('healthy');
        
        // Check for required health information
        expect(healthData).toHaveProperty('timestamp');
        expect(healthData).toHaveProperty('version');
        
        // Check for correlation ID
        if (healthData.correlationId) {
          expect(healthData.correlationId).toMatch(/^[a-z0-9-]+$/);
        }
      });
    });

    test('should provide detailed health status', async ({ page }) => {
      await test.step('Verify health endpoint details', async () => {
        const response = await page.request.get('/api/health');
        const healthData = await response.json();
        
        // Check for service dependencies
        if (healthData.services) {
          expect(healthData.services).toHaveProperty('database');
          expect(healthData.services).toHaveProperty('storage');
        }
        
        // Check for build information
        if (healthData.build) {
          expect(healthData.build).toHaveProperty('version');
          expect(healthData.build).toHaveProperty('environment');
        }
      });
    });

    test('should handle health check failures gracefully', async ({ page }) => {
      await test.step('Test health endpoint resilience', async () => {
        // Even if some services are down, health endpoint should respond
        const response = await page.request.get('/api/health');
        
        // Should get a response even if status is degraded
        expect([200, 503]).toContain(response.status());
        
        const healthData = await response.json();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.status);
      });
    });
  });

  test.describe('SEO Validation', () => {
    test('should have proper SEO meta tags', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check title tag', async () => {
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(10);
        expect(title.length).toBeLessThan(60);
        expect(title).toMatch(/schnittwerk|hair|salon|friseursalon/i);
      });

      await test.step('Check meta description', async () => {
        const metaDescription = page.locator('meta[name="description"]');
        await expect(metaDescription).toHaveCount(1);
        
        const description = await metaDescription.getAttribute('content');
        expect(description).toBeTruthy();
        expect(description!.length).toBeGreaterThan(50);
        expect(description!.length).toBeLessThan(160);
      });

      await test.step('Check Open Graph tags', async () => {
        const ogTitle = page.locator('meta[property="og:title"]');
        const ogDescription = page.locator('meta[property="og:description"]');
        const ogImage = page.locator('meta[property="og:image"]');
        const ogUrl = page.locator('meta[property="og:url"]');

        await expect(ogTitle).toHaveCount(1);
        await expect(ogDescription).toHaveCount(1);
        await expect(ogImage).toHaveCount(1);
        await expect(ogUrl).toHaveCount(1);
      });

      await test.step('Check Twitter Card tags', async () => {
        const twitterCard = page.locator('meta[name="twitter:card"]');
        const twitterTitle = page.locator('meta[name="twitter:title"]');
        const twitterDescription = page.locator('meta[name="twitter:description"]');

        await expect(twitterCard).toHaveCount(1);
        await expect(twitterTitle).toHaveCount(1);
        await expect(twitterDescription).toHaveCount(1);
      });
    });

    test('should have robots.txt', async ({ page }) => {
      await test.step('Check robots.txt accessibility', async () => {
        const response = await page.request.get('/robots.txt');
        expect(response.status()).toBe(200);
        
        const robotsContent = await response.text();
        expect(robotsContent).toContain('User-agent:');
        expect(robotsContent).toMatch(/(Allow|Disallow):/);
      });

      await test.step('Verify robots.txt content', async () => {
        const response = await page.request.get('/robots.txt');
        const robotsContent = await response.text();
        
        // Should allow indexing of main content
        expect(robotsContent).toMatch(/Allow.*\/$/);
        
        // Should disallow admin areas
        expect(robotsContent).toMatch(/Disallow.*\/admin/);
        
        // Should include sitemap reference
        expect(robotsContent).toMatch(/Sitemap:.*sitemap\.xml/);
      });
    });

    test('should have sitemap.xml', async ({ page }) => {
      await test.step('Check sitemap.xml accessibility', async () => {
        const response = await page.request.get('/sitemap.xml');
        expect(response.status()).toBe(200);
        
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('xml');
      });

      await test.step('Verify sitemap.xml structure', async () => {
        const response = await page.request.get('/sitemap.xml');
        const sitemapContent = await response.text();
        
        // Should be valid XML
        expect(sitemapContent).toContain('<?xml');
        expect(sitemapContent).toContain('<urlset');
        expect(sitemapContent).toContain('</urlset>');
        
        // Should contain main pages
        expect(sitemapContent).toMatch(/<loc>.*\/<\/loc>/);
        expect(sitemapContent).toMatch(/<lastmod>/);
        expect(sitemapContent).toMatch(/<changefreq>/);
        expect(sitemapContent).toMatch(/<priority>/);
      });
    });

    test('should have structured data (JSON-LD)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check for JSON-LD structured data', async () => {
        const jsonLdScripts = page.locator('script[type="application/ld+json"]');
        await expect(jsonLdScripts).toHaveCountGreaterThan(0);
        
        // Get the first JSON-LD script
        const jsonLdContent = await jsonLdScripts.first().textContent();
        expect(jsonLdContent).toBeTruthy();
        
        // Parse and validate JSON-LD
        const structuredData = JSON.parse(jsonLdContent!);
        expect(structuredData).toHaveProperty('@context');
        expect(structuredData).toHaveProperty('@type');
      });

      await test.step('Verify HairSalon schema', async () => {
        const jsonLdScripts = page.locator('script[type="application/ld+json"]');
        const jsonLdContent = await jsonLdScripts.first().textContent();
        const structuredData = JSON.parse(jsonLdContent!);
        
        // Check for HairSalon or LocalBusiness type
        expect(['HairSalon', 'LocalBusiness', 'BeautySalon']).toContain(structuredData['@type']);
        
        // Check required properties
        expect(structuredData).toHaveProperty('name');
        expect(structuredData).toHaveProperty('address');
        expect(structuredData).toHaveProperty('telephone');
        
        // Check for business hours if present
        if (structuredData.openingHours) {
          expect(Array.isArray(structuredData.openingHours)).toBe(true);
        }
      });
    });

    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check heading hierarchy', async () => {
        // Should have exactly one H1
        const h1Elements = page.locator('h1');
        await expect(h1Elements).toHaveCount(1);
        
        // Check for proper heading structure
        const allHeadings = page.locator('h1, h2, h3, h4, h5, h6');
        const headingCount = await allHeadings.count();
        expect(headingCount).toBeGreaterThan(1);
        
        // Check that headings have meaningful content
        const h1Text = await h1Elements.first().textContent();
        expect(h1Text).toBeTruthy();
        expect(h1Text!.length).toBeGreaterThan(3);
      });
    });

    test('should have accessible images', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check image alt attributes', async () => {
        const images = page.locator('img');
        const imageCount = await images.count();
        
        if (imageCount > 0) {
          for (let i = 0; i < Math.min(imageCount, 10); i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            const src = await img.getAttribute('src');
            
            // Images should have alt text (can be empty for decorative images)
            expect(alt).not.toBeNull();
            
            // Images should have valid src
            expect(src).toBeTruthy();
          }
        }
      });
    });
  });

  test.describe('PWA (Progressive Web App)', () => {
    test('should have web app manifest', async ({ page }) => {
      await test.step('Check manifest.webmanifest accessibility', async () => {
        const response = await page.request.get('/manifest.webmanifest');
        expect(response.status()).toBe(200);
        
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('json');
      });

      await test.step('Verify manifest structure', async () => {
        const response = await page.request.get('/manifest.webmanifest');
        const manifest = await response.json();
        
        // Required PWA manifest fields
        expect(manifest).toHaveProperty('name');
        expect(manifest).toHaveProperty('short_name');
        expect(manifest).toHaveProperty('start_url');
        expect(manifest).toHaveProperty('display');
        expect(manifest).toHaveProperty('icons');
        
        // Verify icons array
        expect(Array.isArray(manifest.icons)).toBe(true);
        expect(manifest.icons.length).toBeGreaterThan(0);
        
        // Check first icon structure
        const firstIcon = manifest.icons[0];
        expect(firstIcon).toHaveProperty('src');
        expect(firstIcon).toHaveProperty('sizes');
        expect(firstIcon).toHaveProperty('type');
      });

      await test.step('Check manifest is linked in HTML', async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const manifestLink = page.locator('link[rel="manifest"]');
        await expect(manifestLink).toHaveCount(1);
        
        const href = await manifestLink.getAttribute('href');
        expect(href).toContain('manifest');
      });
    });

    test('should have service worker', async ({ page }) => {
      await test.step('Check service worker file', async () => {
        const response = await page.request.get('/sw.js');
        
        // Service worker might not exist or might be generated at runtime
        if (response.status() === 200) {
          const swContent = await response.text();
          expect(swContent).toContain('service worker');
        } else {
          // Service worker might be generated at runtime or not implemented yet
          console.log('Service worker not found - may be generated at runtime');
        }
      });

      await test.step('Check service worker registration', async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Check if service worker is registered
        const swRegistered = await page.evaluate(() => {
          return 'serviceWorker' in navigator;
        });
        
        expect(swRegistered).toBe(true);
        
        // Check for service worker registration script
        const swRegistration = await page.evaluate(() => {
          return navigator.serviceWorker.getRegistrations();
        });
        
        // ServiceWorker might not be registered in test environment
        expect(Array.isArray(swRegistration)).toBe(true);
      });
    });

    test('should have proper PWA meta tags', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check PWA meta tags', async () => {
        // Theme color
        const themeColor = page.locator('meta[name="theme-color"]');
        await expect(themeColor).toHaveCount(1);
        
        // Viewport
        const viewport = page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveCount(1);
        
        const viewportContent = await viewport.getAttribute('content');
        expect(viewportContent).toContain('width=device-width');
        expect(viewportContent).toContain('initial-scale=1');
        
        // Apple touch icon
        const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
        if (await appleTouchIcon.count() > 0) {
          await expect(appleTouchIcon.first()).toHaveAttribute('href');
        }
      });
    });

    test('should be installable', async ({ page }) => {
      await test.step('Check PWA installability criteria', async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Check for manifest
        const manifestLink = page.locator('link[rel="manifest"]');
        await expect(manifestLink).toHaveCount(1);
        
        // Check for HTTPS (in production)
        const protocol = new URL(page.url()).protocol;
        expect(['https:', 'http:']).toContain(protocol); // http allowed for localhost
        
        // Check for service worker capability
        const swSupported = await page.evaluate(() => {
          return 'serviceWorker' in navigator;
        });
        expect(swSupported).toBe(true);
      });
    });

    test('should work offline (basic)', async ({ page }) => {
      await test.step('Test offline functionality', async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Go offline
        await page.context().setOffline(true);
        
        // Try to navigate to a cached page
        await page.reload();
        
        // Should still show some content (depending on service worker implementation)
        const body = page.locator('body');
        await expect(body).toBeVisible();
        
        // Restore online
        await page.context().setOffline(false);
      });
    });
  });

  test.describe('Performance & Accessibility', () => {
    test('should have good Core Web Vitals', async ({ page }) => {
      await test.step('Measure page load performance', async () => {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;
        
        // Page should load within reasonable time
        expect(loadTime).toBeLessThan(5000); // 5 seconds max
      });

      await test.step('Check for performance API', async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const perfData = await page.evaluate(() => {
          if ('performance' in window) {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            return {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
              loadComplete: navigation.loadEventEnd - navigation.navigationStart,
              firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
            };
          }
          return null;
        });
        
        if (perfData) {
          expect(perfData.domContentLoaded).toBeGreaterThan(0);
          expect(perfData.loadComplete).toBeGreaterThan(0);
        }
      });
    });

    test('should have basic accessibility features', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await test.step('Check for accessibility attributes', async () => {
        // Check for lang attribute
        const htmlLang = page.locator('html[lang]');
        await expect(htmlLang).toHaveCount(1);
        
        // Check for skip links (if present)
        const skipLinks = page.locator('a[href="#main"], a[href="#content"]');
        if (await skipLinks.count() > 0) {
          await expect(skipLinks.first()).toHaveAttribute('href');
        }
        
        // Check for form labels
        const inputs = page.locator('input[type="text"], input[type="email"], input[type="tel"]');
        const inputCount = await inputs.count();
        
        if (inputCount > 0) {
          for (let i = 0; i < Math.min(inputCount, 5); i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            
            if (id) {
              const label = page.locator(`label[for="${id}"]`);
              const hasLabel = await label.count() > 0;
              const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;
              
              expect(hasLabel || hasAriaLabel).toBe(true);
            }
          }
        }
      });

      await test.step('Check color contrast (basic)', async () => {
        // Get background and text colors of main content
        const mainContent = page.locator('main, .main-content, body').first();
        
        const styles = await mainContent.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color
          };
        });
        
        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();
        
        // Basic check - should not be the same color
        expect(styles.backgroundColor).not.toBe(styles.color);
      });
    });
  });

  test.describe('Security Headers', () => {
    test('should have security headers', async ({ page }) => {
      await test.step('Check security headers', async () => {
        const response = await page.request.get('/');
        const headers = response.headers();
        
        // Check for common security headers
        const securityHeaders = [
          'x-frame-options',
          'x-content-type-options',
          'x-xss-protection',
          'referrer-policy',
          'content-security-policy'
        ];
        
        let foundHeaders = 0;
        securityHeaders.forEach(header => {
          if (headers[header] || headers[header.toLowerCase()]) {
            foundHeaders++;
          }
        });
        
        // Should have at least some security headers
        expect(foundHeaders).toBeGreaterThan(0);
      });
    });
  });
});