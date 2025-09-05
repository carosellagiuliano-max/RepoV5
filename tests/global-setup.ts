import { chromium, FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️ Supabase credentials not found, skipping global setup')
    return
  }

  console.log('🔧 Global Setup: Initializing test environment...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Verify database connection
  const { data, error } = await supabase.from('profiles').select('id').limit(1)
  if (error) {
    console.error('❌ Database connection failed:', error.message)
    throw new Error('Database setup failed')
  }
  
  console.log('✅ Global Setup: Database connection verified')
  
  // Set up correlation ID for this test run
  const correlationId = process.env.CORRELATION_ID || `test-${Date.now()}`
  process.env.TEST_CORRELATION_ID = correlationId
  
  console.log(`🆔 Global Setup: Correlation ID set to ${correlationId}`)
  console.log('✅ Global Setup: Test environment ready')
}

export default globalSetup