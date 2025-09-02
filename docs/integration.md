# Schnittwerk Integration Documentation

## Architecture Overview

This application implements a comprehensive salon management system with:
- **Frontend**: React with Vite, TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Netlify Functions as BFF (Backend for Frontend) layer
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with role-based access control
- **Storage**: Supabase Storage for media assets
- **State Management**: TanStack Query (React Query) for server state

## Environment Variables

### Development (Vite)
Required environment variables for local development:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:5173
```

### Production (Netlify)
Required environment variables for Netlify deployment:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SITE_URL=https://your-site.netlify.app
```

### CI/CD (GitHub Actions)
Required environment variables for testing:
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Database Schema

### Core Tables

#### Profiles (extends auth.users)
- `id` (UUID, primary key, references auth.users)
- `email` (TEXT, unique)
- `full_name` (TEXT)
- `phone` (TEXT)
- `role` (enum: admin, customer, staff)

#### Customers 🆕
- `id` (UUID, primary key)
- `customer_number` (TEXT, unique, auto-generated)
- `profile_id` (UUID, references profiles.id)
- `date_of_birth` (DATE)
- `address_street` (TEXT)
- `address_city` (TEXT)
- `address_postal_code` (TEXT)
- `emergency_contact_name` (TEXT)
- `emergency_contact_phone` (TEXT)
- `notes` (TEXT)
- **GDPR Compliance Fields:**
  - `gdpr_consent_given` (BOOLEAN)
  - `gdpr_consent_date` (TIMESTAMPTZ)
  - `gdpr_data_exported_at` (TIMESTAMPTZ)
  - `gdpr_deletion_requested_at` (TIMESTAMPTZ)
- **Soft Delete Fields:**
  - `is_deleted` (BOOLEAN, default: false)
  - `deleted_at` (TIMESTAMPTZ)
  - `deleted_by` (UUID, references profiles.id)
  - `deletion_reason` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### Customer Audit Log 🆕
- `id` (UUID, primary key)
- `customer_id` (UUID, references customers.id)
- `action` (TEXT: 'created', 'updated', 'soft_deleted', 'gdpr_export', 'restored')
- `performed_by` (UUID, references profiles.id)
- `data_before` (JSONB, previous state)
- `data_after` (JSONB, new state)
- `reason` (TEXT, optional reason)
- `ip_address` (INET, for security tracking)
- `user_agent` (TEXT, for security tracking)
- `created_at` (TIMESTAMPTZ)

#### Customers
- `id` (UUID, primary key)
- `profile_id` (UUID, references profiles)
- `customer_number` (TEXT, unique)
- Personal information (address, emergency contact, etc.)

#### Staff
- `id` (UUID, primary key)
- `profile_id` (UUID, references profiles)
- `staff_number` (TEXT, unique)
- `full_name` (TEXT)
- `status` (enum: active, inactive)
- `specialties` (TEXT[])
- `bio`, `hire_date`, `hourly_rate`, `avatar_url`

#### Services
- `id` (UUID, primary key)
- `name` (TEXT)
- `category` (TEXT)
- `duration_minutes` (INTEGER)
- `base_price` (DECIMAL)
- `is_active` (BOOLEAN)

#### Staff-Services Mapping
- `id` (UUID, primary key)
- `staff_id` (UUID, references staff)
- `service_id` (UUID, references services)
- `custom_price` (DECIMAL, optional override)
- `estimated_duration_minutes` (INTEGER, optional override)

#### Appointments
- `id` (UUID, primary key)
- `customer_id` (UUID, references customers)
- `staff_id` (UUID, references staff)
- `service_id` (UUID, references services)
- `starts_at`, `ends_at` (TIMESTAMPTZ)
- `status` (enum: pending, confirmed, cancelled, completed)
- `price` (DECIMAL)
- `notes`, `internal_notes` (TEXT)

#### Staff Availability
- `id` (UUID, primary key)
- `staff_id` (UUID, references staff)
- `day_of_week` (INTEGER, 0=Sunday)
- `start_time`, `end_time` (TIME)
- `availability_type` (enum: available, unavailable)

#### Staff Time Off
- `id` (UUID, primary key)
- `staff_id` (UUID, references staff)
- `start_date`, `end_date` (DATE)
- `start_time`, `end_time` (TIME, optional for partial day)
- `reason`, `type` (TEXT)

#### Media Assets
- `id` (UUID, primary key)
- `filename`, `file_path` (TEXT)
- `category`, `tags` (TEXT, TEXT[])
- `uploaded_by` (UUID, references profiles)
- `is_public` (BOOLEAN)

#### Settings
- `id` (UUID, primary key)
- `key` (TEXT, unique)
- `value` (JSONB)
- `category` (TEXT)
- `is_public` (BOOLEAN)

### Database Functions

#### Availability Functions
- `rpc_get_available_staff(service_id, starts_at, ends_at, buffer_minutes)`
- `rpc_get_available_slots(staff_id, service_id, date, buffer_minutes)`
- `rpc_validate_appointment_slot(staff_id, service_id, starts_at, ends_at, buffer_minutes)`

#### Views
- `appointment_details` - Appointments with related customer, staff, and service data
- `staff_with_services` - Staff members with their offered services

## API Endpoints (Netlify Functions)

### Customer Management API 🆕
- `GET /.netlify/functions/admin/customers` - List customers (admin only)
  - Query params: `page`, `limit`, `search`, `sortBy`, `sortOrder`, `isDeleted`, `hasGdprConsent`, `city`, `postalCode`
- `GET /.netlify/functions/admin/customers/{id}` - Get customer details (admin only)
- `POST /.netlify/functions/admin/customers` - Create customer (admin only)
- `PUT /.netlify/functions/admin/customers/{id}` - Update customer (admin only)
- `DELETE /.netlify/functions/admin/customers/{id}` - Soft delete customer (admin only)
- `PATCH /.netlify/functions/admin/customers/{id}/restore` - Restore deleted customer (admin only)
- `GET /.netlify/functions/admin/customers/{id}/export` - Export customer data (GDPR compliance)
- `GET /.netlify/functions/admin/customers/{id}/audit-log` - Get customer audit history (admin only)

### Services API
- `GET /.netlify/functions/services` - List services
  - Query params: `include_inactive=true`
- `POST /.netlify/functions/services` - Create service (admin only)

### Staff API
- `GET /.netlify/functions/staff` - List staff
  - Query params: `service_id`, `include_inactive`, `include_services`
- `POST /.netlify/functions/staff` - Create staff member (admin only)

### Availability API
- `GET /.netlify/functions/availability` - Get availability
  - Required: `service_id`, `date`
  - Optional: `staff_id`, `buffer_minutes`

### Booking API
- `POST /.netlify/functions/booking-create` - Create appointment
- `POST /.netlify/functions/booking-cancel` - Cancel appointment

## Authentication & Authorization

### User Roles
- **Admin**: Full system access, user and content management
- **Staff**: Manage own schedule, view assigned appointments
- **Customer**: View/manage own appointments and profile

### Role-Based Access
- Determined by `profiles.role` field
- RLS policies enforce data access restrictions
- Frontend guards protect route access

### Login Flow
1. User enters credentials in login dialog
2. Supabase authentication validates
3. Profile role is fetched from database
4. User is redirected to appropriate dashboard
5. Session maintained via Supabase auth state

## Frontend Architecture

### State Management
- **TanStack Query**: Server state, caching, background updates
- **React Context**: Auth state and global UI state
- **Local State**: Component-specific state with useState/useReducer

### Key Hooks
- `useAuth()` - Authentication and user context
- `useServices()` - Service management
- `useStaff()` - Staff management
- `useAvailability()` - Availability checking
- `useAppointments()` - Appointment management
- `useCustomers()` - Customer management
- `useMedia()` - Media file management 🆕
- `useMediaUpload()` - File upload operations 🆕
- `useSignedUrls()` - Signed URL generation 🆕

### Component Structure
```
src/
├── components/
│   ├── auth/          # Authentication components
│   ├── admin/         # Admin dashboard components
│   ├── customer/      # Customer dashboard components
│   ├── booking/       # Booking flow components
│   ├── sections/      # Landing page sections
│   └── ui/           # Reusable UI components
├── contexts/         # React contexts
├── hooks/            # Custom hooks
├── lib/              # Utilities and configurations
└── pages/            # Route components
```

## Business Logic

### Appointment Booking Flow
1. Customer selects service category and specific service
2. System fetches available staff for selected service
3. Customer chooses date and sees available time slots
4. Customer selects staff member and time slot
5. System validates availability with conflict detection
6. Appointment is created with pending status
7. Staff/admin can confirm appointment

### Availability Calculation
- Staff weekly availability schedule
- Minus staff time off (vacation, sick days)
- Minus existing appointments with buffer time
- Service duration and custom durations per staff member
- Real-time conflict detection

### Data Consistency
- Unique constraints prevent double bookings
- RLS policies ensure data isolation
- Server-side validation in Netlify Functions
- Optimistic updates with rollback on error

## Local Development

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm ci
   ```

3. Create `.env.local` file with required environment variables
4. Set up Supabase project and run database migrations
5. Start development server:
   ```bash
   npm run dev
   ```

### Database Setup
1. Create new Supabase project
2. Run SQL files in order:
   - `docs/db/01_initial_schema.sql`
   - `docs/db/02_rls_policies.sql`
   - `docs/db/03_functions_views.sql`
   - `docs/db/04_sample_data.sql` (optional, for testing)

### Testing Data
Sample admin user:
- Email: `admin@schnittwerk.com`
- Role: admin (set in profiles table)

Sample customer user:
- Email: `customer@example.com`
- Role: customer

## Deployment

### Netlify Configuration
1. Connect repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Configure environment variables in Netlify dashboard
5. Netlify Functions are automatically deployed from `netlify/functions/`

### Database Migrations

Execute the following SQL migration files in order using Supabase SQL Editor:

1. **Initial Schema** (if not already deployed):
   - `docs/db/01_initial_schema.sql` - Core tables and relationships
   - `docs/db/02_rls_policies.sql` - Row Level Security policies
   - `docs/db/03_functions_views.sql` - Database functions and views
   - `docs/db/04_sample_data.sql` - Sample data for development
   - `docs/db/05_schema_updates.sql` - Schema updates and improvements
   - `docs/db/06_enhanced_functions.sql` - Enhanced database functions

2. **Customer Management & GDPR** 🆕:
   - `docs/db/07_customer_management_gdpr.sql` - Customer audit log and GDPR compliance
   - `docs/db/08_customer_rls_policies.sql` - Customer data access policies

3. **Media Management** 🆕:
   - `docs/db/09_media_management.sql` - Media storage table and metadata
   - `docs/db/10_media_rls_policies.sql` - Media access policies

**Migration Order:**
```bash
# Connect to your Supabase project and run in SQL Editor:
\i docs/db/07_customer_management_gdpr.sql
\i docs/db/08_customer_rls_policies.sql
\i docs/db/09_media_management.sql
\i docs/db/10_media_rls_policies.sql
```

**Post-Migration Verification:**
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'customer_audit_log', 'media');

-- Verify RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('customers', 'customer_audit_log', 'media');

-- Test audit trigger
INSERT INTO customers (profile_id, customer_number) 
VALUES ('test-profile-id', 'C2024TEST') 
RETURNING id;
```

### Supabase Storage Setup

**1. Create Storage Bucket:**
```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('salon-media', 'salon-media', false);
```

**2. Configure Storage Policies:**
In Supabase Dashboard > Storage > salon-media > Policies:

**Policy 1: Admin Upload**
- Name: "Admin can upload"
- Operation: INSERT
- Target roles: authenticated
- Policy: `(EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active = true))`

**Policy 2: Admin Delete**
- Name: "Admin can delete"  
- Operation: DELETE
- Target roles: authenticated
- Policy: `(EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active = true))`

**Policy 3: Read Access**
- Name: "Anyone can read"
- Operation: SELECT
- Target roles: authenticated, anon
- Policy: `true`

**Environment Variables for Production:**
Ensure these are set in Netlify:
- `VITE_GDPR_RETENTION_DAYS=2555` (7 years)
- `VITE_CUSTOMER_NUMBER_PREFIX=C`
- `VITE_AUDIT_LOG_RETENTION_DAYS=3650` (10 years)
- `VITE_MAX_FILE_SIZE_MB=10` (Media upload limit)
- `VITE_STORAGE_BUCKET_NAME=salon-media`
- `SUPABASE_STORAGE_BUCKET=salon-media`

**Backup Recommendations:**
- Always backup before running migrations
- Use Supabase CLI for automated migrations in production
- Test migrations on staging environment first

## Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies based on user role and data ownership
- Customers can only access their own data
- Staff can access their assignments and schedules
- Admins have full access

### Input Validation
- Zod schemas in Netlify Functions
- Client-side form validation
- SQL injection prevention through parameterized queries
- XSS protection through React's built-in escaping

### Authentication Security
- JWT tokens with automatic refresh
- Session management via Supabase
- Protected routes with session guards
- Password requirements enforced by Supabase

## Performance Optimization

### Query Optimization
- Database indexes on frequently queried columns
- Efficient joins in views and functions
- Pagination for large datasets
- Query result caching with TanStack Query

### Code Splitting
- Route-based code splitting
- Lazy loading of heavy components
- Dynamic imports for optional features

### Caching Strategy
- TanStack Query for server state caching
- Background refetching for real-time updates
- Optimistic updates for better UX
- Cache invalidation on mutations

## Troubleshooting

### Common Issues

**Authentication not working:**
- Check Supabase URL and keys
- Verify RLS policies are correctly applied
- Check browser network tab for API errors

**Bookings failing:**
- Verify all database tables and functions exist
- Check appointment validation function
- Ensure staff-service mappings are correct

**Build failing:**
- Check TypeScript errors
- Verify all environment variables are set
- Ensure dependencies are installed

### Debug Mode
Enable debug logging:
```bash
VITE_DEBUG=true
```

### Database Debug
Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'appointments';
```

Verify functions exist:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'rpc_%';
```

## API Documentation

### Request/Response Formats

#### Create Appointment
```javascript
POST /.netlify/functions/booking-create
Headers: { Authorization: "Bearer <token>" }
Body: {
  customer_id: "uuid",
  staff_id: "uuid", 
  service_id: "uuid",
  starts_at: "2024-01-15T10:00:00Z",
  ends_at: "2024-01-15T11:00:00Z",
  price: 45.00,
  notes: "Optional notes"
}
```

#### Get Availability
```javascript
GET /.netlify/functions/availability?service_id=uuid&date=2024-01-15&staff_id=uuid
Headers: { Authorization: "Bearer <token>" }
Response: {
  type: "slots",
  slots: [
    {
      start_time: "2024-01-15T09:00:00Z",
      end_time: "2024-01-15T10:00:00Z", 
      duration_minutes: 60
    }
  ]
}
```

#### Media Management APIs 🆕

##### Get Media List
```javascript
GET /.netlify/functions/admin/media?page=1&limit=20&category=gallery
Headers: { Authorization: "Bearer <admin_token>" }
Response: {
  success: true,
  data: {
    media: [...],
    pagination: { page: 1, limit: 20, total: 50, totalPages: 3 }
  }
}
```

##### Upload Media
```javascript
// Step 1: Get signed upload URL
GET /.netlify/functions/admin/media/upload?filename=image.jpg&mimeType=image/jpeg
Headers: { Authorization: "Bearer <admin_token>" }

// Step 2: Upload to storage
PUT <signed_url>
Body: <file_binary_data>

// Step 3: Complete upload
POST /.netlify/functions/admin/media/upload
Headers: { Authorization: "Bearer <admin_token>" }
Body: {
  filePath: "uploads/2024/1/uuid.jpg",
  originalFilename: "image.jpg",
  fileSize: 1024000,
  mimeType: "image/jpeg",
  title: "Sample Image",
  category: "gallery"
}
```

##### Get Signed URL
```javascript
GET /.netlify/functions/admin/media/signed-url/{media_id}?expiresIn=3600
Headers: { Authorization: "Bearer <admin_token>" }
Response: {
  success: true,
  data: {
    media: {...},
    signedUrl: "https://...",
    expiresAt: "2024-01-15T12:00:00Z"
  }
}
```

## Support
For technical issues:
1. Check browser console for JavaScript errors
2. Verify network requests in developer tools
3. Check Supabase dashboard for database errors
4. Review Netlify function logs for server-side issues
5. Consult this documentation for configuration

## SEO & PWA Setup 🆕

### SEO Features
The application includes comprehensive SEO optimizations:

**Meta Tags & Open Graph:**
- Enhanced HTML meta tags in `index.html`
- Open Graph tags for social media sharing
- Twitter Card support
- Canonical URLs and proper SEO structure

**Schema.org JSON-LD:**
- HairSalon structured data with business information
- Address, opening hours, contact information
- Service catalog and reviews
- Local business optimization for St. Gallen

**Search Engine Optimization:**
- `robots.txt` with proper crawling directives
- `sitemap.xml` with all important pages
- SEO-friendly URLs and navigation structure
- Proper heading hierarchy and content structure

### PWA (Progressive Web App) Features
The application is fully PWA-compliant with offline support:

**Manifest Configuration:**
- `manifest.webmanifest` with complete app metadata
- App icons in multiple sizes (72x72 to 512x512)
- Install shortcuts for quick actions
- Standalone display mode for app-like experience

**Service Worker:**
- Comprehensive caching strategy (`/sw.js`)
- Offline support for critical pages
- Background sync for appointment data
- Cache-first for static assets, network-first for dynamic data
- Automatic updates with user prompts

**Caching Strategy:**
- Static assets: Cache-first strategy
- API calls: Network-first with offline fallback
- Appointment data: Fresh data prioritized
- Images and fonts: Long-term caching

### Security Headers
Netlify `_headers` configuration includes:

**Content Security Policy (CSP):**
- Strict script and style source policies
- Prevention of XSS attacks
- Secure font and image loading

**Additional Security:**
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options, X-Content-Type-Options
- Referrer-Policy and Permissions-Policy
- Protection against clickjacking and MIME sniffing

### PWA Environment Variables
Required environment variables for PWA features:
```bash
# PWA Configuration (already in .env.example)
VITE_PWA_NAME=Schnittwerk Your Style
VITE_PWA_SHORT_NAME=Schnittwerk
VITE_PWA_DESCRIPTION=Professioneller Friseursalon - Online Terminbuchung

# Site Configuration
VITE_SITE_URL=https://your-domain.netlify.app
VITE_BUSINESS_NAME=Schnittwerk Your Style
VITE_BUSINESS_ADDRESS=Kornhausstrasse 3, 9000 St. Gallen
VITE_BUSINESS_PHONE=+41 71 123 45 67
VITE_BUSINESS_EMAIL=info@schnittwerk-your-style.ch
```

### PWA Installation & Usage

**Browser Support:**
- Chrome/Edge: Full PWA support with install prompts
- Firefox: Basic PWA support
- Safari: Limited PWA support with Add to Home Screen

**Installation Process:**
1. Visit site in supported browser
2. Look for "Install App" prompt or browser menu option
3. App installs to device home screen/start menu
4. Runs in standalone mode like native app

**Offline Functionality:**
- View cached appointment lists
- Browse services and gallery
- Access contact information
- Create appointments (synced when online)

### PWA Development Usage

**Service Worker Registration:**
```typescript
import { initializePWA } from './lib/pwa';

// Automatically registers service worker
await initializePWA();
```

**PWA Status Check:**
```typescript
import { getPWAStatus } from './lib/pwa';

const status = getPWAStatus();
console.log('PWA installed:', status.isInstalled);
console.log('Can install:', status.isInstallable);
```

**Install Prompt:**
```typescript
import { pwaInstallManager } from './lib/pwa';

if (pwaInstallManager.canInstall()) {
  const installed = await pwaInstallManager.promptInstall();
}
```

**Network Status:**
```typescript
import { networkStatus } from './lib/pwa';

const unsubscribe = networkStatus.addListener((isOnline) => {
  console.log('Network status:', isOnline ? 'online' : 'offline');
});
```

**Cache Management:**
```typescript
import { cacheManager } from './lib/pwa';

const size = await cacheManager.getCacheSize();
console.log('Cache size:', cacheManager.formatBytes(size));

await cacheManager.clearAppCache(); // Clear all caches
```

### Lighthouse PWA Score
The application targets a perfect Lighthouse PWA score:
- ✅ Installable (manifest.webmanifest)
- ✅ PWA-optimized (service worker, offline support)
- ✅ Fast and reliable (caching strategy)
- ✅ Engaging (shortcuts, theming)

### Testing PWA Features

**Local Testing:**
1. Run `npm run build && npm run preview`
2. Open Chrome DevTools > Application > Service Workers
3. Check PWA installability and manifest
4. Test offline functionality by disabling network

**Production Testing:**
1. Deploy to Netlify
2. Run Lighthouse PWA audit
3. Test installation on different devices
4. Verify offline functionality

### Maintenance

**Updating Service Worker:**
- Increment version in `public/sw.js`
- Test changes thoroughly before deployment
- Monitor browser console for SW errors

**Cache Management:**
- Service worker automatically manages cache updates
- Users receive prompts for app updates
- Cache size should be monitored in production

**SEO Maintenance:**
- Update `sitemap.xml` when adding new pages
- Keep Schema.org data current with business changes
- Monitor search console for SEO performance