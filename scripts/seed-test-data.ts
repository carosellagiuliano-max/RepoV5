import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

interface TestUser {
  email: string
  password: string
  role: 'admin' | 'staff' | 'customer'
  profile: any
  additionalData?: any
}

const testUsers: TestUser[] = [
  {
    email: 'admin@test.local',
    password: 'Test123!@#',
    role: 'admin',
    profile: {
      full_name: 'Test Administrator',
      role: 'admin'
    }
  },
  {
    email: 'staff@test.local', 
    password: 'Test123!@#',
    role: 'staff',
    profile: {
      full_name: 'Test Staff Member',
      role: 'staff'
    },
    additionalData: {
      staff: {
        position: 'Senior Stylist',
        phone: '+49 123 456789',
        is_active: true,
        specialties: ['Cuts', 'Color', 'Styling']
      }
    }
  },
  {
    email: 'customer@test.local',
    password: 'Test123!@#', 
    role: 'customer',
    profile: {
      full_name: 'Test Customer',
      role: 'customer'
    },
    additionalData: {
      customer: {
        phone: '+49 987 654321',
        preferences: {
          communication: 'email',
          language: 'de'
        }
      }
    }
  }
]

const testServices = [
  {
    name: 'Herrenhaarschnitt',
    description: 'Klassischer Herrenhaarschnitt',
    duration_minutes: 30,
    price_cents: 3500, // 35.00 CHF
    category: 'Cuts',
    is_active: true
  },
  {
    name: 'Damenhaarschnitt',
    description: 'Professioneller Damenhaarschnitt',
    duration_minutes: 45,
    price_cents: 6500, // 65.00 CHF
    category: 'Cuts', 
    is_active: true
  },
  {
    name: 'Färben',
    description: 'Haarfärbung nach Wunsch',
    duration_minutes: 90,
    price_cents: 12000, // 120.00 CHF
    category: 'Color',
    is_active: true
  },
  {
    name: 'Styling',
    description: 'Professionelles Haarstyling',
    duration_minutes: 30,
    price_cents: 4500, // 45.00 CHF
    category: 'Styling',
    is_active: true
  }
]

const testAvailability = [
  {
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '18:00',
    is_available: true
  },
  {
    day_of_week: 2, // Tuesday
    start_time: '09:00', 
    end_time: '18:00',
    is_available: true
  },
  {
    day_of_week: 3, // Wednesday
    start_time: '09:00',
    end_time: '18:00',
    is_available: true
  },
  {
    day_of_week: 4, // Thursday
    start_time: '09:00',
    end_time: '18:00',
    is_available: true
  },
  {
    day_of_week: 5, // Friday
    start_time: '09:00',
    end_time: '18:00',
    is_available: true
  },
  {
    day_of_week: 6, // Saturday
    start_time: '09:00',
    end_time: '16:00',
    is_available: true
  }
]

async function seedTestData() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase credentials not configured')
    process.exit(1)
  }

  console.log('🌱 Seeding test data...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Clean existing test data first
    console.log('🧹 Cleaning existing test data...')
    await cleanTestUsers(supabase)
    
    // Create test users
    console.log('👥 Creating test users...')
    const userIds = await createTestUsers(supabase)
    
    // Create test services
    console.log('🔧 Creating test services...')
    const serviceIds = await createTestServices(supabase)
    
    // Create staff availability for staff user
    const staffUserId = userIds.find(u => u.role === 'staff')?.id
    if (staffUserId) {
      console.log('📅 Creating staff availability...')
      await createStaffAvailability(supabase, staffUserId)
      
      // Link staff to services
      console.log('🔗 Linking staff to services...')
      await linkStaffToServices(supabase, staffUserId, serviceIds)
    }
    
    // Create sample media assets
    console.log('📸 Creating sample media assets...')
    await createSampleMedia(supabase, userIds)
    
    console.log('✅ Test data seeded successfully')
    console.log('📋 Test users created:')
    testUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`)
    })
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error)
    process.exit(1)
  }
}

async function cleanTestUsers(supabase: any) {
  const testEmails = testUsers.map(u => u.email)
  
  // Delete from profiles (cascades to other tables due to foreign keys)
  const { data: existingUsers } = await supabase
    .from('profiles')
    .select('id')
    .in('email', testEmails)
  
  if (existingUsers && existingUsers.length > 0) {
    const userIds = existingUsers.map((u: any) => u.id)
    
    // Clean up related data
    await supabase.from('appointments').delete().in('customer_id', userIds)
    await supabase.from('appointments').delete().in('staff_id', userIds)
    await supabase.from('staff_services').delete().in('staff_id', userIds)
    await supabase.from('staff_availability').delete().in('staff_id', userIds)
    await supabase.from('staff_timeoff').delete().in('staff_id', userIds)
    await supabase.from('customers').delete().in('profile_id', userIds)
    await supabase.from('staff').delete().in('profile_id', userIds)
    await supabase.from('media_assets').delete().in('uploaded_by', userIds)
    
    // Finally delete profiles
    await supabase.from('profiles').delete().in('id', userIds)
  }
  
  // Also clean test services
  await supabase.from('services').delete().ilike('name', '%test%')
}

async function createTestUsers(supabase: any) {
  const userIds: Array<{id: string, role: string}> = []
  
  for (const user of testUsers) {
    // Create auth user using admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    })
    
    if (authError) {
      console.error(`❌ Failed to create auth user ${user.email}:`, authError)
      continue
    }
    
    const userId = authUser.user.id
    userIds.push({ id: userId, role: user.role })
    
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: user.email,
        ...user.profile
      })
    
    if (profileError) {
      console.error(`❌ Failed to create profile for ${user.email}:`, profileError)
      continue
    }
    
    // Create role-specific data
    if (user.role === 'staff' && user.additionalData?.staff) {
      await supabase
        .from('staff')
        .insert({
          profile_id: userId,
          ...user.additionalData.staff
        })
    } else if (user.role === 'customer' && user.additionalData?.customer) {
      await supabase
        .from('customers')
        .insert({
          profile_id: userId,
          customer_number: `C${Date.now()}${Math.floor(Math.random() * 1000)}`,
          ...user.additionalData.customer
        })
    }
  }
  
  return userIds
}

async function createTestServices(supabase: any) {
  const serviceIds: string[] = []
  
  for (const service of testServices) {
    const { data, error } = await supabase
      .from('services')
      .insert(service)
      .select('id')
      .single()
    
    if (error) {
      console.error('❌ Failed to create service:', error)
      continue
    }
    
    serviceIds.push(data.id)
  }
  
  return serviceIds
}

async function createStaffAvailability(supabase: any, staffId: string) {
  for (const availability of testAvailability) {
    await supabase
      .from('staff_availability')
      .insert({
        staff_id: staffId,
        ...availability
      })
  }
}

async function linkStaffToServices(supabase: any, staffId: string, serviceIds: string[]) {
  for (const serviceId of serviceIds) {
    await supabase
      .from('staff_services')
      .insert({
        staff_id: staffId,
        service_id: serviceId
      })
  }
}

async function createSampleMedia(supabase: any, userIds: Array<{id: string, role: string}>) {
  const adminUserId = userIds.find(u => u.role === 'admin')?.id
  
  if (!adminUserId) return
  
  const sampleMedia = [
    {
      uploaded_by: adminUserId,
      file_name: 'test-gallery-1.jpg',
      file_path: 'gallery/test-gallery-1.jpg',
      file_size: 1024 * 100, // 100KB
      mime_type: 'image/jpeg',
      is_public: true,
      alt_text: 'Test gallery image 1',
      tags: ['gallery', 'test']
    },
    {
      uploaded_by: adminUserId,
      file_name: 'test-gallery-2.jpg', 
      file_path: 'gallery/test-gallery-2.jpg',
      file_size: 1024 * 150, // 150KB
      mime_type: 'image/jpeg',
      is_public: true,
      alt_text: 'Test gallery image 2',
      tags: ['gallery', 'test']
    }
  ]
  
  for (const media of sampleMedia) {
    await supabase.from('media_assets').insert(media)
  }
}

if (require.main === module) {
  seedTestData()
}

export { seedTestData }