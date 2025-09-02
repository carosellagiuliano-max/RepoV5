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
- Run SQL files against production Supabase project
- Use Supabase CLI for migrations in production environments
- Always backup before running migrations

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

## Support
For technical issues:
1. Check browser console for JavaScript errors
2. Verify network requests in developer tools
3. Check Supabase dashboard for database errors
4. Review Netlify function logs for server-side issues
5. Consult this documentation for configuration