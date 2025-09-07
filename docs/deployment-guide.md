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
```

**Additional Configuration:**
```bash
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
```

---

## B) Supabase Setup

### B1. Create Supabase Project

1. **Login to Supabase**: Go to [app.supabase.com](https://app.supabase.com)
2. **Create New Project**: Click "New Project"
3. **Organization**: Select or create organization
4. **Project Name**: `schnittwerk-production` (or your preferred name)
5. **Database Password**: Generate a strong password (save it securely)
6. **Region**: Choose closest to your users (e.g., `eu-central-1` for Europe)
7. **Pricing Plan**: Free tier is sufficient for development

### B2. Get API Keys

After project creation:
1. **Go to Settings > API**: In your Supabase dashboard
2. **Copy Project URL**: `https://xxx.supabase.co`
3. **Copy anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. **Copy service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ Keep this secret!

### B3. Execute Database Migrations (Automated Script)

To ensure a safe and reliable database setup, we will use an automated script to run all necessary SQL migrations. This avoids the errors of a manual setup.

**1. Get Database Connection Details:**

- In your Supabase dashboard, go to **Settings > Database**.
- Under **Connection info**, find the following:
  - **Host**: `db.YOUR_PROJECT_ID.supabase.co`
  - **Database name**: `postgres`
  - **Port**: `5432`
  - **User**: `postgres`
- You will also need the **Database Password** you saved when you created the project in step B1.

**2. Run the Migration Script:**

- Open a terminal on your local machine, inside the project folder.
- Set the connection details as environment variables and run the script.

**On macOS/Linux:**
```bash
export DB_HOST=db.YOUR_PROJECT_ID.supabase.co
export DB_USER=postgres
export DB_PASSWORD=YOUR_DATABASE_PASSWORD
export DB_NAME=postgres
export DB_PORT=5432

npx tsx scripts/prod-db-migrate.ts
```

**On Windows (Command Prompt):**
```cmd
set DB_HOST=db.YOUR_PROJECT_ID.supabase.co
set DB_USER=postgres
set DB_PASSWORD=YOUR_DATABASE_PASSWORD
set DB_NAME=postgres
set DB_PORT=5432

npx tsx scripts/prod-db-migrate.ts
```

**On Windows (PowerShell):**
```powershell
$env:DB_HOST="db.YOUR_PROJECT_ID.supabase.co"
$env:DB_USER="postgres"
$env:DB_PASSWORD="YOUR_DATABASE_PASSWORD"
$env:DB_NAME="postgres"
$env:DB_PORT="5432"

npx tsx scripts/prod-db-migrate.ts
```

The script will connect to your database and execute all migrations from the `docs/db` folder in the correct order. If any step fails, the entire process will be safely rolled back.

### B4. Configure Storage

1. **Go to Storage** in Supabase dashboard
2. **Create bucket** named `salon-media`
3. **Set bucket policies**:
   - **File size limit**: 10MB
   - **Public**: false
   - **File types**: image/*, video/*

### B5. Update Netlify Environment Variables

Return to Netlify and update these variables with your Supabase values:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## C) Stripe Setup

### C1. Create Stripe Account

1. **Sign up at [stripe.com](https://stripe.com)**
2. **Complete business verification** (required for live payments)
3. **Enable your account** for payments

### C2. Get API Keys

#### For Development/Testing:
1. **Go to Developers > API keys**
2. **Copy Test keys**:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

#### For Production:
1. **Activate your account** (complete business verification)
2. **Copy Live keys**:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

### C3. Configure Webhook

1. **Go to Developers > Webhooks**
2. **Add endpoint**: `https://your-site-name.netlify.app/api/webhooks/stripe`
3. **Select events**:
   - `payment_intent.created`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.captured`
   - `charge.dispute.created`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy webhook secret**: `whsec_...`

### C4. Update Environment Variables

Add to Netlify:
```bash
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
```

---

## D) SMTP Setup

Choose one of these email providers:

### D1. Gmail SMTP (Simple)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings
   - Security > 2-Step Verification > App passwords
   - Generate password for "Mail"
3. **Configuration**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=Schnittwerk Your Style
   SMTP_USE_TLS=true
   ```

### D2. SendGrid (Recommended for Production)

1. **Sign up at [sendgrid.com](https://sendgrid.com)**
2. **Create API Key**:
   - Go to Settings > API Keys
   - Create API Key with "Full Access"
3. **Configuration**:
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USERNAME=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   SMTP_FROM_EMAIL=noreply@yourdomain.com
   SMTP_FROM_NAME=Schnittwerk Your Style
   SMTP_USE_TLS=true
   ```

### D3. Mailgun

1. **Sign up at [mailgun.com](https://mailgun.com)**
2. **Get SMTP credentials** from Domains > your-domain > SMTP
3. **Configuration**:
   ```bash
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USERNAME=your-mailgun-username
   SMTP_PASSWORD=your-mailgun-password
   SMTP_FROM_EMAIL=noreply@yourdomain.com
   SMTP_FROM_NAME=Schnittwerk Your Style
   SMTP_USE_TLS=true
   ```

### D4. Update Environment Variables

Add SMTP configuration to Netlify environment variables.

---

## E) GitHub Secrets Setup

For CI/CD and automated deployments:

### E1. Required Secrets

Go to your GitHub repository > **Settings > Secrets and variables > Actions**:

**Add these Repository Secrets:**

```bash
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
```

### E2. Get Netlify Tokens

1. **Netlify Personal Access Token**:
   - Go to [app.netlify.com/user/applications](https://app.netlify.com/user/applications)
   - Create "New access token"
   - Copy token as `NETLIFY_AUTH_TOKEN`

2. **Site ID**:
   - Go to your site dashboard
   - Site Settings > General > Site information
   - Copy "Site ID" as `NETLIFY_SITE_ID`

---

## F) Final Verification & Testing

### F1. Deploy and Test

1. **Trigger Deployment**: Push any change to trigger Netlify build
2. **Check Build Logs**: Ensure build completes successfully
3. **Test Site**: Visit your Netlify URL

### F2. Test Core Functions

Test these endpoints (replace `your-site-name` with your actual site):

**Health Checks:**
- `https://your-site-name.netlify.app/api/health` (should return 200)
- `https://your-site-name.netlify.app/api/health/database` (should return 200)

**Stripe Webhook:**
- Test in Stripe Dashboard > Webhooks > your endpoint > Send test webhook

### F3. Create Admin User

1. **Visit your site**: `https://your-site-name.netlify.app`
2. **Register new account** with your email
3. **Update user role to admin** in Supabase:
   ```sql
   UPDATE profiles 
   SET role = 'admin', is_active = true 
   WHERE email = 'your-email@domain.com';
   ```

### F4. Test Admin Functions

1. **Login with admin account**
2. **Go to /admin**: Test admin dashboard
3. **Create test booking**: Verify booking system works
4. **Test payments**: Create test payment with Stripe test cards

---

## G) Production Checklist

Before going live:

### G1. Security Review
- [ ] All environment variables are set correctly
- [ ] No test/development keys in production
- [ ] CORS origins configured for your domain
- [ ] Database RLS policies are active
- [ ] Admin access is restricted

### G2. Performance Check
- [ ] Site loads under 3 seconds
- [ ] Images are optimized
- [ ] Lighthouse score >90
- [ ] PWA functionality works

### G3. Business Configuration
- [ ] Update business information in environment variables
- [ ] Configure working hours
- [ ] Set up services and pricing
- [ ] Test booking flow end-to-end
- [ ] Configure email templates

### G4. Legal & Compliance
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Cookie consent configured
- [ ] GDPR compliance verified

---

## H) Troubleshooting

### Common Issues

**Build Fails:**
- Check Node.js version (use Node 18+)
- Verify all environment variables are set
- Check build logs for specific errors

**Database Connection Issues:**
- Verify Supabase URL and keys
- Check if database migrations ran successfully
- Ensure RLS policies allow access

**Stripe Webhook Not Working:**
- Verify webhook URL matches your Netlify site
- Check webhook secret is correct
- Test webhook in Stripe dashboard

**Email Not Sending:**
- Verify SMTP credentials
- Check spam folder
- Test SMTP connection

**Performance Issues:**
- Enable browser caching
- Optimize images
- Check Netlify function logs

### Getting Help

1. **Check Logs**: Netlify Functions > Function logs
2. **Database Logs**: Supabase > Logs
3. **Browser Console**: Check for JavaScript errors
4. **Network Tab**: Check API request/response

---

## Success! 🎉

Your Schnittwerk Hair Salon Booking System is now production-ready and fully deployed!

**What You Have:**
- ✅ Fully functional hair salon booking system
- ✅ Admin dashboard for managing bookings, staff, services
- ✅ Customer booking interface
- ✅ Stripe payment processing
- ✅ Email notifications
- ✅ PWA functionality
- ✅ SEO optimized
- ✅ Security hardened
- ✅ GDPR compliant
- ✅ Mobile responsive

**Next Steps:**
1. Set up your business data (services, staff, hours)
2. Configure email templates
3. Test with real customers
4. Monitor performance and usage
5. Collect feedback and iterate

**Support:**
- Documentation: Check `docs/` folder
- Monitoring: Use `/api/health` endpoints
- Logs: Check Netlify and Supabase dashboards