import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Global Setup...');
  
  // Set mock mode for testing
  process.env.DB_MOCK_MODE = 'true';
  process.env.MOCK_MODE = 'true';
  process.env.NODE_ENV = 'test';
  console.log('🎭 Mock mode enabled for testing');
  
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
    
    // Test health endpoint in mock mode
    console.log('🏥 Testing health endpoint in mock mode...');
    const healthResponse = await page.request.get('/api/health');
    console.log(`Health endpoint status: ${healthResponse.status()}`);
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      console.log('Health endpoint response:', JSON.stringify(healthData, null, 2));
      if (healthData.ok || healthData.status === 'healthy') {
        console.log('✅ Health endpoint working in mock mode');
      } else {
        console.log('⚠️ Health endpoint returned unexpected response');
      }
    } else {
      console.log('⚠️ Health endpoint not responding as expected');
    }
    
  } catch (error) {
    console.error('❌ Application accessibility check failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ E2E Global Setup completed successfully');
}

export default globalSetup;