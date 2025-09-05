import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Global Setup...');
  
  const { baseURL } = config.projects[0].use;
  console.log(`🌐 Base URL: ${baseURL}`);
  
  // Verify the application is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Verifying application accessibility...');
    await page.goto(baseURL!, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check if the main app element is present
    await page.waitForSelector('[data-testid="app-root"], #root, body', { timeout: 10000 });
    console.log('✅ Application is accessible');
    
    // (Removed check for Supabase client to avoid coupling to implementation details)
    
  } catch (error) {
    console.error('❌ Application accessibility check failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ E2E Global Setup completed successfully');
}

export default globalSetup;