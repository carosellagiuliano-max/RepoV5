#!/usr/bin/env tsx
/**
 * E2E Test Data Cleanup
 * 
 * Removes test data created by seed-test-data.ts
 * - Test users and profiles
 * - Test services
 * - Test staff members
 * - Test availability
 * - Test media placeholders
 * - Test settings
 */

import { createClient } from '@supabase/supabase-js';

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

// Test user emails that should be cleaned up
const TEST_USER_EMAILS = [
  'admin@test.com',
  'staff@test.com',
  'receptionist@test.com',
  'customer@test.com'
];

// Test service names that should be cleaned up
const TEST_SERVICE_NAMES = [
  'Haarschnitt Damen',
  'Haarschnitt Herren',
  'Färbung',
  'Strähnchen',
  'Waschen & Föhnen'
];

// Test media filenames that should be cleaned up
const TEST_MEDIA_FILES = [
  'salon-interior-1.jpg',
  'hairstyle-1.jpg',
  'team-photo.jpg'
];

// Test setting keys that should be cleaned up
const TEST_SETTING_KEYS = [
  'business_hours',
  'booking_window_days',
  'buffer_time_minutes',
  'max_bookings_per_day',
  'cancellation_hours'
];

async function cleanupTestSettings() {
  console.log('⚙️ Cleaning up test settings...');
  
  try {
    const { error } = await supabase
      .from('settings')
      .delete()
      .in('key', TEST_SETTING_KEYS);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted ${TEST_SETTING_KEYS.length} test settings`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test settings:', error);
  }
}

async function cleanupTestMedia() {
  console.log('🖼️ Cleaning up test media placeholders...');
  
  try {
    const { error } = await supabase
      .from('media')
      .delete()
      .in('filename', TEST_MEDIA_FILES);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted ${TEST_MEDIA_FILES.length} test media items`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test media:', error);
  }
}

async function cleanupTestAvailability() {
  console.log('📅 Cleaning up test availability schedules...');
  
  try {
    // Get test staff IDs
    const { data: testStaff, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .in('email', TEST_USER_EMAILS);

    if (staffError) {
      throw staffError;
    }

    if (!testStaff || testStaff.length === 0) {
      console.log('   ⚠️ No test staff found, skipping availability cleanup...');
      return;
    }

    const staffIds = testStaff.map(s => s.id);

    const { error } = await supabase
      .from('staff_availability')
      .delete()
      .in('staff_id', staffIds);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted availability for ${staffIds.length} test staff members`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test availability:', error);
  }
}

async function cleanupTestStaff() {
  console.log('👨‍💼 Cleaning up test staff members...');
  
  try {
    const { error } = await supabase
      .from('staff')
      .delete()
      .in('email', TEST_USER_EMAILS);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted test staff members`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test staff:', error);
  }
}

async function cleanupTestServices() {
  console.log('🔧 Cleaning up test services...');
  
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .in('name', TEST_SERVICE_NAMES);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted ${TEST_SERVICE_NAMES.length} test services`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test services:', error);
  }
}

async function cleanupTestAppointments() {
  console.log('📅 Cleaning up test appointments...');
  
  try {
    // Get test user IDs
    const { data: testProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .in('email', TEST_USER_EMAILS);

    if (profileError) {
      throw profileError;
    }

    if (!testProfiles || testProfiles.length === 0) {
      console.log('   ⚠️ No test profiles found, skipping appointment cleanup...');
      return;
    }

    const userIds = testProfiles.map(p => p.id);

    // Delete appointments where customer or staff is a test user
    const { error } = await supabase
      .from('appointments')
      .delete()
      .or(`customer_id.in.(${userIds.join(',')}),staff_id.in.(${userIds.join(',')})`);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted appointments for test users`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test appointments:', error);
  }
}

async function cleanupTestProfiles() {
  console.log('👥 Cleaning up test profiles...');
  
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .in('email', TEST_USER_EMAILS);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Deleted ${TEST_USER_EMAILS.length} test profiles`);
  } catch (error) {
    console.error('   ❌ Failed to cleanup test profiles:', error);
  }
}

async function cleanupTestAuthUsers() {
  console.log('🔐 Cleaning up test auth users...');
  
  try {
    for (const email of TEST_USER_EMAILS) {
      try {
        // Get user by email
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          throw listError;
        }

        const user = users.users.find(u => u.email === email);
        
        if (user) {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
          
          if (deleteError) {
            console.error(`   ❌ Failed to delete auth user ${email}:`, deleteError);
          } else {
            console.log(`   ✅ Deleted auth user: ${email}`);
          }
        } else {
          console.log(`   ⚠️ Auth user not found: ${email}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to process auth user ${email}:`, error);
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to cleanup test auth users:', error);
  }
}

async function cleanupTestAuditLogs() {
  console.log('📋 Cleaning up test audit logs...');
  
  try {
    // Get test user IDs for audit log cleanup
    const { data: testProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .in('email', TEST_USER_EMAILS);

    // Clean up any remaining audit logs even if profiles are gone
    const { error } = await supabase
      .from('admin_audit')
      .delete()
      .or(`user_id.in.(${testProfiles?.map(p => p.id).join(',') || 'null'}),action.ilike.%test%`);

    if (error && !error.message.includes('does not exist')) {
      console.error('   ❌ Failed to cleanup audit logs:', error);
    } else {
      console.log('   ✅ Cleaned up test audit logs');
    }
  } catch (error) {
    console.error('   ❌ Failed to cleanup test audit logs:', error);
  }
}

async function main() {
  console.log('🧹 Starting E2E Test Data Cleanup...');
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

    // Clean up in reverse order of creation to handle dependencies
    await cleanupTestAuditLogs();
    console.log('');
    
    await cleanupTestAppointments();
    console.log('');
    
    await cleanupTestAvailability();
    console.log('');
    
    await cleanupTestStaff();
    console.log('');
    
    await cleanupTestServices();
    console.log('');
    
    await cleanupTestMedia();
    console.log('');
    
    await cleanupTestSettings();
    console.log('');

    await cleanupTestProfiles();
    console.log('');

    await cleanupTestAuthUsers();
    console.log('');

    console.log('🎉 E2E Test Data Cleanup completed successfully!');
    console.log('');
    console.log('📋 Cleaned up:');
    console.log(`   - ${TEST_USER_EMAILS.length} test users`);
    console.log(`   - ${TEST_SERVICE_NAMES.length} test services`);
    console.log(`   - Test staff members and availability`);
    console.log(`   - ${TEST_MEDIA_FILES.length} test media items`);
    console.log(`   - ${TEST_SETTING_KEYS.length} test settings`);
    console.log(`   - Test appointments and audit logs`);

  } catch (error) {
    console.error('❌ E2E Test Data Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as cleanTestData };