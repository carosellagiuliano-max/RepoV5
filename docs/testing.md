# E2E Testing Documentation

## 🎯 Overview

This document provides comprehensive guidance for running and maintaining the E2E (End-to-End) test suite for Schnittwerk Your Style. The test suite covers the complete application stack including customer booking flows, admin operations, RBAC security, and health/SEO/PWA validation.

## 📋 Test Suite Structure

### Core Test Suites

1. **Customer Booking Flow** (`tests/e2e/booking.spec.ts`)
   - Complete booking journey: Search → Filter → Book → Confirm → Cancel
   - Conflict detection and validation
   - Idempotency testing
   - Edge case handling

2. **Admin CRUD Operations** (`tests/e2e/admin-crud.spec.ts`)
   - Staff management (CRUD, availability, timeoff)
   - Services management (pricing, categories, staff assignments)
   - Customer management (GDPR compliance, search, history)
   - Appointments management (conflict detection, bulk operations)
   - Media management (Supabase Storage integration)
   - Settings management (business hours, SMTP, templates)

3. **RBAC Security** (`tests/e2e/rbac.spec.ts`)
   - Admin: Full access to all sections and operations
   - Staff: Limited access to appointments and customers (read-only services)
   - Customer: Only access to own data and booking functionality
   - Cross-role security validation and audit logging

4. **Health/SEO/PWA** (`tests/e2e/health_seo_pwa.spec.ts`)
   - API health endpoints with correlation ID propagation
   - SEO static files (robots.txt, sitemap.xml)
   - Structured data (JSON-LD HairSalon schema)
   - PWA manifest and service worker validation
   - Performance metrics and Core Web Vitals
   - Security headers and accessibility

## 🚀 Local Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps

# Install TypeScript compiler for scripts
npm install -g tsx
```

### Environment Configuration

Create a local `.env.local` file with test credentials:

```env
# Supabase Configuration (Test Environment)
VITE_SUPABASE_URL=your_test_supabase_url
VITE_SUPABASE_ANON_KEY=your_test_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key

# Test User Credentials
TEST_ADMIN_EMAIL=admin@test.local
TEST_STAFF_EMAIL=staff@test.local
TEST_CUSTOMER_EMAIL=customer@test.local
TEST_ADMIN_PASSWORD=Test123!@#
TEST_STAFF_PASSWORD=Test123!@#
TEST_CUSTOMER_PASSWORD=Test123!@#

# JWT Configuration
JWT_SECRET=your_test_jwt_secret_min_32_chars

# Test Environment
TEST_URL=http://localhost:4173
NODE_ENV=test
```

### Running Tests Locally

```bash
# 1. Seed test data
npm run test:seed

# 2. Build the application
npm run build

# 3. Start preview server
npm run preview

# 4. Run E2E tests (in a new terminal)
npm run test:e2e

# 5. Clean up test data
npm run test:clean
```

### Running Specific Test Suites

```bash
# Run only booking flow tests
npx playwright test tests/e2e/booking.spec.ts

# Run only admin CRUD tests
npx playwright test tests/e2e/admin-crud.spec.ts

# Run only RBAC tests
npx playwright test tests/e2e/rbac.spec.ts

# Run only health/SEO/PWA tests
npx playwright test tests/e2e/health_seo_pwa.spec.ts

# Run with UI mode for debugging
npm run test:e2e:ui
```

### Browser-Specific Testing

```bash
# Run tests in specific browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run on mobile devices
npx playwright test --project=mobile-chrome
npx playwright test --project=mobile-safari
```

## 🔧 Test Data Management

### Seeding Test Data

The `scripts/seed-test-data.ts` script creates:

- **Test Users:**
  - `admin@test.local` (admin role)
  - `staff@test.local` (staff role)  
  - `customer@test.local` (customer role)

- **Test Services:**
  - Herrenhaarschnitt (€35.00, 30min)
  - Damenhaarschnitt (€65.00, 45min)
  - Färben (€120.00, 90min)
  - Styling (€45.00, 30min)

- **Staff Availability:**
  - Monday-Friday: 09:00-18:00
  - Saturday: 09:00-16:00

- **Sample Media Assets:**
  - Test gallery images with proper metadata

### Cleaning Test Data

The `scripts/clean-test-data.ts` script removes:

- All test user accounts and related data
- Test appointments and bookings
- Test services and staff assignments
- Test media assets
- Audit logs and correlation data

### Manual Data Management

```bash
# Seed only (for development)
npm run test:seed

# Clean only (after tests)
npm run test:clean

# Full reset (clean + seed)
npm run test:clean && npm run test:seed
```

## 🎯 CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically on:
- Push to `main` branch
- Pull requests to `main` or `feature/*` branches

### Workflow Structure

1. **Prepare**: Dependencies, lint, typecheck, unit tests
2. **Build**: Application build with artifacts
3. **E2E**: Matrix testing across browsers and shards
4. **Design Lock**: Validates no UI/styling changes
5. **Security Headers**: Tests security configuration
6. **Report**: Consolidated results and PR comments

### Environment Variables (CI Secrets)

Required GitHub Secrets:

```
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
JWT_SECRET=your_production_jwt_secret
```

### Matrix Testing Configuration

- **Browsers**: Chromium, Firefox, WebKit
- **Shards**: 4-way parallel execution per browser
- **Timeout**: 30 minutes per job
- **Retries**: 2 retries on failure
- **Artifacts**: Test reports, traces, videos, screenshots

## 📊 Test Results & Reporting

### Local Reports

```bash
# HTML report (auto-opens after tests)
npx playwright show-report

# View traces for failed tests
npx playwright show-trace test-results/[test-name]/trace.zip
```

### CI Reports

- **HTML Reports**: Available as GitHub Actions artifacts
- **JUnit XML**: For integration with test management tools
- **JSON Results**: Machine-readable results for processing
- **PR Comments**: Automated summary on pull requests

### Artifact Retention

- **Test Results**: 7 days
- **Traces/Videos**: 7 days (failures only)
- **Test Summary**: 30 days

## 🔍 Troubleshooting

### Common Issues

#### 1. Test Data Conflicts

**Symptoms:** Tests fail with "user already exists" or "constraint violation"

**Solutions:**
```bash
# Clean existing test data
npm run test:clean

# Re-seed fresh data
npm run test:seed

# Check database state
npx supabase db inspect
```

#### 2. Port Conflicts

**Symptoms:** "Port 4173 already in use"

**Solutions:**
```bash
# Kill existing processes
pkill -f "vite preview"
lsof -ti:4173 | xargs kill

# Use different port
npm run preview -- --port 4174
TEST_URL=http://localhost:4174 npm run test:e2e
```

#### 3. Authentication Failures

**Symptoms:** "Login failed" or "Unauthorized access"

**Solutions:**
```bash
# Verify test users exist
npm run test:seed

# Check Supabase connection
curl "$VITE_SUPABASE_URL/rest/v1/" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"

# Reset user passwords
npx supabase auth reset --email admin@test.local
```

#### 4. Timeout Issues

**Symptoms:** Tests timeout or hang

**Solutions:**
```bash
# Increase timeout in playwright.config.ts
timeout: 120000 # 2 minutes

# Run with debug mode
npx playwright test --debug

# Run headed mode to see browser
npx playwright test --headed
```

#### 5. Browser Installation Issues

**Symptoms:** "Browser not found" errors

**Solutions:**
```bash
# Reinstall browsers
npx playwright install --force

# Install system dependencies
npx playwright install-deps

# Check browser status
npx playwright install --dry-run
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=pw:api npm run test:e2e

# Run with browser visible
npx playwright test --headed --slowmo=1000

# Pause on failure
npx playwright test --debug

# Record video for all tests
npx playwright test --video=on
```

### Performance Issues

#### Slow Test Execution

```bash
# Run in parallel (default)
npx playwright test --workers=4

# Reduce parallelization for stability
npx playwright test --workers=1

# Skip heavy tests during development
npx playwright test --grep-invert="should upload large media files"
```

#### Memory Issues

```bash
# Run tests in smaller batches
npx playwright test tests/e2e/booking.spec.ts
npx playwright test tests/e2e/admin-crud.spec.ts

# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e
```

### Database Issues

#### Supabase Connection

```bash
# Test direct connection
curl "$SUPABASE_URL/rest/v1/profiles?select=id" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Check RLS policies
npx supabase db inspect --table profiles

# Reset RLS policies
npx supabase db reset
```

#### Test Data Isolation

```bash
# Use separate test database
SUPABASE_URL=your_test_database_url npm run test:e2e

# Clean before each test run
npm run test:clean && npm run test:seed && npm run test:e2e
```

## 📈 Best Practices

### Test Development

1. **Use Page Object Model**: Encapsulate page interactions in helper classes
2. **Explicit Waits**: Use `waitForSelector` instead of `setTimeout`
3. **Idempotent Tests**: Each test should be independent and rerunnable
4. **Clear Test Data**: Always clean up test data after test runs
5. **Meaningful Assertions**: Use descriptive error messages

### Performance

1. **Parallel Execution**: Use test.describe.parallel() for independent tests
2. **Shared Context**: Reuse authentication state when possible
3. **Selective Testing**: Use tags to run specific test categories
4. **Resource Cleanup**: Close connections and clean up resources

### Maintenance

1. **Regular Updates**: Keep Playwright and dependencies updated
2. **Test Reviews**: Regular review of test effectiveness and coverage
3. **Flaky Test Monitoring**: Track and fix unreliable tests
4. **Documentation Updates**: Keep this documentation current

## 🔒 Security Considerations

### Test Environment Isolation

- Use dedicated test database and Supabase project
- Never run tests against production data
- Use test-specific API keys and secrets
- Implement proper RBAC testing

### Sensitive Data Handling

- Store test credentials in environment variables
- Use GitHub Secrets for CI/CD credentials
- Avoid hardcoding passwords or API keys
- Implement proper test data cleanup

### Rate Limiting

- Respect API rate limits during test execution
- Use appropriate delays between requests
- Monitor for rate limit responses (429)
- Implement retry logic for transient failures

## 📚 Additional Resources

### Documentation Links

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### Internal Documentation

- [Architecture Overview](./integration.md)
- [Security Compliance](./SECURITY_COMPLIANCE_HARDENING.md)
- [Production E2E Tests](./PRODUCTION_E2E_TESTS.md)
- [Enhanced E2E Testing](./enhanced-e2e-testing.md)

### Support

For issues with the E2E test suite:

1. Check this troubleshooting guide
2. Review GitHub Actions logs
3. Check Supabase dashboard for errors
4. Create an issue with detailed error logs and steps to reproduce