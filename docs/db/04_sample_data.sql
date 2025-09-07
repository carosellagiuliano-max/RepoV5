-- Sample data for development and testing (UPDATED FOR CONSOLIDATED SCHEMA)
-- This file populates the database with realistic test data

-- Insert default settings
-- Note: Table renamed to business_settings, columns changed.
INSERT INTO business_settings (key, value, description) VALUES
('business_name', '"Schnittwerk - Your Style"', 'Business name displayed on the website'),
('business_phone', '"+49 123 456789"', 'Main business phone number'),
('business_email', '"info@schnittwerk.com"', 'Main business email'),
('business_address', '{"street": "Musterstraße 123", "city": "München", "postal_code": "80331", "country": "Deutschland"}', 'Business address'),
('booking_buffer_minutes', '10', 'Buffer time between appointments in minutes'),
('booking_advance_days', '30', 'How many days in advance customers can book'),
('working_hours', '{"monday": {"start": "09:00", "end": "18:00"}, "tuesday": {"start": "09:00", "end": "18:00"}, "wednesday": {"start": "09:00", "end": "18:00"}, "thursday": {"start": "09:00", "end": "20:00"}, "friday": {"start": "09:00", "end": "18:00"}, "saturday": {"start": "09:00", "end": "16:00"}, "sunday": {"closed": true}}', 'Default working hours for the business');

-- Insert sample services
-- Note: `base_price` changed to `price_cents` (integer)
INSERT INTO services (id, name, description, category, duration_minutes, price_cents, is_active, sort_order) VALUES
-- Damenschnitte
('550e8400-e29b-41d4-a716-446655440001', 'Damenschnitt Kurz', 'Professioneller Haarschnitt für kurze Haare', 'Damenschnitte', 45, 4500, true, 1),
('550e8400-e29b-41d4-a716-446655440002', 'Damenschnitt Mittel', 'Professioneller Haarschnitt für mittellange Haare', 'Damenschnitte', 60, 5500, true, 2),
('550e8400-e29b-41d4-a716-446655440003', 'Damenschnitt Lang', 'Professioneller Haarschnitt für lange Haare', 'Damenschnitte', 75, 6500, true, 3),

-- Herrenschnitte
('550e8400-e29b-41d4-a716-446655440004', 'Herrenschnitt Klassisch', 'Klassischer Herrenhaarschnitt', 'Herrenschnitte', 30, 3500, true, 4),
('550e8400-e29b-41d4-a716-446655440005', 'Herrenschnitt Modern', 'Moderner Herrenhaarschnitt mit Styling', 'Herrenschnitte', 45, 4500, true, 5),
('550e8400-e29b-41d4-a716-446655440006', 'Bart Schneiden & Styling', 'Professionelle Bartpflege und Styling', 'Herrenschnitte', 30, 2500, true, 6),

-- Colorationen
('550e8400-e29b-41d4-a716-446655440007', 'Komplettcoloration', 'Vollständige Haarfärbung', 'Colorationen', 120, 8500, true, 7),
('550e8400-e29b-41d4-a716-446655440008', 'Strähnen/Highlights', 'Professionelle Strähnen und Highlights', 'Colorationen', 90, 7500, true, 8),
('550e8400-e29b-41d4-a716-446655440009', 'Tönung', 'Schonende Haartönung', 'Colorationen', 60, 4500, true, 9),

-- Styling & Pflege
('550e8400-e29b-41d4-a716-446655440010', 'Föhnen & Styling', 'Professionelles Föhnen und Styling', 'Styling & Pflege', 30, 2500, true, 10),
('550e8400-e29b-41d4-a716-446655440011', 'Haarkur Behandlung', 'Intensive Haarpflegebehandlung', 'Styling & Pflege', 45, 3500, true, 11),
('550e8400-e29b-41d4-a716-446655440012', 'Hochsteckfrisur', 'Elegante Hochsteckfrisur für besondere Anlässe', 'Styling & Pflege', 60, 5500, true, 12);

-- Insert sample staff
-- Note: `staff` table simplified. Name/email etc. are now in `profiles` table, linked by `profile_id`.
-- This script doesn't create auth.users, so we can't link them here. We insert into the remaining staff columns.
INSERT INTO staff (id, specialties, bio, hire_date, hourly_rate) VALUES
('660e8400-e29b-41d4-a716-446655440001',
 ARRAY['Damenschnitte', 'Colorationen', 'Styling'],
 'Erfahrene Friseurin mit über 10 Jahren Berufserfahrung. Spezialisiert auf moderne Damenschnitte und kreative Colorationen.',
 '2020-01-15', 25.00),

('660e8400-e29b-41d4-a716-446655440002',
 ARRAY['Herrenschnitte', 'Bartpflege'],
 'Spezialist für klassische und moderne Herrenschnitte. Experte in der traditionellen Bartpflege.',
 '2019-03-20', 23.00),

('660e8400-e29b-41d4-a716-446655440003',
 ARRAY['Damenschnitte', 'Hochsteckfrisuren', 'Brautstyling'],
 'Kreative Stylistin mit Fokus auf Hochsteckfrisuren und Brautstyling. Perfekt für besondere Anlässe.',
 '2021-06-10', 27.00),

('660e8400-e29b-41d4-a716-446655440004',
 ARRAY['Colorationen', 'Strähnen', 'Pflege'],
 'Colorations-Expertin mit Ausbildung in Paris. Spezialisiert auf natürliche und kreative Farbtechniken.',
 '2022-02-01', 26.00);

-- Map staff to services
INSERT INTO staff_services (staff_id, service_id, custom_price, estimated_duration_minutes, is_active) VALUES
-- Maria Schmidt - Damenschnitte & Colorationen
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', NULL, NULL, true),

-- Thomas Müller - Herrenschnitte
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440006', NULL, NULL, true),

-- Anna Weber - Damenschnitte & Styling
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 65.00, 75, true),

-- Lisa Johnson - Colorationen
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440007', 95.00, 135, true),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440008', 85.00, 105, true),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440009', NULL, NULL, true),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440011', NULL, NULL, true);

-- Insert staff availability
-- Note: `availability_type` removed, using `is_available` boolean, but this sample data doesn't use it.
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time) VALUES
-- Maria Schmidt
('660e8400-e29b-41d4-a716-446655440001', 1, '09:00', '18:00'),
('660e8400-e29b-41d4-a716-446655440001', 2, '09:00', '18:00'),
('660e8400-e29b-41d4-a716-446655440001', 3, '09:00', '18:00'),
('660e8400-e29b-41d4-a716-446655440001', 4, '09:00', '20:00'),
('660e8400-e29b-41d4-a716-446655440001', 5, '09:00', '18:00'),
('660e8400-e29b-41d4-a716-446655440001', 6, '09:00', '16:00'),

-- Thomas Müller
('660e8400-e29b-41d4-a716-446655440002', 2, '10:00', '19:00'),
('660e8400-e29b-41d4-a716-446655440002', 3, '10:00', '19:00'),
('660e8400-e29b-41d4-a716-446655440002', 4, '10:00', '20:00'),
('660e8400-e29b-41d4-a716-446655440002', 5, '10:00', '19:00'),
('660e8400-e29b-41d4-a716-446655440002', 6, '09:00', '17:00'),

-- Anna Weber
('660e8400-e29b-41d4-a716-446655440003', 3, '09:00', '17:00'),
('660e8400-e29b-41d4-a716-446655440003', 4, '09:00', '20:00'),
('660e8400-e29b-41d4-a716-446655440003', 5, '09:00', '18:00'),
('660e8400-e29b-41d4-a716-446655440003', 6, '08:00', '16:00'),
('660e8400-e29b-41d4-a716-446655440003', 0, '10:00', '15:00'),

-- Lisa Johnson
('660e8400-e29b-41d4-a716-446655440004', 1, '08:30', '17:30'),
('660e8400-e29b-41d4-a716-446655440004', 2, '08:30', '17:30'),
('660e8400-e29b-41d4-a716-446655440004', 3, '08:30', '17:30'),
('660e8400-e29b-41d4-a716-446655440004', 4, '08:30', '19:30'),
('660e8400-e29b-41d4-a716-446655440004', 5, '08:30', '17:30');

-- Insert some sample time off
INSERT INTO staff_timeoff (staff_id, start_date, end_date, reason, type) VALUES
('660e8400-e29b-41d4-a716-446655440001', '2024-12-23', '2024-12-27', 'Weihnachtsurlaub', 'vacation'),
('660e8400-e29b-41d4-a716-446655440002', '2024-12-24', '2024-12-26', 'Feiertage', 'vacation'),
('660e8400-e29b-41d4-a716-446655440003', '2024-11-15', '2024-11-15', 'Arzttermin', 'personal'),
('660e8400-e29b-41d4-a716-446655440004', '2024-12-30', '2025-01-03', 'Neujahrsurlaub', 'vacation');