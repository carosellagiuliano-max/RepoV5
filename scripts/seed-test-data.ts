#!/usr/bin/env tsx
/**
 * E2E Test Data Seeder
 * 
 * Creates test data for E2E tests including:
 * - Test users (admin, staff, receptionist, customer)
 * - Test services
 * - Test availability schedules
 * - Test media placeholders
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  - SUPABASE_URL (or VITE_SUPABASE_URL)');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'receptionist' | 'customer';
  profile: {
    first_name: string;
    last_name: string;
    phone?: string;
    is_active: boolean;
  };
}

interface TestService {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category: string;
  is_active: boolean;
}

interface TestStaffMember {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: 'staff' | 'receptionist';
  is_active: boolean;
  specialties: string[];
}

const TEST_USERS: TestUser[] = [
  {
    email: 'admin@test.com',
    password: 'test123admin',
    role: 'admin',
    profile: {
      first_name: 'Admin',
      last_name: 'User',
      phone: '+41 79 001 00 01',
      is_active: true
    }
  },
  {
    email: 'staff@test.com',
    password: 'test123staff',
    role: 'staff',
    profile: {
      first_name: 'Staff',
      last_name: 'Member',
      phone: '+41 79 002 00 02',
      is_active: true
    }
  },
  {
    email: 'receptionist@test.com',
    password: 'test123reception',
    role: 'receptionist',
    profile: {
      first_name: 'Reception',
      last_name: 'Desk',
      phone: '+41 79 003 00 03',
      is_active: true
    }
  },
  {
    email: 'customer@test.com',
    password: 'test123customer',
    role: 'customer',
    profile: {
      first_name: 'Test',
      last_name: 'Customer',
      phone: '+41 79 004 00 04',
      is_active: true
    }
  }
];

const TEST_SERVICES: TestService[] = [
  {
    name: 'Haarschnitt Damen',
    description: 'Professioneller Haarschnitt für Damen mit Beratung',
    duration_minutes: 60,
    price_cents: 5500,
    category: 'Schnitt',
    is_active: true
  },
  {
    name: 'Haarschnitt Herren',
    description: 'Klassischer Herrenhaarschnitt mit Styling',
    duration_minutes: 45,
    price_cents: 4500,
    category: 'Schnitt',
    is_active: true
  },
  {
    name: 'Färbung',
    description: 'Professionelle Haarfärbung mit hochwertigen Produkten',
    duration_minutes: 120,
    price_cents: 8500,
    category: 'Farbe',
    is_active: true
  },
  {
    name: 'Strähnchen',
    description: 'Highlights und Lowlights für natürliche Akzente',
    duration_minutes: 90,
    price_cents: 7000,
    category: 'Farbe',
    is_active: true
  },
  {
    name: 'Waschen & Föhnen',
    description: 'Haarwäsche mit professionellem Styling',
    duration_minutes: 30,
    price_cents: 2500,
    category: 'Styling',
    is_active: true
  }
];

const TEST_STAFF: TestStaffMember[] = [
  {
    email: 'staff@test.com',
    first_name: 'Sarah',
    last_name: 'Müller',
    phone: '+41 79 002 00 02',
    role: 'staff',
    is_active: true,
    specialties: ['Schnitt', 'Farbe']
  },
  {
    email: 'receptionist@test.com',
    first_name: 'Anna',
    last_name: 'Schmidt',
    phone: '+41 79 003 00 03',
    role: 'receptionist',
    is_active: true,
    specialties: ['Beratung']
  }
];

async function createTestUsers() {
  console.log('👥 Creating test users...');
  
  for (const user of TEST_USERS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          role: user.role,
          first_name: user.profile.first_name,
          last_name: user.profile.last_name
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️ User ${user.email} already exists, skipping...`);
          continue;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: user.email,
          role: user.role,
          first_name: user.profile.first_name,
          last_name: user.profile.last_name,
          phone: user.profile.phone,
          is_active: user.profile.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        throw profileError;
      }

      console.log(`   ✅ Created user: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`   ❌ Failed to create user ${user.email}:`, error);
    }
  }
}

async function createTestServices() {
  console.log('🔧 Creating test services...');
  
  for (const service of TEST_SERVICES) {
    try {
      const { error } = await supabase
        .from('services')
        .upsert({
          name: service.name,
          description: service.description,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents,
          category: service.category,
          is_active: service.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log(`   ✅ Created service: ${service.name}`);
    } catch (error) {
      console.error(`   ❌ Failed to create service ${service.name}:`, error);
    }
  }
}

async function createTestStaff() {
  console.log('👨‍💼 Creating test staff members...');
  
  for (const staff of TEST_STAFF) {
    try {
      // Get user ID from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', staff.email)
        .single();

      if (!profile) {
        console.log(`   ⚠️ Profile not found for ${staff.email}, skipping staff creation...`);
        continue;
      }

      const { error } = await supabase
        .from('staff')
        .upsert({
          user_id: profile.id,
          first_name: staff.first_name,
          last_name: staff.last_name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          is_active: staff.is_active,
          specialties: staff.specialties,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log(`   ✅ Created staff member: ${staff.first_name} ${staff.last_name}`);
    } catch (error) {
      console.error(`   ❌ Failed to create staff member ${staff.first_name} ${staff.last_name}:`, error);
    }
  }
}

async function createTestAvailability() {
  console.log('📅 Creating test availability schedules...');
  
  try {
    // Get staff members
    const { data: staffMembers, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('is_active', true);

    if (staffError) {
      throw staffError;
    }

    if (!staffMembers || staffMembers.length === 0) {
      console.log('   ⚠️ No staff members found, skipping availability creation...');
      return;
    }

    // Create weekly availability for each staff member
    for (const staff of staffMembers) {
      const daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
      
      for (const dayOfWeek of daysOfWeek) {
        const { error } = await supabase
          .from('staff_availability')
          .upsert({
            staff_id: staff.id,
            day_of_week: dayOfWeek,
            start_time: '09:00',
            end_time: '17:00',
            is_available: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error(`   ❌ Failed to create availability for staff ${staff.id}, day ${dayOfWeek}:`, error);
        }
      }
      
      console.log(`   ✅ Created availability for staff member ${staff.id}`);
    }
  } catch (error) {
    console.error('   ❌ Failed to create test availability:', error);
  }
}

async function createTestMediaPlaceholders() {
  console.log('🖼️ Creating test media placeholders...');
  
  const mediaItems = [
    {
      filename: 'salon-interior-1.jpg',
      title: 'Salon Interior',
      alt_text: 'Modern salon interior with styling chairs',
      category: 'salon',
      is_public: true
    },
    {
      filename: 'hairstyle-1.jpg',
      title: 'Trendy Hairstyle',
      alt_text: 'Modern short hairstyle',
      category: 'gallery',
      is_public: true
    },
    {
      filename: 'team-photo.jpg',
      title: 'Team Photo',
      alt_text: 'Professional team photo',
      category: 'team',
      is_public: true
    }
  ];
  
  try {
    for (const media of mediaItems) {
      const { error } = await supabase
        .from('media')
        .upsert({
          filename: media.filename,
          title: media.title,
          alt_text: media.alt_text,
          category: media.category,
          file_size: 1024000, // 1MB placeholder
          mime_type: 'image/jpeg',
          is_public: media.is_public,
          storage_path: `public/${media.category}/${media.filename}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log(`   ✅ Created media placeholder: ${media.filename}`);
    }
  } catch (error) {
    console.error('   ❌ Failed to create media placeholders:', error);
  }
}

async function createTestSettings() {
  console.log('⚙️ Creating test business settings...');
  
  const settings = [
    {
      key: 'business_hours',
      value: {
        monday: { start: '09:00', end: '17:00', closed: false },
        tuesday: { start: '09:00', end: '17:00', closed: false },
        wednesday: { start: '09:00', end: '17:00', closed: false },
        thursday: { start: '09:00', end: '17:00', closed: false },
        friday: { start: '09:00', end: '17:00', closed: false },
        saturday: { start: '09:00', end: '16:00', closed: false },
        sunday: { start: '10:00', end: '16:00', closed: true }
      },
      category: 'business'
    },
    {
      key: 'booking_window_days',
      value: 30,
      category: 'booking'
    },
    {
      key: 'buffer_time_minutes',
      value: 15,
      category: 'booking'
    },
    {
      key: 'max_bookings_per_day',
      value: 50,
      category: 'booking'
    },
    {
      key: 'cancellation_hours',
      value: 24,
      category: 'booking'
    }
  ];
  
  try {
    for (const setting of settings) {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          category: setting.category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log(`   ✅ Created setting: ${setting.key}`);
    }
  } catch (error) {
    console.error('   ❌ Failed to create settings:', error);
  }
}

async function main() {
  console.log('🌱 Starting E2E Test Data Seeding...');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Test database connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    
    console.log('✅ Database connection successful');
    console.log('');

    // Create test data
    await createTestUsers();
    console.log('');
    
    await createTestServices();
    console.log('');
    
    await createTestStaff();
    console.log('');
    
    await createTestAvailability();
    console.log('');
    
    await createTestMediaPlaceholders();
    console.log('');
    
    await createTestSettings();
    console.log('');

    console.log('🎉 E2E Test Data Seeding completed successfully!');
    console.log('');
    console.log('📋 Test Users Created:');
    TEST_USERS.forEach(user => {
      console.log(`   ${user.email} (${user.role}) - Password: ${user.password}`);
    });

  } catch (error) {
    console.error('❌ E2E Test Data Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as seedTestData };