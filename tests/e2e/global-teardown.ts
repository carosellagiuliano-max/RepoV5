import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E Global Teardown...');
  
  // Clean up any test data if needed
  console.log('🗑️ Cleaning up test data...');
  
  // Note: Actual cleanup will be handled by individual test cleanup
  // or the clean-test-data.ts script if needed
  
  console.log('✅ E2E Global Teardown completed successfully');
}

export default globalTeardown;