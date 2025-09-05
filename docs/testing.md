# E2E Testing Guide - Schnittwerk Your Style

This document provides comprehensive guidance for running and maintaining the End-to-End test suite using Playwright and modular production E2E tests.

## 🎯 Overview

The E2E test suite provides complete validation of the hair salon booking system, covering:

- **Customer Booking Flow**: Service selection, staff selection, time slot booking, confirmations, cancellations
- **Admin Portal CRUD**: Staff, Services, Customers, Appointments, Media, Settings management
- **RBAC Validation**: Role-based access control for admin, staff, receptionist, and customer roles
- **Health/SEO/PWA**: API health endpoints, SEO meta tags, Progressive Web App features
- **Security Validation**: HTTP security headers, rate limiting, CORS, input validation
- **Performance Testing**: Page load times, API response times, resource optimization

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** installed
2. **Supabase project** configured (production and test environments)
3. **Environment variables** set up (see `.env.example`)
4. **Stripe test credentials** configured

### Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install --with-deps

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Seed test data
node scripts/seed-test-data.ts

# 5. Build the application
npm run build

# 6. Start preview server on port 4173
npm run preview

# 7. Run E2E tests (in another terminal)
npx playwright test

# 8. Run modular production E2E tests
npm run test src/test/modular-production-e2e.test.ts

# 9. Clean up test data
node scripts/clean-test-data.ts
```

### CI/CD Integration

The production E2E tests run automatically in GitHub Actions with enhanced security and fork handling:

```bash
# Manual trigger with options
gh workflow run production-e2e-tests.yml \
  -f production_url="https://your-preview-url.netlify.app" \
  -f test_suite="all" \
  -f quick_mode=false
```

## 🛠️ Test Environment Configuration

### Required Secrets (GitHub Actions)

**Core Infrastructure:**
- `SUPABASE_URL_TEST`: Test Supabase project URL
- `SUPABASE_ANON_KEY_TEST`: Test Supabase anonymous key  
- `SUPABASE_SERVICE_ROLE_TEST`: Test Supabase service role key
- `PRODUCTION_URL`: Production deployment URL

**Payment Integration:**
- `STRIPE_SECRET_KEY`: Stripe test secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe test webhook secret

**Fork PR Handling:**
- `BOT_PAT`: GitHub Bot Personal Access Token (fine-grained, minimal permissions)

**Enhanced Security:**
- `SECURITY_TEST_TIMEOUT`: Security test timeout (default: 30000ms)
- `SECURITY_HEADERS_REQUIRED`: Enable strict security header validation

### Local Environment Setup

1. **Create test Supabase project** (separate from production)
2. **Configure test database** with same schema as production
3. **Set up test environment variables** in `.env.local`
4. **Configure Stripe test mode** with test keys

## 📋 Test Categories

### 1. Playwright E2E Tests (`tests/e2e/`)

- **Multi-browser**: Chromium, Firefox, WebKit support
- **Mobile viewports**: iPhone, iPad, Android device simulation
- **Test sharding**: Parallel execution with 2-shard matrix
- **Retry mechanism**: 2 retries for flaky tests

```bash
# Run specific browser
npx playwright test --project=chromium

# Run with sharding
npx playwright test --shard=1/2

# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

### 2. Modular Production E2E (`src/test/modular-production-e2e.test.ts`)

Enhanced modular testing with detailed logging:

- **Authentication & Authorization**: JWT protection, RBAC enforcement, session management
- **Booking Flow Validation**: Service/staff availability, input validation, conflict detection
- **Health & Monitoring**: Health endpoints, metrics, dependency checks, response times
- **Security & Compliance**: Security headers, rate limiting, input validation, CORS, webhook security
- **Performance & Optimization**: Page load, API performance, resource optimization, asset delivery

```bash
# Run with enhanced logging
DEBUG_MODULAR_TESTS=true npm run test src/test/modular-production-e2e.test.ts

# Run with specific correlation ID
CORRELATION_ID=debug-session-123 npm run test src/test/modular-production-e2e.test.ts
```

### 3. Security Validation (`scripts/run-security-tests.sh`)

Comprehensive security testing:

- **HTTP Security Headers**: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), HSTS, CSP
- **Rate Limiting**: API endpoint protection, abuse prevention
- **Input Validation**: XSS protection, SQL injection prevention
- **CORS Configuration**: Cross-origin request validation
- **Webhook Security**: Stripe signature validation, invalid signature handling

```bash
# Run security tests against specific URL
PRODUCTION_URL=http://localhost:4173 ./scripts/run-security-tests.sh

# Save results to custom directory
RESULTS_DIR=./custom-results ./scripts/run-security-tests.sh
```

### 4. Performance Testing (`scripts/run-lighthouse-tests.sh`)

- **Lighthouse audits**: Desktop and mobile presets
- **Performance metrics**: LCP, FID, CLS, FCP, TTI
- **Accessibility validation**: WCAG compliance
- **SEO optimization**: Meta tags, structured data
- **PWA features**: Manifest, service worker, installability

## 🔧 Test Data Management

### Automated Seeding (`scripts/seed-test-data.ts`)

```bash
# Seed test data
node scripts/seed-test-data.ts

# Seed with custom prefix
E2E_TEST_USER_PREFIX=custom-test- node scripts/seed-test-data.ts
```

**Creates:**
- RBAC test users (admin, staff, receptionist, customer)
- Sample services with different categories
- Staff availability schedules
- Business settings and configurations

### Automated Cleanup (`scripts/clean-test-data.ts`)

```bash
# Clean all test data
node scripts/clean-test-data.ts

# Clean specific user prefix
E2E_TEST_USER_PREFIX=custom-test- node scripts/clean-test-data.ts
```

**Removes:**
- All test users and related data
- Test bookings and appointments
- Test media uploads
- Temporary configurations

## 🚨 Troubleshooting

### Common Issues

**Preview Server Not Starting:**
```bash
# Check if port 4173 is available
lsof -i :4173

# Kill existing process
kill $(lsof -t -i:4173)

# Start with custom port
PORT=4174 npm run preview
BASE_URL=http://localhost:4174 npx playwright test
```

**Database Connection Issues:**
```bash
# Verify Supabase connection
curl -H "apikey: $SUPABASE_ANON_KEY_TEST" "$SUPABASE_URL_TEST/rest/v1/"

# Check service role permissions
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_TEST" "$SUPABASE_URL_TEST/rest/v1/"
```

**Security Header Failures:**
```bash
# Test headers locally
curl -I http://localhost:4173

# Verify _headers file deployment
curl -I https://your-site.netlify.app

# Check CSP violations in browser console
```

**Stripe Webhook Issues:**
```bash
# Test webhook endpoint
curl -X POST http://localhost:4173/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Verify signature validation
curl -X POST http://localhost:4173/api/webhooks/stripe \
  -H "Stripe-Signature: invalid" \
  -d '{"test": "data"}'
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=pw:* npx playwright test

# Run with trace viewer
npx playwright test --trace on

# Generate test report
npx playwright show-report
```

### Artifact Analysis

After CI runs, download artifacts:
- `playwright-results-*`: Test results, traces, videos, screenshots
- `security-results-*`: Security validation reports and headers
- `lighthouse-results-*`: Performance audit reports
- `design-lock-results-*`: Design compliance validation

## 📊 Test Metrics & Reporting

### Success Criteria

- **E2E Tests**: 100% pass rate across all browsers
- **Security Tests**: 0 failures for critical security headers
- **Performance**: Lighthouse scores >90 for all categories
- **Lighthouse**: Desktop >95, Mobile >85 performance scores
- **Test Coverage**: All user journeys and edge cases validated

### Correlation IDs

All tests use correlation IDs for tracing:
- Format: `{test-type}-{timestamp}` or `{test-type}-{session-id}`
- Useful for debugging distributed systems
- Included in all API calls and logs

## 🔄 Maintenance

### Regular Tasks

1. **Update test data** monthly to reflect business changes
2. **Review security headers** after infrastructure updates  
3. **Update Playwright browsers** with `npx playwright install`
4. **Validate test environment** separation from production
5. **Audit test secrets** and rotate as needed

### Version Updates

```bash
# Update Playwright
npm update @playwright/test

# Update test dependencies  
npm update --save-dev

# Reinstall browsers after Playwright update
npx playwright install --with-deps
```

### Quick Test Commands

```bash
# Run all E2E tests
npx playwright test

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/booking.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium

# Run tests with UI mode
npx playwright test --ui

# Generate test report
npx playwright show-report
```

## 📁 Test Structure

```
tests/e2e/
├── global-setup.ts           # Global test setup
├── global-teardown.ts        # Global test cleanup
├── booking.spec.ts           # Customer booking flow tests
├── admin-crud.spec.ts        # Admin portal CRUD tests
├── rbac.spec.ts             # Role-based access control tests
└── health_seo_pwa.spec.ts   # Health, SEO & PWA tests

scripts/
├── seed-test-data.ts        # Test data seeding
└── clean-test-data.ts       # Test data cleanup

playwright.config.ts         # Playwright configuration
```

## 🧪 Test Categories

### 1. Customer Booking Flow (`booking.spec.ts`)

**Coverage:**
- ✅ Service search and filtering
- ✅ Staff selection (specific or any)
- ✅ Date and time slot selection
- ✅ Customer information form
- ✅ Booking confirmation flow
- ✅ Booking cancellation
- ✅ Edge cases (invalid dates, conflicts, network errors)

**Key Test Scenarios:**
```typescript
// Happy path booking
test('should complete full booking flow', async ({ page }) => {
  // Navigate → Select service → Choose staff → Pick time → Fill info → Confirm
});

// Edge cases
test('should handle booking conflicts gracefully', async ({ page }) => {
  // Attempt to book already taken slot
});
```

### 2. Admin Portal CRUD (`admin-crud.spec.ts`)

**Coverage:**
- ✅ Staff management (create, read, update, delete)
- ✅ Services management with categories
- ✅ Customer management with GDPR compliance
- ✅ Appointment management with conflict detection
- ✅ Media upload and management
- ✅ Business settings configuration

**Key Test Scenarios:**
```typescript
// Staff CRUD operations
test('should create, edit, and delete staff members', async ({ page }) => {
  // Create → Edit → Verify → Delete → Confirm
});

// Appointment conflict detection
test('should prevent double bookings', async ({ page }) => {
  // Attempt to create conflicting appointment
});
```

### 3. RBAC Validation (`rbac.spec.ts`)

**Coverage:**
- ✅ Admin: Full access to all features
- ✅ Staff: Limited access with PII masking
- ✅ Receptionist: Appointment management only
- ✅ Customer: Self-service restrictions
- ✅ API endpoint protection
- ✅ Role transition auditing

**Key Test Scenarios:**
```typescript
// Role-specific access
test('staff should see masked customer PII', async ({ page }) => {
  await loginAs(page, 'staff');
  // Verify PII fields are masked (***@***.com)
});

// Privilege escalation prevention
test('should prevent unauthorized role changes', async ({ page }) => {
  await loginAs(page, 'staff');
  // Attempt admin actions → Expect 403
});
```

### 4. Health, SEO & PWA (`health_seo_pwa.spec.ts`)

**Coverage:**
- ✅ `/api/health` endpoint functionality
- ✅ SEO meta tags and structured data
- ✅ `robots.txt` and `sitemap.xml`
- ✅ PWA manifest and service worker
- ✅ Accessibility basics
- ✅ Performance metrics

**Key Test Scenarios:**
```typescript
// Health endpoint validation
test('should provide comprehensive health status', async ({ page }) => {
  const response = await page.request.get('/api/health');
  expect(response.status()).toBe(200);
  // Verify health data structure
});

// PWA installability
test('should meet PWA installability criteria', async ({ page }) => {
  // Check manifest, service worker, HTTPS
});
```

## 🔧 Configuration

### Environment Variables

Required variables for E2E testing:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Required for test data management
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# JWT Configuration
JWT_SECRET=your-jwt-secret-for-testing

# Test Configuration
PLAYWRIGHT_BASE_URL=http://localhost:4173  # Override for different environments
```

### Playwright Configuration

Key settings in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,           // 1 minute per test
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## 🤖 CI/CD Integration

### GitHub Actions Workflow

The E2E workflow (`.github/workflows/e2e.yml`) includes:

1. **Prepare**: TypeCheck, lint, unit tests
2. **Build**: Application and Netlify Functions
3. **Deploy Preview**: Automatic preview deployment for PRs
4. **E2E Tests**: Matrix testing across browsers with sharding
5. **Design Lock**: Ensures no UI changes
6. **Report**: Comprehensive test results

### Workflow Triggers

- **Push to main**: Full E2E suite
- **Pull requests**: Preview deployment + E2E tests
- **Manual dispatch**: Configurable environment testing

### Artifacts

Generated artifacts include:
- Test reports (HTML)
- Screenshots and videos (on failure)
- Trace files for debugging
- Test results (JSON/JUnit)

## 🔍 Test Data Management

### Seeding Test Data

The `scripts/seed-test-data.ts` script creates:

```typescript
// Test users with different roles
const TEST_USERS = [
  { email: 'admin@test.com', role: 'admin' },
  { email: 'staff@test.com', role: 'staff' },
  { email: 'receptionist@test.com', role: 'receptionist' },
  { email: 'customer@test.com', role: 'customer' }
];

// Test services and availability
const TEST_SERVICES = [
  { name: 'Haarschnitt Damen', duration: 60, price: 5500 },
  // ... more services
];
```

### Cleanup Strategy

The `scripts/clean-test-data.ts` script removes:
- Test users (auth + profiles)
- Test services and appointments
- Test staff availability
- Test media placeholders
- Test settings

### Data Isolation

- Test data uses identifiable prefixes/emails
- Cleanup runs after each test session
- Production data is never affected

## 🚀 Running Tests

### Local Development

```bash
# Full test cycle
npm run test:e2e:full

# Quick smoke tests
npm run test:e2e:quick

# Specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Headed mode (visible browser)
npx playwright test --headed
```

### Preview Environment

```bash
# Set preview URL
export PLAYWRIGHT_BASE_URL=https://pr-123-abc.netlify.app

# Run against preview
npx playwright test
```

### Production Testing

```bash
# Set production URL
export PLAYWRIGHT_BASE_URL=https://schnittwerk-your-style.netlify.app

# Run production-safe tests only
npx playwright test --grep-invert "should create|should delete"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. **Test Data Conflicts**
```bash
# Problem: Tests fail due to existing data
# Solution: Clean up test data
npx tsx scripts/clean-test-data.ts
npx tsx scripts/seed-test-data.ts
```

#### 2. **Authentication Failures**
```bash
# Problem: Login tests failing
# Solution: Check test user credentials
# Verify SUPABASE_SERVICE_ROLE_KEY is set
```

#### 3. **Timeouts**
```bash
# Problem: Tests timing out
# Solution: Increase timeout in playwright.config.ts
timeout: 120 * 1000  // 2 minutes
```

#### 4. **Browser Installation**
```bash
# Problem: Browser not found
# Solution: Reinstall browsers
npx playwright install --with-deps
```

### Debugging Tests

#### Using Playwright Inspector
```bash
# Debug specific test
npx playwright test booking.spec.ts --debug

# Debug from specific line
npx playwright test booking.spec.ts:25 --debug
```

#### Using Trace Viewer
```bash
# Generate trace
npx playwright test --trace=on

# View trace
npx playwright show-trace trace.zip
```

#### Using VS Code Extension
1. Install "Playwright Test for VSCode"
2. Run tests with integrated debugging
3. Set breakpoints in test files

### Environment Debugging

```bash
# Check environment
echo $PLAYWRIGHT_BASE_URL
echo $SUPABASE_URL

# Test connectivity
curl $PLAYWRIGHT_BASE_URL/api/health

# Verify test data
npx tsx -e "
  import { createClient } from '@supabase/supabase-js';
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  client.from('profiles').select('email').eq('email', 'admin@test.com').then(console.log);
"
```

## 📊 Test Reports

### HTML Report
```bash
# Generate report
npx playwright test --reporter=html

# View report
npx playwright show-report
```

### CI Reports
- **GitHub Actions**: Artifacts uploaded after each run
- **Pull Request Comments**: Automatic test result summaries
- **Netlify Preview**: Links to deployment in test results

### Custom Reporting
The workflow generates:
- Test summary markdown
- Coverage metrics
- Performance benchmarks
- Error screenshots and videos

## 🔒 Security Considerations

### Test Environment Security
- Test data is isolated and temporary
- Service role key used only for test data management
- No production data access during testing
- Cleanup ensures no test data persistence

### RBAC Testing Security
- Tests validate proper access restrictions
- Negative testing ensures unauthorized access fails
- JWT validation and role claims verification
- API endpoint protection validation

## 🎯 Best Practices

### Writing E2E Tests

1. **Use Page Object Pattern**
```typescript
class BookingPage {
  constructor(private page: Page) {}
  
  async selectService(serviceName: string) {
    await this.page.click(`[data-testid="service-${serviceName}"]`);
  }
}
```

2. **Implement Proper Waits**
```typescript
// Wait for network to be idle
await page.waitForLoadState('networkidle');

// Wait for specific elements
await page.waitForSelector('[data-testid="booking-form"]');
```

3. **Use Test Steps**
```typescript
test('booking flow', async ({ page }) => {
  await test.step('Navigate to booking', async () => {
    await page.goto('/booking');
  });
  
  await test.step('Select service', async () => {
    await page.click('[data-testid="service-haircut"]');
  });
});
```

### Test Data Management

1. **Use Descriptive Test Data**
```typescript
const testCustomer = {
  email: 'e2e-customer-123@test.com',
  name: 'E2E Test Customer',
  phone: '+41 79 000 00 00'
};
```

2. **Clean Up After Tests**
```typescript
test.afterEach(async () => {
  await cleanupTestBookings();
});
```

3. **Parallel Test Safety**
```typescript
// Use unique identifiers
const testId = `test-${Date.now()}-${Math.random()}`;
```

## 🚀 Performance Optimization

### Test Execution Speed
- Use `--workers=4` for parallel execution
- Implement test sharding for CI
- Cache browser installations
- Optimize test data seeding

### Resource Management
- Clean up test data promptly
- Use shared test fixtures
- Minimize full page reloads
- Implement smart test selection

## 📈 Monitoring & Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review test results and update failing tests
2. **Monthly**: Update Playwright and browser versions
3. **Quarterly**: Review test coverage and add new scenarios

### Metrics to Track
- Test execution time
- Test failure rates
- Coverage gaps
- Performance regressions

## 🎉 Success Criteria

The E2E test suite is considered successful when:

- ✅ All test categories pass consistently
- ✅ Tests complete within reasonable time (< 15 minutes)
- ✅ No false positives or flaky tests
- ✅ Comprehensive coverage of user journeys
- ✅ Design lock prevents UI regressions
- ✅ RBAC security is properly validated

---

For additional support or questions about E2E testing, refer to the [Playwright documentation](https://playwright.dev/) or consult the development team.