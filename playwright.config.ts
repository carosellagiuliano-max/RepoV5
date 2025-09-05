import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60000, // 60 seconds per test
  globalTimeout: 1800000, // 30 minutes total
  reporter: [
    ['junit', { outputFile: 'junit.xml' }],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:4173',
    // Enhanced tracing and debugging
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Extended timeouts for complex operations
    actionTimeout: 15000,
    navigationTimeout: 30000,
    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    // Emulate timezone
    timezoneId: 'Europe/Berlin',
    locale: 'de-DE',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional Chrome-specific options
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox-specific options
        launchOptions: {
          firefoxUserPrefs: {
            'dom.webnotifications.enabled': false,
            'dom.push.enabled': false
          }
        }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // WebKit-specific options
        launchOptions: {
          // Disable certain WebKit security features for testing
        }
      },
    },
    // Mobile testing configurations
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
      },
      testMatch: /.*mobile\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
      },
      testMatch: /.*mobile\.spec\.ts/,
    },
  ],
  // Enhanced web server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  // Global setup and teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
})
