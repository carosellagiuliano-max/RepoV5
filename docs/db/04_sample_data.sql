-- Sample data for development and testing
-- This file populates the database with realistic test data

-- Insert default settings
INSERT INTO settings (key, value, description, category, is_public) VALUES
('business_name', '"Schnittwerk - Your Style"', 'Business name displayed on the website', 'general', true),
('business_phone', '"+49 123 456789"', 'Main business phone number', 'contact', true),
('business_email', '"info@schnittwerk.com"', 'Main business email', 'contact', true),
('business_address', '{"street": "Musterstraße 123", "city": "München", "postal_code": "80331", "country": "Deutschland"}', 'Business address', 'contact', true),
('booking_buffer_minutes', '10', 'Buffer time between appointments in minutes', 'booking', false),
('booking_advance_days', '30', 'How many days in advance customers can book', 'booking', true),
('working_hours', '{"monday": {"start": "09:00", "end": "18:00"}, "tuesday": {"start": "09:00", "end": "18:00"}, "wednesday": {"start": "09:00", "end": "18:00"}, "thursday": {"start": "09:00", "end": "20:00"}, "friday": {"start": "09:00", "end": "18:00"}, "saturday": {"start": "09:00", "end": "16:00"}, "sunday": {"closed": true}}', 'Default working hours for the business', 'general', true);

-- Insert sample services
INSERT INTO services (id, name, description, category, duration_minutes, base_price, is_active, sort_order) VALUES
-- Damenschnitte
('550e8400-e29b-41d4-a716-446655440001', 'Damenschnitt Kurz', 'Professioneller Haarschnitt für kurze Haare', 'Damenschnitte', 45, 45.00, true, 1),
('550e8400-e29b-41d4-a716-446655440002', 'Damenschnitt Mittel', 'Professioneller Haarschnitt für mittellange Haare', 'Damenschnitte', 60, 55.00, true, 2),
('550e8400-e29b-41d4-a716-446655440003', 'Damenschnitt Lang', 'Professioneller Haarschnitt für lange Haare', 'Damenschnitte', 75, 65.00, true, 3),

-- Herrenschnitte
('550e8400-e29b-41d4-a716-446655440004', 'Herrenschnitt Klassisch', 'Klassischer Herrenhaarschnitt', 'Herrenschnitte', 30, 35.00, true, 4),
('550e8400-e29b-41d4-a716-446655440005', 'Herrenschnitt Modern', 'Moderner Herrenhaarschnitt mit Styling', 'Herrenschnitte', 45, 45.00, true, 5),
('550e8400-e29b-41d4-a716-446655440006', 'Bart Schneiden & Styling', 'Professionelle Bartpflege und Styling', 'Herrenschnitte', 30, 25.00, true, 6),

-- Colorationen
('550e8400-e29b-41d4-a716-446655440007', 'Komplettcoloration', 'Vollständige Haarfärbung', 'Colorationen', 120, 85.00, true, 7),
('550e8400-e29b-41d4-a716-446655440008', 'Strähnen/Highlights', 'Professionelle Strähnen und Highlights', 'Colorationen', 90, 75.00, true, 8),
('550e8400-e29b-41d4-a716-446655440009', 'Tönung', 'Schonende Haartönung', 'Colorationen', 60, 45.00, true, 9),

-- Styling & Pflege
('550e8400-e29b-41d4-a716-446655440010', 'Föhnen & Styling', 'Professionelles Föhnen und Styling', 'Styling & Pflege', 30, 25.00, true, 10),
('550e8400-e29b-41d4-a716-446655440011', 'Haarkur Behandlung', 'Intensive Haarpflegebehandlung', 'Styling & Pflege', 45, 35.00, true, 11),
('550e8400-e29b-41d4-a716-446655440012', 'Hochsteckfrisur', 'Elegante Hochsteckfrisur für besondere Anlässe', 'Styling & Pflege', 60, 55.00, true, 12);

-- Insert sample staff
INSERT INTO staff (id, staff_number, full_name, email, phone, status, specialties, bio, hire_date, hourly_rate) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'ST001', 'Maria Schmidt', 'maria@schnittwerk.com', '+49 123 456781', 'active', 
 ARRAY['Damenschnitte', 'Colorationen', 'Styling'], 
 'Erfahrene Friseurin mit über 10 Jahren Berufserfahrung. Spezialisiert auf moderne Damenschnitte und kreative Colorationen.', 
 '2020-01-15', 25.00),

('660e8400-e29b-41d4-a716-446655440002', 'ST002', 'Thomas Müller', 'thomas@schnittwerk.com', '+49 123 456782', 'active',
 ARRAY['Herrenschnitte', 'Bartpflege'],
 'Spezialist für klassische und moderne Herrenschnitte. Experte in der traditionellen Bartpflege.',
 '2019-03-20', 23.00),

('660e8400-e29b-41d4-a716-446655440003', 'ST003', 'Anna Weber', 'anna@schnittwerk.com', '+49 123 456783', 'active',
 ARRAY['Damenschnitte', 'Hochsteckfrisuren', 'Brautstyling'],
 'Kreative Stylistin mit Fokus auf Hochsteckfrisuren und Brautstyling. Perfekt für besondere Anlässe.',
 '2021-06-10', 27.00),

('660e8400-e29b-41d4-a716-446655440004', 'ST004', 'Lisa Johnson', 'lisa@schnittwerk.com', '+49 123 456784', 'active',
 ARRAY['Colorationen', 'Strähnen', 'Pflege'],
 'Colorations-Expertin mit Ausbildung in Paris. Spezialisiert auf natürliche und kreative Farbtechniken.',
 '2022-02-01', 26.00);

-- Map staff to services
INSERT INTO staff_services (staff_id, service_id, custom_price, estimated_duration_minutes, is_active) VALUES
-- Maria Schmidt - Damenschnitte & Colorationen
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, NULL, true), -- Damenschnitt Kurz
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, true), -- Damenschnitt Mittel
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, true), -- Damenschnitt Lang
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', NULL, NULL, true), -- Komplettcoloration
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', NULL, NULL, true), -- Strähnen
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', NULL, NULL, true), -- Tönung
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', NULL, NULL, true), -- Föhnen & Styling

-- Thomas Müller - Herrenschnitte
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', NULL, NULL, true), -- Herrenschnitt Klassisch
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', NULL, NULL, true), -- Herrenschnitt Modern
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440006', NULL, NULL, true), -- Bart Schneiden

-- Anna Weber - Damenschnitte & Styling
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', NULL, NULL, true), -- Damenschnitt Kurz
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, true), -- Damenschnitt Mittel
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, true), -- Damenschnitt Lang
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', NULL, NULL, true), -- Föhnen & Styling
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', NULL, NULL, true), -- Haarkur
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 65.00, 75, true), -- Hochsteckfrisur (custom price)

-- Lisa Johnson - Colorationen
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440007', 95.00, 135, true), -- Komplettcoloration (premium)
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440008', 85.00, 105, true), -- Strähnen (premium)
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440009', NULL, NULL, true), -- Tönung
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440011', NULL, NULL, true); -- Haarkur

-- Insert staff availability (standard business hours)
-- Maria Schmidt - Monday to Friday 9-18, Saturday 9-16
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, availability_type) VALUES
('660e8400-e29b-41d4-a716-446655440001', 1, '09:00', '18:00', 'available'), -- Monday
('660e8400-e29b-41d4-a716-446655440001', 2, '09:00', '18:00', 'available'), -- Tuesday
('660e8400-e29b-41d4-a716-446655440001', 3, '09:00', '18:00', 'available'), -- Wednesday
('660e8400-e29b-41d4-a716-446655440001', 4, '09:00', '20:00', 'available'), -- Thursday (extended)
('660e8400-e29b-41d4-a716-446655440001', 5, '09:00', '18:00', 'available'), -- Friday
('660e8400-e29b-41d4-a716-446655440001', 6, '09:00', '16:00', 'available'); -- Saturday

-- Thomas Müller - Tuesday to Saturday
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, availability_type) VALUES
('660e8400-e29b-41d4-a716-446655440002', 2, '10:00', '19:00', 'available'), -- Tuesday
('660e8400-e29b-41d4-a716-446655440002', 3, '10:00', '19:00', 'available'), -- Wednesday
('660e8400-e29b-41d4-a716-446655440002', 4, '10:00', '20:00', 'available'), -- Thursday
('660e8400-e29b-41d4-a716-446655440002', 5, '10:00', '19:00', 'available'), -- Friday
('660e8400-e29b-41d4-a716-446655440002', 6, '09:00', '17:00', 'available'); -- Saturday

-- Anna Weber - Wednesday to Sunday (closed Monday/Tuesday)
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, availability_type) VALUES
('660e8400-e29b-41d4-a716-446655440003', 3, '09:00', '17:00', 'available'), -- Wednesday
('660e8400-e29b-41d4-a716-446655440003', 4, '09:00', '20:00', 'available'), -- Thursday
('660e8400-e29b-41d4-a716-446655440003', 5, '09:00', '18:00', 'available'), -- Friday
('660e8400-e29b-41d4-a716-446655440003', 6, '08:00', '16:00', 'available'), -- Saturday
('660e8400-e29b-41d4-a716-446655440003', 0, '10:00', '15:00', 'available'); -- Sunday

-- Lisa Johnson - Monday to Friday
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, availability_type) VALUES
('660e8400-e29b-41d4-a716-446655440004', 1, '08:30', '17:30', 'available'), -- Monday
('660e8400-e29b-41d4-a716-446655440004', 2, '08:30', '17:30', 'available'), -- Tuesday
('660e8400-e29b-41d4-a716-446655440004', 3, '08:30', '17:30', 'available'), -- Wednesday
('660e8400-e29b-41d4-a716-446655440004', 4, '08:30', '19:30', 'available'), -- Thursday
('660e8400-e29b-41d4-a716-446655440004', 5, '08:30', '17:30', 'available'); -- Friday

-- Insert some sample time off
INSERT INTO staff_timeoff (staff_id, start_date, end_date, reason, type) VALUES
('660e8400-e29b-41d4-a716-446655440001', '2024-12-23', '2024-12-27', 'Weihnachtsurlaub', 'vacation'),
('660e8400-e29b-41d4-a716-446655440002', '2024-12-24', '2024-12-26', 'Feiertage', 'vacation'),
('660e8400-e29b-41d4-a716-446655440003', '2024-11-15', '2024-11-15', 'Arzttermin', 'personal'),
('660e8400-e29b-41d4-a716-446655440004', '2024-12-30', '2025-01-03', 'Neujahrsurlaub', 'vacation');