# Enhanced Analytics & Reporting Documentation

## Overview

The Analytics & Reporting system provides comprehensive business intelligence for the hair salon management application. It offers real-time KPIs, detailed reports, interactive drilldowns, comparison analytics, heatmaps, and automated report delivery to help salon owners make data-driven decisions.

## 🚀 New Features

### 1. Realtime Updates
- **Supabase Realtime Integration**: Live updates when appointments are created, modified, or cancelled
- **Fallback Polling**: Automatic fallback to 30-second polling if realtime connection fails
- **Connection Status**: Visual indicator showing live connection status
- **Auto-reconnection**: Automatic reconnection with exponential backoff

### 2. Interactive Drilldown Views
- **KPI Card Clicks**: Click any KPI card to view detailed appointment lists
- **Chart Interactions**: Click chart segments for filtered data views
- **Detailed Modal**: Full-featured modal with search, filtering, and export
- **Summary Statistics**: Revenue, completion rates, and average duration

### 3. Period Comparison Analytics
- **Previous Period**: Compare current month/week/day vs. previous period
- **Year-over-Year**: Compare with same period last year
- **Trend Indicators**: Green/red arrows with percentage changes
- **Smart Insights**: Automated insights highlighting key changes

### 4. Peak Times Heatmap
- **Day/Hour Grid**: 7x24 grid showing booking density
- **Color-coded Intensity**: Visual representation of appointment density
- **Peak Times Summary**: Automatic identification of busiest periods
- **Click to Drilldown**: Click heatmap cells for detailed appointment views

### 5. Scheduled Reports
- **Automated Delivery**: Weekly or monthly reports via email
- **Multiple Formats**: CSV and PDF support
- **Custom Filters**: Filter reports by staff, services, or date ranges
- **Admin Management**: Full CRUD interface for report configuration

### 6. Role-based Analytics
- **Admin Access**: Full access to all data and features
- **Staff Access**: Limited to own appointments and basic KPIs
- **RLS Security**: Database-level security policies
- **Permission-based UI**: Interface adapts based on user permissions

## API Endpoints

### Enhanced KPIs Endpoint
```
GET /.netlify/functions/admin/analytics/kpis
```

**New Query Parameters:**
- `comparisonPeriod`: 'previous_period' | 'previous_year' | 'none'

**Enhanced Response:**
```json
{
  "success": true,
  "data": {
    "totalAppointments": 150,
    "totalRevenue": 4500.00,
    "comparison": {
      "totalAppointments": {
        "current": 150,
        "previous": 120,
        "change": 30,
        "changePercentage": 25.0,
        "trend": "up"
      }
    },
    "heatmapData": [
      {
        "dayOfWeek": 1,
        "hour": 9,
        "appointments": 5,
        "density": 0.8,
        "revenue": 250.00
      }
    ],
    "realTimeUpdate": true
  },
  "permissions": {
    "canViewAllStaff": true,
    "canViewRevenue": true,
    "canExportData": true,
    "canManageReports": true
  }
}
```

### New Drilldown Endpoint
```
GET /.netlify/functions/admin/analytics/drilldown
```

**Query Parameters:**
- `metric`: 'appointments' | 'revenue' | 'staff' | 'service'
- `value`: Filter value (staff ID, service ID, date, etc.)
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `status`: Comma-separated status values

**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "uuid",
        "date": "2024-01-15",
        "time": "14:30",
        "customerName": "Maria Müller",
        "staffName": "Anna Schmidt",
        "serviceName": "Damenhaarschnitt",
        "duration": 45,
        "price": 50.00,
        "status": "completed"
      }
    ],
    "total": 25,
    "summary": {
      "totalRevenue": 1250.00,
      "averageDuration": 42,
      "completionRate": 88.5
    }
  }
}
```

### Scheduled Reports Endpoints
```
GET    /.netlify/functions/admin/analytics/reports
POST   /.netlify/functions/admin/analytics/reports
PUT    /.netlify/functions/admin/analytics/reports/{id}
PATCH  /.netlify/functions/admin/analytics/reports/{id}
DELETE /.netlify/functions/admin/analytics/reports/{id}
POST   /.netlify/functions/admin/analytics/reports/send
```

## Frontend Components

### Enhanced AnalyticsDashboard
```tsx
<AnalyticsDashboard />
```

**New Features:**
- Real-time connection indicator
- 6 tabs: Overview, Revenue, Staff, Services, Heatmap, Reports
- Comparison analytics section
- Drilldown modal integration

### Interactive Components

#### DrilldownModal
```tsx
<DrilldownModal
  isOpen={true}
  onClose={() => {}}
  metric="appointments"
  title="Appointment Details"
  filters={drilldownFilters}
  onFiltersChange={setFilters}
/>
```

#### HeatmapChart
```tsx
<HeatmapChart
  data={heatmapData}
  onCellClick={(day, hour, data) => {
    // Handle drilldown
  }}
/>
```

#### ComparisonAnalytics
```tsx
<ComparisonAnalytics
  data={comparisonData}
  period="month"
/>
```

#### ScheduledReports
```tsx
<ScheduledReports
  permissions={{
    canManageReports: true
  }}
/>
```

## Database Schema

### New Tables

#### scheduled_reports
```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(20), -- 'weekly' | 'monthly'
  format VARCHAR(10),    -- 'csv' | 'pdf'
  recipients JSONB,      -- ["email1@example.com"]
  filters JSONB,         -- Analytics filters
  is_active BOOLEAN DEFAULT true,
  next_run TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### report_deliveries
```sql
CREATE TABLE report_deliveries (
  id UUID PRIMARY KEY,
  report_id UUID,
  status VARCHAR(20), -- 'pending' | 'generating' | 'sent' | 'failed'
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  file_url TEXT,
  error JSONB,
  created_at TIMESTAMPTZ
);
```

### Enhanced Views

#### appointments_with_details
Updated view with proper field mappings for analytics:
- Customer details (name, email, phone)
- Staff details (name, email)
- Service details (name, category, duration, price)
- Calculated fields for analytics

## Real-time Implementation

### Supabase Realtime Setup
```typescript
const channel = supabase
  .channel('analytics_updates')
  .on('postgres_changes', 
    { 
      event: '*', 
      schema: 'public', 
      table: 'appointments' 
    }, 
    (payload) => {
      // Refresh analytics data
      refetchAnalytics()
    }
  )
  .subscribe()
```

### Fallback Polling
```typescript
const pollingInterval = setInterval(() => {
  refetchAnalytics()
}, 30000) // 30 seconds
```

## Security & Permissions

### Role-based Access Control
```typescript
interface AnalyticsPermissions {
  canViewAllStaff: boolean      // Admin only
  canViewRevenue: boolean       // Admin + Staff
  canExportData: boolean        // Admin + Staff
  canManageReports: boolean     // Admin only
  ownStaffId?: string          // Staff sees only own data
}
```

### RLS Policies
- **Admin**: Full access to all analytics data
- **Staff**: Limited to own appointments and aggregated metrics
- **Customer**: No access to analytics

## Performance Optimizations

### Database Indexes
```sql
-- Analytics performance indexes
CREATE INDEX idx_appointments_start_time ON appointments(starts_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_staff_status ON appointments(staff_id, status);
CREATE INDEX idx_appointments_service_status ON appointments(service_id, status);
```

### Client-side Caching
- React Query for server state management
- 5-minute cache with background refetch
- Real-time invalidation on data changes

### Rate Limiting
- KPIs: 60 requests/minute
- Drilldown: 30 requests/minute
- Export: 20 requests/minute
- Report generation: 5 requests/minute

## Testing

### Enhanced Test Coverage
- **Unit Tests**: All new components and hooks
- **Integration Tests**: API endpoints and database queries
- **E2E Tests**: Complete user workflows
- **Real-time Tests**: WebSocket connection handling
- **Performance Tests**: Large dataset handling

### Test Files
- `src/test/analytics.test.tsx` - Enhanced frontend tests
- `netlify/functions/admin/analytics/*.test.ts` - Backend API tests
- `src/test/analytics-realtime.test.ts` - Real-time feature tests

## Deployment & Configuration

### Environment Variables
```bash
# Existing
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# New for enhanced features
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For admin operations
SMTP_HOST=your_smtp_host                         # For report delivery
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

### Database Migration
Run the migration script:
```sql
-- Apply enhanced analytics schema
\i docs/db/14_analytics_enhancements.sql
```

## Usage Examples

### Basic Analytics View
```typescript
const { data, isLoading, isRealTimeConnected } = useAnalytics({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  period: 'month',
  comparisonPeriod: 'previous_period'
})
```

### Drilldown Integration
```typescript
const handleKPIClick = (metric, title, value) => {
  setDrilldownModal({
    isOpen: true,
    metric,
    title,
    filters: {
      metric,
      value,
      startDate,
      endDate
    }
  })
}
```

### Scheduled Report Creation
```typescript
const createReport = async (reportData) => {
  const response = await fetch('/.netlify/functions/admin/analytics/reports', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Monthly Revenue Report',
      frequency: 'monthly',
      format: 'csv',
      recipients: ['admin@salon.com'],
      filters: { period: 'month' }
    })
  })
}
```

## Troubleshooting

### Real-time Connection Issues
1. Check WebSocket connection in browser dev tools
2. Verify Supabase project settings allow real-time
3. Check rate limiting and connection limits
4. Monitor fallback polling activation

### Performance Issues
1. Check database query performance with EXPLAIN
2. Verify proper indexing on large datasets
3. Monitor memory usage with large heatmap data
4. Consider data archiving for old appointments

### Report Delivery Issues
1. Verify SMTP configuration
2. Check recipient email validity
3. Monitor report_deliveries table for errors
4. Verify file storage permissions

## Migration Guide

### From Previous Version
1. **Database**: Run migration script `14_analytics_enhancements.sql`
2. **Dependencies**: No new dependencies required
3. **Environment**: Add SMTP configuration for reports
4. **Code**: Enhanced components are backward compatible

### Breaking Changes
- None - all changes are additive and backward compatible

## Future Enhancements

### Planned Features
1. **Advanced Filtering**: Custom date ranges, multi-select filters
2. **Dashboard Customization**: User-configurable KPI cards
3. **Mobile Analytics**: Touch-optimized interface
4. **AI Insights**: Machine learning-based recommendations
5. **Advanced Charts**: Gantt charts, forecasting views

### Performance Improvements
1. **Data Warehouse**: Separate analytics database
2. **Background Jobs**: Async report generation
3. **CDN Integration**: Static asset optimization
4. **Advanced Caching**: Redis integration

The enhanced Analytics & Reporting system provides a comprehensive, real-time, and user-friendly business intelligence solution that scales with salon operations while maintaining security and performance standards.