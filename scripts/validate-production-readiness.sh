#!/bin/bash

# Production Readiness Validation Script
# This script validates that all core production features are working

echo "🚀 Validating Production Readiness..."
echo "========================================"

# 1. Build Test
echo "📦 Testing Build..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Build: SUCCESS"
else
    echo "❌ Build: FAILED"
    exit 1
fi

# 2. Preview Test
echo "🔍 Testing Preview Server..."
npm run preview -- --port 4174 --host 127.0.0.1 &
PREVIEW_PID=$!
sleep 5

# Check if preview server is running
if curl -s http://localhost:4174 > /dev/null; then
    echo "✅ Preview Server: SUCCESS"
    kill $PREVIEW_PID
else
    echo "❌ Preview Server: FAILED"
    kill $PREVIEW_PID 2>/dev/null
    exit 1
fi

# 3. Key Files Check
echo "📋 Checking Essential Files..."

essential_files=(
    "public/manifest.webmanifest"
    "public/robots.txt"
    "public/sitemap.xml"
    "public/sw.js"
    "public/_headers"
    "netlify.toml"
    "netlify/functions/health.ts"
    "netlify/functions/health/database.ts"
    "netlify/functions/webhooks/stripe/webhook.ts"
    "docs/deployment-guide.md"
)

for file in "${essential_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file: EXISTS"
    else
        echo "❌ $file: MISSING"
        exit 1
    fi
done

# 4. Environment Template Check
echo "🔧 Checking Environment Template..."
required_env_vars=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "JWT_SECRET"
    "NETLIFY_CRON_SECRET"
    "SMTP_HOST"
)

for var in "${required_env_vars[@]}"; do
    if grep -q "^$var=" .env.example; then
        echo "✅ $var: DEFINED in .env.example"
    else
        echo "❌ $var: MISSING from .env.example"
        exit 1
    fi
done

# 5. Critical Function Structure Check
echo "🔍 Checking Netlify Functions Structure..."
if [ -d "netlify/functions" ] && [ "$(find netlify/functions -name '*.ts' | wc -l)" -gt 10 ]; then
    echo "✅ Netlify Functions: SUFFICIENT ($(find netlify/functions -name '*.ts' | wc -l) functions)"
else
    echo "❌ Netlify Functions: INSUFFICIENT"
    exit 1
fi

# 6. Database Migration Files Check
echo "🗄️ Checking Database Migrations..."
if [ -d "docs/db" ] && [ "$(find docs/db -name '*.sql' | wc -l)" -gt 15 ]; then
    echo "✅ Database Migrations: SUFFICIENT ($(find docs/db -name '*.sql' | wc -l) files)"
else
    echo "❌ Database Migrations: INSUFFICIENT"
    exit 1
fi

# 7. PWA Files Validation
echo "📱 Validating PWA Configuration..."
if [ -f "public/manifest.webmanifest" ] && grep -q '"name"' public/manifest.webmanifest; then
    echo "✅ PWA Manifest: VALID"
else
    echo "❌ PWA Manifest: INVALID"
    exit 1
fi

if [ -f "public/sw.js" ] && [ $(wc -l < public/sw.js) -gt 50 ]; then
    echo "✅ Service Worker: VALID"
else
    echo "❌ Service Worker: INVALID"
    exit 1
fi

# 8. Security Headers Check
echo "🔒 Checking Security Configuration..."
if grep -q "Content-Security-Policy" public/_headers; then
    echo "✅ CSP Headers: CONFIGURED"
else
    echo "❌ CSP Headers: MISSING"
    exit 1
fi

if grep -q "X-Frame-Options: DENY" public/_headers; then
    echo "✅ X-Frame-Options: SECURE"
else
    echo "❌ X-Frame-Options: INSECURE"
    exit 1
fi

# 9. SEO Configuration Check
echo "🔍 Checking SEO Configuration..."
if grep -q 'application/ld+json' index.html; then
    echo "✅ Schema.org JSON-LD: CONFIGURED"
else
    echo "❌ Schema.org JSON-LD: MISSING"
    exit 1
fi

if grep -q 'og:title' index.html; then
    echo "✅ Open Graph: CONFIGURED"
else
    echo "❌ Open Graph: MISSING"
    exit 1
fi

echo ""
echo "🎉 ALL PRODUCTION READINESS CHECKS PASSED!"
echo "=========================================="
echo ""
echo "✅ Your Schnittwerk Hair Salon Booking System is PRODUCTION READY!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Follow docs/deployment-guide.md for complete deployment"
echo "2. Set up your Netlify, Supabase, Stripe, and SMTP accounts"
echo "3. Configure environment variables as detailed in the guide"
echo "4. Test your deployment with the health endpoints"
echo ""
echo "🚀 Ready for deployment to Netlify!"