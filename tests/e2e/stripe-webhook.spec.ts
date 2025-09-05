import { test, expect } from '@playwright/test';

test.describe('Stripe Webhook Tests', () => {
  test('should return 400 for invalid webhook signature', async ({ page }) => {
    await test.step('Test invalid signature response', async () => {
      console.log('🔐 Testing Stripe webhook invalid signature handling...');
      
      // Test webhook endpoint with invalid signature
      const response = await page.request.post('/api/webhooks/stripe', {
        headers: {
          'stripe-signature': 'invalid_signature',
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          id: 'evt_test_webhook',
          object: 'event',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_payment_intent'
            }
          }
        })
      });

      console.log(`Webhook response status: ${response.status()}`);
      console.log(`Webhook response headers:`, response.headers());
      
      // Should return 400 for invalid signature
      expect(response.status()).toBe(400);
      
      const responseBody = await response.json();
      console.log('Webhook response body:', JSON.stringify(responseBody, null, 2));
      
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toMatch(/signature|invalid/i);
      
      console.log('✅ Webhook correctly returns 400 for invalid signature');
    });
  });

  test('should return 405 for non-POST requests', async ({ page }) => {
    await test.step('Test method not allowed', async () => {
      console.log('🚫 Testing webhook method validation...');
      
      // Test with GET request
      const response = await page.request.get('/api/webhooks/stripe');
      console.log(`GET request response status: ${response.status()}`);
      
      expect(response.status()).toBe(405);
      
      const responseBody = await response.json();
      console.log('Method not allowed response:', JSON.stringify(responseBody, null, 2));
      
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toMatch(/method.*not.*allowed/i);
      
      console.log('✅ Webhook correctly returns 405 for non-POST requests');
    });
  });

  test('should handle missing signature gracefully', async ({ page }) => {
    await test.step('Test missing signature', async () => {
      console.log('📋 Testing webhook missing signature handling...');
      
      // Test webhook endpoint without signature header
      const response = await page.request.post('/api/webhooks/stripe', {
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          id: 'evt_test_webhook',
          object: 'event',
          type: 'payment_intent.succeeded'
        })
      });

      console.log(`Missing signature response status: ${response.status()}`);
      
      // Should return 400 for missing signature
      expect(response.status()).toBe(400);
      
      const responseBody = await response.json();
      console.log('Missing signature response:', JSON.stringify(responseBody, null, 2));
      
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toMatch(/missing.*signature/i);
      
      console.log('✅ Webhook correctly handles missing signature');
    });
  });
});