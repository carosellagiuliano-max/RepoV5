/**
 * Simple Health Check Endpoint for Mock Mode
 * 
 * Returns a simple ok:true response when DB_MOCK_MODE is enabled
 * This bypasses all database and service checks for testing
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Only GET requests are accepted.' })
    }
  }

  // Check if we're in mock mode
  const mockMode = process.env.DB_MOCK_MODE === 'true' || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.MOCK_MODE === 'true'

  if (mockMode) {
    // Simple mock response for testing
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        status: 'healthy',
        mode: 'mock',
        timestamp: new Date().toISOString(),
        version: process.env.VITE_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'test',
        uptime: Math.floor(process.uptime()),
        correlationId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    }
  }

  // In non-mock mode, return basic health without heavy checks
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      status: 'healthy',
      mode: 'production',
      timestamp: new Date().toISOString(),
      version: process.env.VITE_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      uptime: Math.floor(process.uptime()),
      correlationId: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
  }
}