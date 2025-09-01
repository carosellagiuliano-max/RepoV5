# Schnittwerk Integration Documentation

## Environment Variables

### Development (Vite)
Required environment variables for local development:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Production (Netlify)
Required environment variables for Netlify deployment:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SITE_URL=https://your-site.netlify.app
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
```

### CI/CD (GitHub Actions)
Required environment variables for testing:
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
```

## Database Schema

### Appointments Table
```sql
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  service_name TEXT NOT NULL,
  hairdresser_name VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, starts_at, ends_at)
);

-- Row Level Security (RLS)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own appointments" ON appointments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" ON appointments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments" ON appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.email LIKE '%admin%' OR auth.users.email LIKE '%schnittwerk%')
    )
  );
```

## Authentication

### User Roles
User roles are determined by email patterns:
- **Admin**: Email contains "admin" or "schnittwerk"
- **Customer**: All other authenticated users

### Login Flow
1. User selects portal type (Admin or Customer)
2. Enters credentials
3. Supabase authentication validates credentials
4. User is redirected to appropriate dashboard
5. Session is maintained via Supabase auth state

### Session Management
- Sessions are automatically managed by Supabase
- Protected routes use `SessionGuard` component
- Auth state is provided via `AuthProvider` context

## Booking System

### Booking Flow
1. Customer selects service type (Women/Men haircut)
2. Chooses specific haircut and length
3. Selects date, time, and hairdresser
4. Optionally adds additional services
5. Booking is created in Supabase database
6. Duplicate prevention via unique constraint

### Booking Validation
- User must be authenticated
- All required fields must be filled
- Date must be in the future
- Time slot availability is checked
- Unique constraint prevents double bookings

### Error Handling
- Database constraint violations (duplicate bookings)
- Authentication errors
- Validation errors
- Network errors
- User-friendly error messages via toast notifications

## Local Development

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm ci
   ```

3. Create `.env.local` file with required environment variables:
   ```bash
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Testing Authentication
Create test users in your Supabase project:

**Admin User:**
- Email: `admin@schnittwerk.com`
- Password: `admin123`

**Customer User:**
- Email: `customer@example.com`
- Password: `customer123`

### Testing Bookings
1. Login as a customer
2. Navigate to customer dashboard
3. Click "Termin buchen"
4. Complete the booking flow
5. Verify appointment appears in dashboard

## Deployment

### Netlify Configuration
1. Connect repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Configure environment variables in Netlify dashboard

### Build Process
1. `npm ci` - Install dependencies
2. `npm run build` - Build for production
3. Vite builds static assets to `dist/` directory

### Netlify Functions
Serverless functions for enhanced functionality:
- `netlify/functions/booking-create.ts` - Server-side booking creation with JWT validation

## Troubleshooting

### Common Issues

**Authentication not working:**
- Check Supabase URL and anon key
- Verify user exists in Supabase auth
- Check browser network tab for API errors

**Bookings failing:**
- Verify database schema is created
- Check RLS policies are enabled
- Ensure user is authenticated
- Check for constraint violations

**Build failing:**
- Verify all environment variables are set
- Check for TypeScript errors
- Ensure all dependencies are installed

### Debug Mode
Enable debug logging by setting:
```bash
VITE_DEBUG=true
```

### Environment Check
Use browser console to verify environment:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Environment:', import.meta.env.MODE)
```

## Support
For technical issues, check:
1. Browser console for JavaScript errors
2. Network tab for API failures
3. Supabase dashboard for database errors
4. Netlify function logs for server-side issues