-- Business Settings & Configuration
-- Enhanced settings table and default business settings

-- Note: This migration has been updated to use the consolidated business_settings table
-- The original settings table has been replaced with business_settings in the consolidated schema

-- Insert default business settings (updated for consolidated schema)
INSERT INTO business_settings (key, value, description) VALUES
  -- Opening Hours (Monday=1, Tuesday=2, ..., Saturday=6, Sunday=0)
  ('opening_hours', '{"1":{"is_open":true,"start_time":"09:00","end_time":"18:00"},"2":{"is_open":true,"start_time":"09:00","end_time":"18:00"},"3":{"is_open":true,"start_time":"09:00","end_time":"18:00"},"4":{"is_open":true,"start_time":"09:00","end_time":"19:00"},"5":{"is_open":true,"start_time":"09:00","end_time":"19:00"},"6":{"is_open":true,"start_time":"08:00","end_time":"16:00"},"0":{"is_open":false,"start_time":"10:00","end_time":"14:00"}}', 'Business opening hours by day of week (0=Sunday, 1=Monday, etc.)'),

  -- Maximum advance booking time in days
  ('max_advance_booking_days', '30', 'Maximum number of days in advance customers can book appointments'),

  -- Buffer time between appointments in minutes
  ('buffer_time_minutes', '15', 'Buffer time in minutes between appointments for cleanup and preparation'),

  -- SMTP configuration for email notifications
  ('smtp_host', '', 'SMTP server hostname for sending emails'),
  ('smtp_port', '587', 'SMTP server port (usually 587 for TLS or 465 for SSL)'),
  ('smtp_username', '', 'SMTP username for authentication'),
  ('smtp_password', '', 'SMTP password for authentication'),
  ('smtp_from_email', 'noreply@schnittwerk-your-style.de', 'From email address for outgoing emails'),
  ('smtp_from_name', 'Schnittwerk Your Style', 'From name for outgoing emails'),
  ('smtp_use_tls', 'true', 'Whether to use TLS encryption for SMTP'),

  -- Business information
  ('business_name', 'Schnittwerk Your Style', 'Official business name'),
  ('business_address', 'Musterstraße 123, 12345 Musterstadt', 'Business address'),
  ('business_phone', '+49 123 456789', 'Business phone number'),
  ('business_email', 'info@schnittwerk-your-style.de', 'Business contact email')
ON CONFLICT (key) DO NOTHING;

-- Function to validate opening hours JSON structure
CREATE OR REPLACE FUNCTION validate_opening_hours(hours JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    day_key TEXT;
    day_data JSONB;
BEGIN
    -- Check that we have data for days 0-6
    FOR day_key IN SELECT jsonb_object_keys(hours) LOOP
        -- Validate day key is 0-6
        IF NOT (day_key ~ '^[0-6]$') THEN
            RETURN FALSE;
        END IF;

        day_data := hours->day_key;

        -- Check required fields exist
        IF NOT (day_data ? 'is_open' AND day_data ? 'start_time' AND day_data ? 'end_time') THEN
            RETURN FALSE;
        END IF;

        -- Check field types
        IF NOT (jsonb_typeof(day_data->'is_open') = 'boolean') THEN
            RETURN FALSE;
        END IF;

        -- If open, validate time format (HH:MM)
        IF (day_data->>'is_open')::boolean THEN
            IF NOT (day_data->>'start_time' ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$') THEN
                RETURN FALSE;
            END IF;
            IF NOT (day_data->>'end_time' ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$') THEN
                RETURN FALSE;
            END IF;

            -- Check that end_time is after start_time
            IF (day_data->>'start_time')::time >= (day_data->>'end_time')::time THEN
                RETURN FALSE;
            END IF;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get business setting with type casting
CREATE OR REPLACE FUNCTION get_business_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
    setting_value TEXT;
BEGIN
    SELECT value INTO setting_value
    FROM business_settings
    WHERE key = setting_key;

    RETURN COALESCE(setting_value, '');
END;
$$ LANGUAGE plpgsql;

-- Function to check if a datetime is within business hours
CREATE OR REPLACE FUNCTION is_within_business_hours(check_datetime TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
    opening_hours_json TEXT;
    opening_hours JSONB;
    day_of_week INTEGER;
    day_data JSONB;
    check_time TIME;
    start_time TIME;
    end_time TIME;
BEGIN
    -- Get opening hours as text first
    opening_hours_json := get_business_setting('opening_hours');

    -- Parse as JSONB
    BEGIN
        opening_hours := opening_hours_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE; -- Invalid JSON
    END;

    -- Get day of week (0=Sunday, 1=Monday, etc.)
    day_of_week := EXTRACT(dow FROM check_datetime);

    -- Get data for this day
    day_data := opening_hours->day_of_week::text;

    IF day_data IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if business is open on this day
    IF NOT (day_data->>'is_open')::boolean THEN
        RETURN FALSE;
    END IF;

    -- Check if time is within opening hours
    check_time := check_datetime::time;
    start_time := (day_data->>'start_time')::time;
    end_time := (day_data->>'end_time')::time;

    RETURN check_time >= start_time AND check_time <= end_time;
END;
$$ LANGUAGE plpgsql;

-- Function to validate appointment timing against business rules
CREATE OR REPLACE FUNCTION validate_appointment_timing(
    appointment_start TIMESTAMPTZ,
    appointment_end TIMESTAMPTZ
) RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    max_advance_days_text TEXT;
    buffer_minutes_text TEXT;
    max_advance_days INTEGER;
    buffer_minutes INTEGER;
    current_time TIMESTAMPTZ := NOW();
    max_booking_date DATE;
BEGIN
    -- Get business settings as text
    max_advance_days_text := get_business_setting('max_advance_booking_days');
    buffer_minutes_text := get_business_setting('buffer_time_minutes');

    -- Convert to integers with defaults
    BEGIN
        max_advance_days := COALESCE(max_advance_days_text::integer, 30);
        buffer_minutes := COALESCE(buffer_minutes_text::integer, 15);
    EXCEPTION WHEN OTHERS THEN
        max_advance_days := 30;
        buffer_minutes := 15;
    END;

    -- Calculate maximum booking date
    max_booking_date := (current_time + (max_advance_days || ' days')::interval)::date;

    -- Check if appointment is in the past
    IF appointment_start <= current_time THEN
        RETURN QUERY SELECT false, 'Appointment cannot be in the past';
        RETURN;
    END IF;

    -- Check if appointment is too far in advance
    IF appointment_start::date > max_booking_date THEN
        RETURN QUERY SELECT false, FORMAT('Appointment cannot be more than %s days in advance', max_advance_days);
        RETURN;
    END IF;

    -- Check if appointment start is within business hours
    IF NOT is_within_business_hours(appointment_start) THEN
        RETURN QUERY SELECT false, 'Appointment start time is outside business hours';
        RETURN;
    END IF;

    -- Check if appointment end is within business hours
    IF NOT is_within_business_hours(appointment_end) THEN
        RETURN QUERY SELECT false, 'Appointment end time is outside business hours';
        RETURN;
    END IF;

    -- All validations passed
    RETURN QUERY SELECT true, ''::text;
    RETURN;
END;
$$ LANGUAGE plpgsql;