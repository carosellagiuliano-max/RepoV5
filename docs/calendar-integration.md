# Calendar Integration Documentation

## Overview

This document describes the calendar integration feature that provides iCal feeds for staff members and optional Google Calendar synchronization.

## Features

### 1. iCal Feeds
- Read-only iCal feeds per staff member
- Signed, unguessable URLs for security
- RFC 5545 compliant format
- Automatic appointment updates

### 2. Google Calendar Sync (Optional)
- Two-way synchronization with Google Calendar
- OAuth-based authentication
- Conflict resolution
- Encrypted token storage

## Database Schema

### Calendar Tokens Table
```sql
CREATE TABLE calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  feed_type VARCHAR(20) NOT NULL CHECK (feed_type IN ('ical', 'google')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_tokens_staff_id ON calendar_tokens(staff_id);
CREATE INDEX idx_calendar_tokens_token_hash ON calendar_tokens(token_hash);
```

### Google Calendar Mappings (Optional)
```sql
CREATE TABLE google_calendar_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  google_calendar_id VARCHAR(255) NOT NULL,
  google_access_token TEXT NOT NULL, -- Encrypted
  google_refresh_token TEXT, -- Encrypted  
  token_expires_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_calendar_mappings_staff_id ON google_calendar_mappings(staff_id);
```

## API Endpoints

### iCal Feed
```
GET /.netlify/functions/calendar/ical/staff-feed?token=<secure_token>
```

### Google Calendar Sync (Admin only)
```
POST /.netlify/functions/calendar/google/connect
POST /.netlify/functions/calendar/google/sync
DELETE /.netlify/functions/calendar/google/disconnect
```

## Security Considerations

1. **Token Security**: All calendar tokens are cryptographically secure and hashed
2. **Access Control**: Only authenticated staff can access their own feeds
3. **Encryption**: Google API tokens are encrypted at rest
4. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
5. **Expiration**: Tokens can have optional expiration dates

## Environment Variables

```bash
# Calendar Integration
CALENDAR_TOKEN_SECRET=your_calendar_token_secret_min_32_chars
CALENDAR_ENCRYPTION_KEY=your_encryption_key_for_google_tokens

# Google Calendar API (Optional)
GOOGLE_CALENDAR_CLIENT_ID=your_google_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=https://your-domain.netlify.app/.netlify/functions/calendar/google/callback
```

## Setup Instructions

### 1. iCal Feeds Setup
1. Add environment variables to Netlify
2. Deploy the calendar functions
3. Generate calendar tokens for staff members via admin interface

### 2. Google Calendar Setup (Optional)
1. Create Google Cloud Console project
2. Enable Google Calendar API
3. Configure OAuth consent screen
4. Add redirect URI to OAuth credentials
5. Add Google environment variables to Netlify

## Admin Interface

The admin interface provides:
- Calendar token management for staff
- Google Calendar connection status
- Sync statistics and logs
- Manual sync triggers

## Error Handling

- Invalid tokens return 401 Unauthorized
- Expired tokens return 410 Gone
- Google API errors are logged and return appropriate HTTP status codes
- Failed syncs are retried with exponential backoff