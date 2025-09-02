# Booking Engine API Documentation

## Overview

The enhanced booking engine provides robust, production-ready APIs for appointment management with comprehensive business rule validation, race condition prevention, and optimal performance.

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

- **Enhanced Booking**: 30 requests/minute
- **Holiday Management**: 20 requests/minute  
- **Waitlist Management**: 20 requests/minute
- **Reschedule/Cancel**: 10 requests/minute

## Endpoints

### Enhanced Booking Management

#### Get Available Slots

```http
GET /netlify/functions/booking/enhanced?date=2024-03-15&service_id=<uuid>&staff_id=<uuid>
```

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format
- `service_id` (required): Service UUID
- `staff_id` (optional): Staff member UUID
- `buffer_minutes` (optional): Buffer time in minutes (default: 15)
- `slot_interval_minutes` (optional): Slot interval in minutes (default: 15)

**Response:**
```json
{
  "type": "slots",
  "date": "2024-03-15",
  "staff_id": "staff-uuid",
  "service_id": "service-uuid",
  "slots": [
    {
      "start_time": "2024-03-15T09:00:00Z",
      "end_time": "2024-03-15T10:00:00Z",
      "duration_minutes": 60,
      "is_preferred": true
    }
  ]
}
```

#### Create Booking

```http
POST /netlify/functions/booking/enhanced
Content-Type: application/json
X-Idempotency-Key: booking-unique-key-123
```

**Request Body:**
```json
{
  "customer_id": "customer-uuid",
  "staff_id": "staff-uuid", 
  "service_id": "service-uuid",
  "starts_at": "2024-03-15T10:00:00Z",
  "ends_at": "2024-03-15T11:00:00Z",
  "price": 75.00,
  "notes": "Customer notes"
}
```

**Response (Success):**
```json
{
  "success": true,
  "operation_id": "op-uuid",
  "appointment": {
    "id": "appt-uuid",
    "customer_id": "customer-uuid",
    "staff_id": "staff-uuid",
    "service_id": "service-uuid",
    "starts_at": "2024-03-15T10:00:00Z",
    "ends_at": "2024-03-15T11:00:00Z",
    "status": "pending",
    "price": 75.00,
    "customers": { ... },
    "staff": { ... },
    "services": { ... }
  }
}
```

**Response (Error):**
```json
{
  "error": "Booking creation failed",
  "details": "Time slot conflicts with another appointment",
  "operation_id": "op-uuid"
}
```

#### Check Booking Policies

```http
GET /netlify/functions/booking/enhanced/policies?action=cancel&appointment_id=<uuid>
```

**Query Parameters:**
- `action` (required): Either `cancel` or `reschedule`
- `appointment_id` (required): Appointment UUID

**Response:**
```json
{
  "can_cancel": true,
  "deadline_hours": 24,
  "deadline_time": "2024-03-14T10:00:00Z",
  "current_status": "confirmed"
}
```

### Holiday Management

#### List Holidays

```http
GET /netlify/functions/booking/holidays?start_date=2024-01-01&end_date=2024-12-31&type=public_holiday
```

**Query Parameters:**
- `start_date` (optional): Start date filter (YYYY-MM-DD)
- `end_date` (optional): End date filter (YYYY-MM-DD)
- `type` (optional): Holiday type (`public_holiday`, `blackout_date`, `maintenance`)
- `include_recurring` (optional): Include calculated recurring holidays (default: true)

**Response:**
```json
{
  "holidays": [
    {
      "id": "holiday-uuid",
      "name": "Christmas Day",
      "date": "2024-12-25",
      "is_recurring": true,
      "recurring_month": 12,
      "recurring_day": 25,
      "type": "public_holiday",
      "affects_all_staff": true
    }
  ],
  "recurring_holidays": [
    {
      "id": "holiday-uuid",
      "name": "Christmas Day",
      "date": "2025-12-25",
      "calculated_date": true
    }
  ]
}
```

#### Create Holiday

```http
POST /netlify/functions/booking/holidays
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Independence Day",
  "date": "2024-07-04",
  "is_recurring": true,
  "recurring_month": 7,
  "recurring_day": 4,
  "type": "public_holiday",
  "description": "National holiday",
  "affects_all_staff": true
}
```

#### Update Holiday

```http
PUT /netlify/functions/booking/holidays/<holiday_id>
Content-Type: application/json
```

#### Delete Holiday

```http
DELETE /netlify/functions/booking/holidays/<holiday_id>
```

### Waitlist Management

#### List Waitlist Entries

```http
GET /netlify/functions/booking/waitlist?service_id=<uuid>&status=active
```

**Query Parameters:**
- `customer_id` (optional): Filter by customer
- `service_id` (optional): Filter by service
- `staff_id` (optional): Filter by staff
- `status` (optional): Filter by status (`active`, `notified`, `booked`, `cancelled`)
- `date_from` (optional): Filter by preferred start date
- `date_to` (optional): Filter by preferred end date

**Response:**
```json
{
  "waitlist_entries": [
    {
      "id": "waitlist-uuid",
      "customer_id": "customer-uuid",
      "service_id": "service-uuid",
      "staff_id": "staff-uuid",
      "preferred_start_date": "2024-03-15",
      "preferred_end_date": "2024-03-22",
      "preferred_times": ["10:00", "14:00"],
      "preferred_days": [1, 2, 3, 4, 5],
      "status": "active",
      "priority": 5,
      "customers": { ... },
      "services": { ... },
      "staff": { ... }
    }
  ]
}
```

#### Add to Waitlist

```http
POST /netlify/functions/booking/waitlist
Content-Type: application/json
```

**Request Body:**
```json
{
  "customer_id": "customer-uuid",
  "service_id": "service-uuid",
  "staff_id": "staff-uuid",
  "preferred_start_date": "2024-03-15",
  "preferred_end_date": "2024-03-22",
  "preferred_times": ["10:00", "14:00", "16:00"],
  "preferred_days": [1, 2, 3, 4, 5],
  "notes": "Flexible on exact time",
  "priority": 5
}
```

#### Update Waitlist Entry

```http
PUT /netlify/functions/booking/waitlist/<waitlist_id>
Content-Type: application/json
```

#### Remove from Waitlist

```http
DELETE /netlify/functions/booking/waitlist/<waitlist_id>
```

### Reschedule & Cancel

#### Reschedule Appointment

```http
PUT /netlify/functions/booking/reschedule-cancel/reschedule
Content-Type: application/json
X-Idempotency-Key: reschedule-unique-key-123
```

**Request Body:**
```json
{
  "appointment_id": "appt-uuid",
  "new_starts_at": "2024-03-16T10:00:00Z",
  "new_ends_at": "2024-03-16T11:00:00Z",
  "reason": "Customer requested different time"
}
```

**Response:**
```json
{
  "success": true,
  "appointment": {
    "id": "appt-uuid",
    "starts_at": "2024-03-16T10:00:00Z",
    "ends_at": "2024-03-16T11:00:00Z",
    "internal_notes": "...RESCHEDULED on 2024-03-14T..."
  }
}
```

#### Cancel Appointment

```http
PUT /netlify/functions/booking/reschedule-cancel/cancel
Content-Type: application/json
X-Idempotency-Key: cancel-unique-key-123
```

**Request Body:**
```json
{
  "appointment_id": "appt-uuid",
  "reason": "Customer sick",
  "cancellation_type": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "appointment": {
    "id": "appt-uuid",
    "status": "cancelled",
    "internal_notes": "...CANCELLED on 2024-03-14T..."
  }
}
```

## Error Handling

All endpoints return structured error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["starts_at"],
      "message": "Expected string, received number"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Not authorized to access this resource"
}
```

### 409 Conflict
```json
{
  "error": "Time slot conflicts with another appointment"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Idempotency

For create, update, and delete operations, include an `X-Idempotency-Key` header to ensure safe retries:

```javascript
const idempotencyKey = `${operation}-${userId}-${timestamp}-${randomId}`

fetch('/booking/enhanced', {
  method: 'POST',
  headers: {
    'X-Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
})
```

## Client Libraries

### JavaScript/TypeScript

```typescript
class BookingClient {
  constructor(private baseUrl: string, private token: string) {}

  async getAvailableSlots(params: {
    date: string
    serviceId: string
    staffId?: string
    bufferMinutes?: number
  }) {
    const url = new URL(`${this.baseUrl}/booking/enhanced`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value.toString())
      }
    })

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return response.json()
  }

  async createBooking(data: BookingData, idempotencyKey: string) {
    const response = await fetch(`${this.baseUrl}/booking/enhanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return response.json()
  }
}
```

### React Hook

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'

export function useAvailableSlots(params: SlotParams) {
  return useQuery({
    queryKey: ['available-slots', params],
    queryFn: () => bookingClient.getAvailableSlots(params),
    enabled: !!params.date && !!params.serviceId
  })
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: {
      data: BookingData
      idempotencyKey: string
    }) => bookingClient.createBooking(data, idempotencyKey),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['available-slots'] })
    }
  })
}
```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm run test
```

Tests cover:
- Slot generation engine
- Business rule validation  
- Race condition prevention
- Idempotency behavior
- Error handling
- Performance benchmarks

### Integration Testing

```typescript
// Test booking creation with race conditions
describe('Race Condition Prevention', () => {
  it('should prevent double booking', async () => {
    const slot = { starts_at: '2024-03-15T10:00:00Z', ends_at: '2024-03-15T11:00:00Z' }
    
    const [result1, result2] = await Promise.all([
      createBooking({ ...bookingData, ...slot }, 'key-1'),
      createBooking({ ...bookingData, ...slot }, 'key-2')
    ])

    expect(result1.success && !result2.success).toBe(true)
    expect(result2.error).toContain('conflicts')
  })
})
```

### Load Testing

```bash
# Test concurrent booking load
npm run test:load
```

Target performance:
- 100 concurrent requests/second
- < 1 second for 5K slot generation
- < 100ms for availability queries

## Monitoring

### Key Metrics

Monitor these metrics in production:

```typescript
// Booking success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM booking_operations 
WHERE created_at >= NOW() - INTERVAL '1 hour'

// Average slot generation time
SELECT 
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM booking_operations 
WHERE operation_type = 'slot_generation'
AND created_at >= NOW() - INTERVAL '1 hour'

// Race condition frequency
SELECT 
  COUNT(*) as duplicate_operations
FROM booking_operations
WHERE status = 'completed'
AND idempotency_key IN (
  SELECT idempotency_key 
  FROM booking_operations 
  GROUP BY idempotency_key 
  HAVING COUNT(*) > 1
)
```

### Alerts

Set up alerts for:
- Booking success rate < 95%
- Average response time > 2 seconds
- Error rate > 5%
- Race condition frequency > 1% of requests