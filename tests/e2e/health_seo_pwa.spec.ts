import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Health, SEO, and PWA
 * Tests: /api/health, robots.txt, sitemap.xml, manifest.webmanifest, JSON-LD schema
 */

// Helper class for health, SEO, and PWA testing
class HealthSEOPWAHelper {
  constructor(private page: Page) {}

  async checkAPIHealth(endpoint: string): Promise<{ success: boolean, statusCode: number, response?: unknown }> {
    try {
      const response = await this.page.evaluate(async (url) => {
        const res = await fetch(url)
        const data = await res.json()
        return {
          status: res.status,
          data: data
        }
      }, endpoint)
      
      return {
        success: response.status === 200,
        statusCode: response.status,
        response: response.data
      }
    } catch (error) {
      return { success: false, statusCode: 500 }
    }
  }

  async fetchStaticFile(path: string): Promise<{ success: boolean, statusCode: number, content?: string }> {
    try {
      const response = await this.page.goto(path)
      const statusCode = response?.status() || 500
      const content = statusCode === 200 ? await response?.text() : undefined
      
      return {
        success: statusCode === 200,
        statusCode,
        content
      }
    } catch (error) {
      return { success: false, statusCode: 500 }
    }
  }

  async checkJSONLD(): Promise<{ found: boolean, valid: boolean, schema?: any }> {
    try {
      await this.page.goto('/')
      
      const jsonLdScript = await this.page.locator('script[type="application/ld+json"]').first()
      const scriptContent = await jsonLdScript.textContent()
      
      if (!scriptContent) {
        return { found: false, valid: false }
      }
      
      const schema = JSON.parse(scriptContent)
      
      // Validate basic HairSalon schema requirements
      const isValid = schema['@type'] === 'HairSalon' && 
                     schema.name && 
                     schema.address && 
                     schema.telephone
      
      return {
        found: true,
        valid: isValid,
        schema
      }
    } catch (error) {
      return { found: false, valid: false }
    }
  }

  async checkMetaTags(): Promise<{ tags: Record<string, string>, valid: boolean }> {
    await this.page.goto('/')
    
    const metaTags: Record<string, string> = {}
    
    // Check essential meta tags
    const tagSelectors = [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:type"]',
      'meta[property="og:url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:card"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[charset]',
      'meta[name="viewport"]'
    ]
    
    for (const selector of tagSelectors) {
      const element = this.page.locator(selector)
      const content = await element.getAttribute('content') || await element.getAttribute('charset')
      if (content) {
        metaTags[selector] = content
      }
    }
    
    // Check if required tags are present
    const requiredTags = [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[charset]',
      'meta[name="viewport"]'
    ]
    
    const valid = requiredTags.every(tag => metaTags[tag])
    
    return { tags: metaTags, valid }
  }

  async checkPWAManifest(): Promise<{ valid: boolean, manifest?: any, errors: string[] }> {
    const errors: string[] = []
    
    try {
      const result = await this.fetchStaticFile('/manifest.webmanifest')
      
      if (!result.success) {
        errors.push(`Manifest not found or inaccessible (status: ${result.statusCode})`)
        return { valid: false, errors }
      }
      
      const manifest = JSON.parse(result.content || '{}')
      
      // Check required PWA manifest fields
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']
      
      for (const field of requiredFields) {
        if (!manifest[field]) {
          errors.push(`Missing required field: ${field}`)
        }
      }
      
      // Check icons array
      if (manifest.icons && Array.isArray(manifest.icons)) {
        manifest.icons.forEach((icon: any, index: number) => {
          if (!icon.src) errors.push(`Icon ${index}: missing src`)
          if (!icon.sizes) errors.push(`Icon ${index}: missing sizes`)
          if (!icon.type) errors.push(`Icon ${index}: missing type`)
        })
        
        // Check for required icon sizes
        const iconSizes = manifest.icons.map((icon: any) => icon.sizes)
        const requiredSizes = ['192x192', '512x512']
        
        for (const size of requiredSizes) {
          if (!iconSizes.some((s: string) => s.includes(size))) {
            errors.push(`Missing required icon size: ${size}`)
          }
        }
      } else {
        errors.push('Icons array is missing or invalid')
      }
      
      return {
        valid: errors.length === 0,
        manifest,
        errors
      }
    } catch (error) {
      errors.push(`Failed to parse manifest: ${error}`)
      return { valid: false, errors }
    }
  }

  async checkServiceWorker(): Promise<{ registered: boolean, scope?: string, state?: string }> {
    try {
      await this.page.goto('/')
      
      const swInfo = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(registration => {
              if (registration) {
                resolve({
                  registered: true,
                  scope: registration.scope,
                  state: registration.active?.state
                })
              } else {
                resolve({ registered: false })
              }
            })
          } else {
            resolve({ registered: false })
          }
        })
      })
      
      return swInfo as { registered: boolean, scope?: string, state?: string }
    } catch (error) {
      return { registered: false }
    }
  }

  async checkPerformanceMetrics(): Promise<{ metrics: any, valid: boolean }> {
    await this.page.goto('/')
    
    const metrics = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        // Wait for page to be fully loaded
        window.addEventListener('load', () => {
          setTimeout(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
            const paint = performance.getEntriesByType('paint')
            
            const fcp = paint.find(p => p.name === 'first-contentful-paint')
            const lcp = performance.getEntriesByType('largest-contentful-paint')[0]
            
            resolve({
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
              loadComplete: navigation.loadEventEnd - navigation.navigationStart,
              firstContentfulPaint: fcp?.startTime || 0,
              largestContentfulPaint: lcp?.startTime || 0,
              navigationStart: navigation.navigationStart
            })
          }, 1000)
        })
      })
    })
    
    const performanceMetrics = metrics as any
    
    // Check if metrics are within acceptable ranges
    const valid = performanceMetrics.domContentLoaded < 3000 && // 3 seconds
                 performanceMetrics.loadComplete < 5000 && // 5 seconds
                 performanceMetrics.firstContentfulPaint < 2000 // 2 seconds
    
    return { metrics: performanceMetrics, valid }
  }

  async checkSecurityHeaders(): Promise<{ headers: Record<string, string>, secure: boolean }> {
    const response = await this.page.goto('/')
    const headers = response?.headers() || {}
    
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy',
      'referrer-policy',
      'permissions-policy'
    ]
    
    const foundHeaders: Record<string, string> = {}
    let secureCount = 0
    
    for (const header of securityHeaders) {
      if (headers[header]) {
        foundHeaders[header] = headers[header]
        secureCount++
      }
    }
    
    // Consider secure if at least 5 out of 7 security headers are present
    const secure = secureCount >= 5
    
    return { headers: foundHeaders, secure }
  }
}

test.describe('Health, SEO, and PWA Validation', () => {
  let helper: HealthSEOPWAHelper

  test.beforeEach(async ({ page }) => {
    helper = new HealthSEOPWAHelper(page)
  })

  test.describe('API Health Endpoints', () => {
    test('should validate /api/health endpoint', async ({ page }) => {
      const result = await helper.checkAPIHealth('/api/health')
      
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.response).toHaveProperty('status', 'healthy')
      expect(result.response).toHaveProperty('timestamp')
      expect(result.response).toHaveProperty('version')
      expect(result.response).toHaveProperty('correlationId')
      
      // Check build info
      expect(result.response).toHaveProperty('build')
      expect(result.response.build).toHaveProperty('env')
      expect(result.response.build).toHaveProperty('commit')
    })

    test('should validate /api/health/detailed endpoint', async ({ page }) => {
      const result = await helper.checkAPIHealth('/api/health/detailed')
      
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      
      // Check detailed health components
      expect(result.response).toHaveProperty('status', 'healthy')
      expect(result.response).toHaveProperty('checks')
      
      const checks = result.response.checks
      expect(checks).toHaveProperty('database')
      expect(checks).toHaveProperty('storage')
      expect(checks).toHaveProperty('auth')
      expect(checks).toHaveProperty('functions')
      
      // Each check should have status and response time
      Object.values(checks).forEach((check: any) => {
        expect(check).toHaveProperty('status')
        expect(check).toHaveProperty('responseTime')
        expect(typeof check.responseTime).toBe('number')
      })
    })

    test('should validate health endpoint performance', async ({ page }) => {
      const startTime = Date.now()
      const result = await helper.checkAPIHealth('/api/health')
      const endTime = Date.now()
      
      const responseTime = endTime - startTime
      
      expect(result.success).toBe(true)
      expect(responseTime).toBeLessThan(2000) // Should respond within 2 seconds
      
      if (result.response.responseTime) {
        expect(result.response.responseTime).toBeLessThan(1000) // Server-side timing
      }
    })

    test('should validate correlation ID propagation', async ({ page }) => {
      const correlationId = `test-${Date.now()}`
      
      // Set correlation ID in request header
      await page.setExtraHTTPHeaders({
        'X-Correlation-ID': correlationId
      })
      
      const result = await helper.checkAPIHealth('/api/health')
      
      expect(result.success).toBe(true)
      expect(result.response.correlationId).toBe(correlationId)
    })
  })

  test.describe('SEO Static Files', () => {
    test('should serve valid robots.txt', async ({ page }) => {
      const result = await helper.fetchStaticFile('/robots.txt')
      
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.content).toBeTruthy()
      
      // Check for essential robots.txt directives
      expect(result.content).toContain('User-agent:')
      expect(result.content).toContain('Disallow:')
      expect(result.content).toContain('Sitemap:')
      
      // Should reference the sitemap
      expect(result.content).toMatch(/Sitemap:\s*https?:\/\/.*\/sitemap\.xml/)
    })

    test('should serve valid sitemap.xml', async ({ page }) => {
      const result = await helper.fetchStaticFile('/sitemap.xml')
      
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.content).toBeTruthy()
      
      // Check for valid XML sitemap structure
      expect(result.content).toContain('<?xml version="1.0"')
      expect(result.content).toContain('<urlset')
      expect(result.content).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(result.content).toContain('<url>')
      expect(result.content).toContain('<loc>')
      expect(result.content).toContain('<lastmod>')
      expect(result.content).toContain('<changefreq>')
      expect(result.content).toContain('<priority>')
      
      // Should include main pages
      expect(result.content).toMatch(/<loc>https?:\/\/.*\/<\/loc>/) // Homepage
      expect(result.content).toMatch(/<loc>https?:\/\/.*\/booking<\/loc>/) // Booking page
      expect(result.content).toMatch(/<loc>https?:\/\/.*\/services<\/loc>/) // Services page
    })

    test('should validate meta tags for SEO', async ({ page }) => {
      const result = await helper.checkMetaTags()
      
      expect(result.valid).toBe(true)
      
      // Check essential meta tags
      expect(result.tags['meta[charset]']).toBe('UTF-8')
      expect(result.tags['meta[name="viewport"]']).toContain('width=device-width')
      expect(result.tags['meta[name="description"]']).toBeTruthy()
      expect(result.tags['meta[name="description"]'].length).toBeGreaterThan(50)
      expect(result.tags['meta[name="description"]'].length).toBeLessThan(160)
      
      // Check Open Graph tags
      expect(result.tags['meta[property="og:title"]']).toBeTruthy()
      expect(result.tags['meta[property="og:description"]']).toBeTruthy()
      expect(result.tags['meta[property="og:type"]']).toBe('website')
      expect(result.tags['meta[property="og:url"]']).toBeTruthy()
      expect(result.tags['meta[property="og:image"]']).toBeTruthy()
      
      // Check Twitter Card tags
      expect(result.tags['meta[name="twitter:card"]']).toBe('summary_large_image')
      expect(result.tags['meta[name="twitter:title"]']).toBeTruthy()
      expect(result.tags['meta[name="twitter:description"]']).toBeTruthy()
    })
  })

  test.describe('Structured Data (JSON-LD)', () => {
    test('should have valid HairSalon schema markup', async ({ page }) => {
      const result = await helper.checkJSONLD()
      
      expect(result.found).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.schema).toBeTruthy()
      
      const schema = result.schema
      
      // Check HairSalon schema requirements
      expect(schema['@context']).toBe('https://schema.org')
      expect(schema['@type']).toBe('HairSalon')
      expect(schema.name).toBe('Schnittwerk Your Style')
      
      // Check required business information
      expect(schema.address).toBeTruthy()
      expect(schema.address['@type']).toBe('PostalAddress')
      expect(schema.address.streetAddress).toBeTruthy()
      expect(schema.address.addressLocality).toBeTruthy()
      expect(schema.address.postalCode).toBeTruthy()
      expect(schema.address.addressCountry).toBeTruthy()
      
      expect(schema.telephone).toBeTruthy()
      expect(schema.url).toBeTruthy()
      
      // Check opening hours
      expect(schema.openingHours).toBeTruthy()
      expect(Array.isArray(schema.openingHours)).toBe(true)
      
      // Check services offered
      expect(schema.hasOfferCatalog).toBeTruthy()
      expect(schema.hasOfferCatalog['@type']).toBe('OfferCatalog')
      expect(schema.hasOfferCatalog.itemListElement).toBeTruthy()
      
      // Check price range
      expect(schema.priceRange).toBeTruthy()
      expect(schema.priceRange).toMatch(/\$+/)
    })

    test('should validate LocalBusiness additional properties', async ({ page }) => {
      const result = await helper.checkJSONLD()
      
      expect(result.found).toBe(true)
      const schema = result.schema
      
      // Additional LocalBusiness properties
      expect(schema.description).toBeTruthy()
      expect(schema.email).toBeTruthy()
      expect(schema.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      
      // Check geo coordinates (if provided)
      if (schema.geo) {
        expect(schema.geo['@type']).toBe('GeoCoordinates')
        expect(typeof schema.geo.latitude).toBe('number')
        expect(typeof schema.geo.longitude).toBe('number')
      }
      
      // Check social media profiles (if provided)
      if (schema.sameAs) {
        expect(Array.isArray(schema.sameAs)).toBe(true)
        schema.sameAs.forEach((url: string) => {
          expect(url).toMatch(/^https?:\/\//)
        })
      }
    })
  })

  test.describe('PWA (Progressive Web App)', () => {
    test('should have valid web app manifest', async ({ page }) => {
      const result = await helper.checkPWAManifest()
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.manifest).toBeTruthy()
      
      const manifest = result.manifest
      
      // Check required PWA fields
      expect(manifest.name).toBe('Schnittwerk Your Style')
      expect(manifest.short_name).toBeTruthy()
      expect(manifest.short_name.length).toBeLessThanOrEqual(12)
      expect(manifest.start_url).toBe('/')
      expect(manifest.display).toBe('standalone')
      expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/)
      
      // Check icons
      expect(Array.isArray(manifest.icons)).toBe(true)
      expect(manifest.icons.length).toBeGreaterThan(0)
      
      // Check for required icon sizes
      const iconSizes = manifest.icons.map((icon: any) => icon.sizes)
      expect(iconSizes.some((size: string) => size.includes('192x192'))).toBe(true)
      expect(iconSizes.some((size: string) => size.includes('512x512'))).toBe(true)
      
      // Check icon properties
      manifest.icons.forEach((icon: any) => {
        expect(icon.src).toBeTruthy()
        expect(icon.type).toMatch(/^image\//)
        expect(icon.sizes).toMatch(/^\d+x\d+$/)
      })
    })

    test('should register service worker for offline functionality', async ({ page }) => {
      const result = await helper.checkServiceWorker()
      
      expect(result.registered).toBe(true)
      expect(result.scope).toBeTruthy()
      expect(result.state).toBe('activated')
    })

    test('should be installable as PWA', async ({ page }) => {
      await page.goto('/')
      
      // Check for manifest link in HTML
      const manifestLink = page.locator('link[rel="manifest"]')
      await expect(manifestLink).toBeVisible()
      
      const manifestHref = await manifestLink.getAttribute('href')
      expect(manifestHref).toBe('/manifest.webmanifest')
      
      // Check for theme color meta tag
      const themeColorMeta = page.locator('meta[name="theme-color"]')
      await expect(themeColorMeta).toBeVisible()
      
      // Check for apple touch icon
      const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]')
      await expect(appleTouchIcon).toBeVisible()
    })

    test('should handle offline scenarios gracefully', async ({ page }) => {
      await page.goto('/')
      
      // Simulate offline
      await page.context().setOffline(true)
      
      // Try to navigate to a cached page
      await page.reload()
      
      // Should show offline message or cached content
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]')
      const cachedContent = page.locator('main')
      
      // Either show offline indicator or serve cached content
      const hasOfflineHandling = await offlineIndicator.isVisible() || await cachedContent.isVisible()
      expect(hasOfflineHandling).toBe(true)
      
      // Restore online state
      await page.context().setOffline(false)
    })
  })

  test.describe('Performance Metrics', () => {
    test('should meet Core Web Vitals thresholds', async ({ page }) => {
      const result = await helper.checkPerformanceMetrics()
      
      expect(result.valid).toBe(true)
      
      const metrics = result.metrics
      
      // Core Web Vitals thresholds
      expect(metrics.firstContentfulPaint).toBeLessThan(1800) // FCP < 1.8s (good)
      expect(metrics.largestContentfulPaint).toBeLessThan(2500) // LCP < 2.5s (good)
      expect(metrics.domContentLoaded).toBeLessThan(3000) // DOM ready < 3s
      expect(metrics.loadComplete).toBeLessThan(5000) // Page load < 5s
    })

    test('should have optimized resource loading', async ({ page }) => {
      await page.goto('/')
      
      // Check for resource optimization hints
      const resourceHints = [
        'link[rel="preconnect"]',
        'link[rel="dns-prefetch"]',
        'link[rel="preload"]'
      ]
      
      let hintsFound = 0
      for (const hint of resourceHints) {
        const elements = page.locator(hint)
        const count = await elements.count()
        hintsFound += count
      }
      
      // Should have at least some resource optimization hints
      expect(hintsFound).toBeGreaterThan(0)
    })
  })

  test.describe('Security Headers', () => {
    test('should implement security headers', async ({ page }) => {
      const result = await helper.checkSecurityHeaders()
      
      expect(result.secure).toBe(true)
      expect(Object.keys(result.headers).length).toBeGreaterThanOrEqual(5)
      
      // Check specific security headers
      const headers = result.headers
      
      if (headers['x-frame-options']) {
        expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options'])
      }
      
      if (headers['x-content-type-options']) {
        expect(headers['x-content-type-options']).toBe('nosniff')
      }
      
      if (headers['strict-transport-security']) {
        expect(headers['strict-transport-security']).toContain('max-age=')
      }
      
      if (headers['content-security-policy']) {
        expect(headers['content-security-policy']).toContain('default-src')
      }
      
      if (headers['referrer-policy']) {
        expect(['strict-origin-when-cross-origin', 'same-origin', 'strict-origin']).toContain(headers['referrer-policy'])
      }
    })
  })

  test.describe('Accessibility (a11y)', () => {
    test('should have basic accessibility features', async ({ page }) => {
      await page.goto('/')
      
      // Check for alt text on images
      const images = page.locator('img')
      const imageCount = await images.count()
      
      if (imageCount > 0) {
        for (let i = 0; i < Math.min(imageCount, 5); i++) {
          const img = images.nth(i)
          const alt = await img.getAttribute('alt')
          expect(alt).toBeTruthy()
        }
      }
      
      // Check for proper heading hierarchy
      const h1Count = await page.locator('h1').count()
      expect(h1Count).toBe(1) // Should have exactly one H1
      
      // Check for skip links
      const skipLink = page.locator('a[href="#main"], a[href="#content"]')
      const hasSkipLink = await skipLink.count() > 0
      
      // Check for focus management
      const focusableElements = page.locator('button, input, select, textarea, a[href]')
      const focusableCount = await focusableElements.count()
      expect(focusableCount).toBeGreaterThan(0)
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/')
      
      // Test tab navigation
      await page.keyboard.press('Tab')
      
      // Should have visible focus indicators
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
      
      // Test escape key on modals/dialogs
      const dialogTrigger = page.locator('[data-testid*="dialog"], [data-testid*="modal"]').first()
      
      if (await dialogTrigger.count() > 0) {
        await dialogTrigger.click()
        await page.keyboard.press('Escape')
        
        // Dialog should close
        const openDialog = page.locator('[role="dialog"]:visible')
        expect(await openDialog.count()).toBe(0)
      }
    })
  })
})