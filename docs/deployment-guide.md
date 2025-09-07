# Schnittwerk Production Deployment Guide

## Complete Step-by-Step Integration Instructions

This guide provides **everything** you need to deploy the Schnittwerk Hair Salon Booking System to production. After following these steps, your system will be fully operational and production-ready.

## Prerequisites

- GitHub account
- Netlify account (free tier is sufficient)
- Supabase account (free tier is sufficient)
- Stripe account (test mode for development, live mode for production)
- SMTP email provider (Gmail, SendGrid, Mailgun, etc.)

---

## A) Netlify Deployment Setup

### A1. Create Netlify Site

1. **Login to Netlify**: Go to [app.netlify.com](https://app.netlify.com) and sign in
2. **New Site from Git**: Click "New site from Git"
3. **Connect to GitHub**: Authorize Netlify to access your repository
4. **Select Repository**: Choose your forked `schnittwerk-your-style-34` repository
5. **Configure Build Settings**:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions` (auto-detected)

### A2. Configure Environment Variables

In your Netlify site dashboard, go to **Site Settings > Environment Variables** and add:

**Essential Variables:**
```bash
# Supabase Configuration (you'll get these in step B)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Site Configuration
VITE_SITE_URL=https://your-site-name.netlify.app
VITE_SITE_NAME=Schnittwerk Your Style
VITE_BUSINESS_NAME=Schnittwerk Your Style
VITE_BUSINESS_ADDRESS=Your Salon Address
VITE_BUSINESS_PHONE=+41 XX XXX XX XX
VITE_BUSINESS_EMAIL=info@yoursalon.ch

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_generated_32_char_secret_here
JWT_EXPIRES_IN=24h

# Cron Secret (generate with: openssl rand -base64 32) 
NETLIFY_CRON_SECRET=your_generated_32_char_secret_here

# Node Environment
NODE_ENV=production
VITE_APP_VERSION=1.0.0
Additional Configuration:

# Security & RBAC
VITE_RBAC_ENABLED=true
VITE_RBAC_STRICT_MODE=true
VITE_RBAC_PII_MASKING_ENABLED=true
VITE_RBAC_AUDIT_ENABLED=true

# Business Settings
VITE_DEFAULT_BOOKING_WINDOW_DAYS=30
VITE_DEFAULT_BUFFER_TIME_MINUTES=15
VITE_DEFAULT_CANCELLATION_HOURS=24
VITE_MAX_BOOKINGS_PER_DAY=50

# Media & Storage
VITE_MAX_FILE_SIZE_MB=10
VITE_STORAGE_BUCKET_NAME=salon-media
SUPABASE_STORAGE_BUCKET=salon-media

# GDPR Compliance
VITE_GDPR_RETENTION_DAYS=2555
VITE_CUSTOMER_NUMBER_PREFIX=C
VITE_AUDIT_LOG_RETENTION_DAYS=3650

# Monitoring
VITE_MONITORING_ENABLED=true
VITE_ERROR_TRACKING_ENABLED=true
VITE_HEALTH_CHECK_ENABLED=true
VITE_CORRELATION_ID_ENABLED=true

# PWA
VITE_PWA_NAME=Schnittwerk Your Style
VITE_PWA_SHORT_NAME=Schnittwerk
VITE_PWA_DESCRIPTION=Professioneller Friseursalon - Online Terminbuchung
B) Supabase Setup
B1. Create Supabase Project
Login to Supabase: Go to app.supabase.com
Create New Project: Click "New Project"
Organization: Select or create organization
Project Name: schnittwerk-production (or your preferred name)
Database Password: Generate a strong password (save it securely)
Region: Choose closest to your users (e.g., eu-central-1 for Europe)
Pricing Plan: Free tier is sufficient for development
B2. Get API Keys
After project creation:

Go to Settings > API: In your Supabase dashboard
Copy Project URL: https://xxx.supabase.co
Copy anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Copy service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... ⚠️ Keep this secret!
B3. Execute Database Migrations (Automated Script)
To ensure a safe and reliable database setup, we will use an automated script to run all necessary SQL migrations. This avoids the errors of a manual setup.

1. Get Database Connection Details:

In your Supabase dashboard, go to Settings > Database.
Under Connection info, find the following:
Host: db.YOUR_PROJECT_ID.supabase.co
Database name: postgres
Port: 5432
User: postgres
You will also need the Database Password you saved when you created the project in step B1.
2. Run the Migration Script:

Open a terminal on your local machine, inside the project folder.
Set the connection details as environment variables and run the script.
On macOS/Linux:

export DB_HOST=db.YOUR_PROJECT_ID.supabase.co
export DB_USER=postgres
export DB_PASSWORD=YOUR_DATABASE_PASSWORD
export DB_NAME=postgres
export DB_PORT=5432

npx tsx scripts/prod-db-migrate.ts
On Windows (Command Prompt):

set DB_HOST=db.YOUR_PROJECT_ID.supabase.co
set DB_USER=postgres
set DB_PASSWORD=YOUR_DATABASE_PASSWORD
set DB_NAME=postgres
set DB_PORT=5432

npx tsx scripts/prod-db-migrate.ts
On Windows (PowerShell):

$env:DB_HOST="db.YOUR_PROJECT_ID.supabase.co"
$env:DB_USER="postgres"
$env:DB_PASSWORD="YOUR_DATABASE_PASSWORD"
$env:DB_NAME="postgres"
$env:DB_PORT="5432"

npx tsx scripts/prod-db-migrate.ts
The script will connect to your database and execute all migrations from the docs/db folder in the correct order. If any step fails, the entire process will be safely rolled back.

B4. Configure Storage
Go to Storage in Supabase dashboard
Create bucket named salon-media
Set bucket policies:
File size limit: 10MB
Public: false
File types: image/, video/
B5. Update Netlify Environment Variables
Return to Netlify and update these variables with your Supabase values:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
C) Stripe Setup
C1. Create Stripe Account
Sign up at stripe.com
Complete business verification (required for live payments)
Enable your account for payments
C2. Get API Keys
For Development/Testing:
Go to Developers > API keys
Copy Test keys:
Publishable key: pk_test_...
Secret key: sk_test_...
For Production:
Activate your account (complete business verification)
Copy Live keys:
Publishable key: pk_live_...
Secret key: sk_live_...
C3. Configure Webhook
Go to Developers > Webhooks
Add endpoint: https://your-site-name.netlify.app/api/webhooks/stripe
Select events:
payment_intent.created
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
charge.captured
charge.dispute.created
invoice.payment_succeeded
invoice.payment_failed
Copy webhook secret: whsec_...
C4. Update Environment Variables
Add to Netlify:

# For Testing
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# For Production (replace test keys)
# VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
# STRIPE_SECRET_KEY=sk_live_your_live_secret_key
# STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret

# Payment Configuration
VITE_PAYMENT_ENABLED=true
VITE_PAYMENT_CURRENCY=CHF
VITE_PAYMENT_METHODS=card,apple_pay,google_pay
VITE_PAYMENT_CAPTURE_METHOD=automatic
VITE_MIN_PAYMENT_AMOUNT_CENTS=500
VITE_MAX_PAYMENT_AMOUNT_CENTS=50000
D) SMTP Setup
Choose one of these email providers:

D1. Gmail SMTP (Simple)
Enable 2-Factor Authentication on your Gmail account
Generate App Password:
Go to Google Account Settings
Security > 2-Step Verification > App passwords
Generate password for "Mail"
Configuration:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Schnittwerk Your Style
SMTP_USE_TLS=true
D2. SendGrid (Recommended for Production)
Sign up at sendgrid.com
Create API Key:
Go to Settings > API Keys
Create API Key with "Full Access"
Configuration:
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Schnittwerk Your Style
SMTP_USE_TLS=true
D3. Mailgun
Sign up at mailgun.com
Get SMTP credentials from Domains > your-domain > SMTP
Configuration:
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Schnittwerk Your Style
SMTP_USE_TLS=true
D4. Update Environment Variables
Add SMTP configuration to Netlify environment variables.

E) GitHub Secrets Setup
For CI/CD and automated deployments:

E1. Required Secrets
Go to your GitHub repository > Settings > Secrets and variables > Actions:

Add these Repository Secrets:

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe (test keys for CI)
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# JWT
JWT_SECRET=your_jwt_secret_32_chars_min

# Test Configuration
TEST_SUPABASE_URL=https://xxx.supabase.co
TEST_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TEST_URL=http://localhost:4173

# Netlify (for deployment)
NETLIFY_AUTH_TOKEN=your_netlify_auth_token
NETLIFY_SITE_ID=your_netlify_site_id
E2. Get Netlify Tokens
Netlify Personal Access Token:

Go to app.netlify.com/user/applications
Create "New access token"
Copy token as NETLIFY_AUTH_TOKEN
Site ID:

Go to your site dashboard
Site Settings > General > Site information
Copy "Site ID" as NETLIFY_SITE_ID
F) Final Verification & Testing
F1. Deploy and Test
Trigger Deployment: Push any change to trigger Netlify build
Check Build Logs: Ensure build completes successfully
Test Site: Visit your Netlify URL
F2. Test Core Functions
Test these endpoints (replace your-site-name with your actual site):

Health Checks:

https://your-site-name.netlify.app/api/health (should return 200)
https://your-site-name.netlify.app/api/health/database (should return 200)
Stripe Webhook:

Test in Stripe Dashboard > Webhooks > your endpoint > Send test webhook
F3. Create Admin User
Visit your site: https://your-site-name.netlify.app
Register new account with your email
Update user role to admin in Supabase:
UPDATE profiles 
SET role = 'admin', is_active = true 
WHERE email = 'your-email@domain.com';
F4. Test Admin Functions
Login with admin account
Go to /admin: Test admin dashboard
Create test booking: Verify booking system works
Test payments: Create test payment with Stripe test cards
G) Production Checklist
Before going live:

G1. Security Review
All environment variables are set correctly
No test/development keys in production
CORS origins configured for your domain
Database RLS policies are active
Admin access is restricted
G2. Performance Check
Site loads under 3 seconds
Images are optimized
Lighthouse score >90
PWA functionality works
G3. Business Configuration
Update business information in environment variables
Configure working hours
Set up services and pricing
Test booking flow end-to-end
Configure email templates
G4. Legal & Compliance
Privacy policy updated
Terms of service updated
Cookie consent configured
GDPR compliance verified
H) Troubleshooting
Common Issues
Build Fails:

Check Node.js version (use Node 18+)
Verify all environment variables are set
Check build logs for specific errors
Database Connection Issues:

Verify Supabase URL and keys
Check if database migrations ran successfully
Ensure RLS policies allow access
Stripe Webhook Not Working:

Verify webhook URL matches your Netlify site
Check webhook secret is correct
Test webhook in Stripe dashboard
Email Not Sending:

Verify SMTP credentials
Check spam folder
Test SMTP connection
Performance Issues:

Enable browser caching
Optimize images
Check Netlify function logs
Getting Help
Check Logs: Netlify Functions > Function logs
Database Logs: Supabase > Logs
Browser Console: Check for JavaScript errors
Network Tab: Check API request/response
Success! 🎉
Your Schnittwerk Hair Salon Booking System is now production-ready and fully deployed!

What You Have:

✅ Fully functional hair salon booking system
✅ Admin dashboard for managing bookings, staff, services
✅ Customer booking interface
✅ Stripe payment processing
✅ Email notifications
✅ PWA functionality
✅ SEO optimized
✅ Security hardened
✅ GDPR compliant
✅ Mobile responsive
Next Steps:

Set up your business data (services, staff, hours)
Configure email templates
Test with real customers
Monitor performance and usage
Collect feedback and iterate
Support:

Documentation: Check docs/ folder
Monitoring: Use /api/health endpoints
Logs: Check Netlify and Supabase dashboards