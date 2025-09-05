import { createClient } from '@supabase/supabase-js'

const testUserEmails = [
  'admin@test.local',
  'staff@test.local', 
  'customer@test.local'
]

async function cleanTestData() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase credentials not configured')
    process.exit(1)
  }

  console.log('🧹 Cleaning test data...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Get test user IDs
    const { data: testUsers } = await supabase
      .from('profiles')
      .select('id')
      .in('email', testUserEmails)
    
    if (testUsers && testUsers.length > 0) {
      const userIds = testUsers.map(user => user.id)
      
      console.log(`🗑️ Cleaning data for ${userIds.length} test users...`)
      
      // Clean up appointments
      const { error: appointmentsError } = await supabase
        .from('appointments')
        .delete()
        .or(`customer_id.in.(${userIds.join(',')}),staff_id.in.(${userIds.join(',')})`)
      
      if (appointmentsError) {
        console.warn('⚠️ Error cleaning appointments:', appointmentsError.message)
      }
      
      // Clean up staff services
      const { error: staffServicesError } = await supabase
        .from('staff_services')
        .delete()
        .in('staff_id', userIds)
      
      if (staffServicesError) {
        console.warn('⚠️ Error cleaning staff services:', staffServicesError.message)
      }
      
      // Clean up staff availability
      const { error: availabilityError } = await supabase
        .from('staff_availability')
        .delete()
        .in('staff_id', userIds)
      
      if (availabilityError) {
        console.warn('⚠️ Error cleaning staff availability:', availabilityError.message)
      }
      
      // Clean up staff timeoff
      const { error: timeoffError } = await supabase
        .from('staff_timeoff')
        .delete()
        .in('staff_id', userIds)
      
      if (timeoffError) {
        console.warn('⚠️ Error cleaning staff timeoff:', timeoffError.message)
      }
      
      // Clean up media assets
      const { error: mediaError } = await supabase
        .from('media_assets')
        .delete()
        .in('uploaded_by', userIds)
      
      if (mediaError) {
        console.warn('⚠️ Error cleaning media assets:', mediaError.message)
      }
      
      // Clean up customers
      const { error: customersError } = await supabase
        .from('customers')
        .delete()
        .in('profile_id', userIds)
      
      if (customersError) {
        console.warn('⚠️ Error cleaning customers:', customersError.message)
      }
      
      // Clean up staff
      const { error: staffError } = await supabase
        .from('staff')
        .delete()
        .in('profile_id', userIds)
      
      if (staffError) {
        console.warn('⚠️ Error cleaning staff:', staffError.message)
      }
      
      // Clean up audit logs (if exists)
      try {
        await supabase
          .from('admin_audit')
          .delete()
          .in('admin_id', userIds)
      } catch (error) {
        // Table might not exist, ignore
      }
      
      // Clean up operations idempotency records
      try {
        await supabase
          .from('operations_idempotency')
          .delete()
          .in('user_id', userIds)
      } catch (error) {
        // Table might not exist, ignore
      }
      
      // Delete profiles (this should cascade delete auth users)
      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .in('id', userIds)
      
      if (profilesError) {
        console.warn('⚠️ Error cleaning profiles:', profilesError.message)
      }
      
      // Clean up auth users directly
      for (const userId of userIds) {
        try {
          await supabase.auth.admin.deleteUser(userId)
        } catch (error) {
          console.warn(`⚠️ Error deleting auth user ${userId}:`, error)
        }
      }
    }
    
    // Clean up test services
    const { error: servicesError } = await supabase
      .from('services')
      .delete()
      .or('name.ilike.%test%,description.ilike.%test%')
    
    if (servicesError) {
      console.warn('⚠️ Error cleaning test services:', servicesError.message)
    }
    
    // Clean up test notifications
    try {
      await supabase
        .from('notification_queue')
        .delete()
        .ilike('recipient_email', '%test.local%')
    } catch (error) {
      // Table might not exist, ignore
    }
    
    // Clean up test correlation data
    const correlationId = process.env.TEST_CORRELATION_ID
    if (correlationId) {
      try {
        await supabase
          .from('security_metrics')
          .delete()
          .eq('correlation_id', correlationId)
      } catch (error) {
        // Table might not exist, ignore
      }
    }
    
    console.log('✅ Test data cleaned successfully')
    
  } catch (error) {
    console.error('❌ Error cleaning test data:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  cleanTestData()
}

export { cleanTestData }