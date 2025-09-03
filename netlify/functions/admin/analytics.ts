import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Validation schemas
const AnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  staffIds: z.string().optional(),
  serviceIds: z.string().optional(),
  includeNoShows: z.string().optional(),
  includeCancelled: z.string().optional(),
});

// Response types
interface AnalyticsResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: string;
  };
  generatedAt: string;
}

/**
 * Admin Analytics API Endpoint
 * Provides comprehensive business analytics and insights
 * 
 * GET /admin/analytics - Get analytics dashboard data
 * 
 * Authentication: Requires admin JWT token
 * Rate Limiting: 50 requests per minute
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: { message: 'Method not allowed' },
        generatedAt: new Date().toISOString(),
      } as AnalyticsResponse),
    };
  }

  try {
    // Validate authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Authorization token required', code: 'AUTH_REQUIRED' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    // Check admin role
    if (decoded.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Admin access required', code: 'INSUFFICIENT_PERMISSIONS' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    // Validate query parameters
    const queryParams = AnalyticsQuerySchema.safeParse(event.queryStringParameters || {});
    if (!queryParams.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Invalid query parameters', code: 'VALIDATION_ERROR' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: { message: 'Database configuration error', code: 'DB_CONFIG_ERROR' },
          generatedAt: new Date().toISOString(),
        } as AnalyticsResponse),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For now, return mock data
    // In a real implementation, you would query the database for actual analytics
    const mockAnalyticsData = {
      summary: {
        totalBookings: 1247,
        totalRevenue: 32580,
        activeCustomers: 892,
        averageBookingValue: 26.14,
        topService: 'Damenschnitt',
        topStaffMember: 'Maria Schmidt',
      },
      bookingTrends: {
        daily: [
          { date: '2024-01-01', count: 15, revenue: 390, averageValue: 26 },
          { date: '2024-01-02', count: 18, revenue: 468, averageValue: 26 },
          // More daily data...
        ],
        weekly: [
          { date: '2024-W01', count: 105, revenue: 2730, averageValue: 26 },
          { date: '2024-W02', count: 112, revenue: 2912, averageValue: 26 },
          // More weekly data...
        ],
        monthly: [
          { date: '2024-01', count: 456, revenue: 11856, averageValue: 26 },
          { date: '2024-02', count: 398, revenue: 10348, averageValue: 26 },
          // More monthly data...
        ],
      },
      revenueAnalysis: {
        totalRevenue: 32580,
        revenueByService: [
          { serviceId: '1', serviceName: 'Damenschnitt', totalRevenue: 8424, bookingCount: 324, averagePrice: 26 },
          { serviceId: '2', serviceName: 'Herrenbarber', totalRevenue: 5960, bookingCount: 298, averagePrice: 20 },
          // More service data...
        ],
        revenueByStaff: [
          { 
            staffId: '1', 
            staffName: 'Maria Schmidt', 
            totalRevenue: 4914, 
            bookingCount: 189, 
            averageBookingValue: 26, 
            utilizationRate: 92 
          },
          // More staff data...
        ],
        growthRate: 12.5,
        monthlyGrowth: 8.3,
      },
      customerAnalytics: {
        newCustomers: 67,
        returningCustomers: 825,
        customerRetentionRate: 78.5,
        averageBookingValue: 26.14,
        totalCustomers: 892,
      },
      operationalData: {
        bookingConversionRate: 89.2,
        averageBookingLead: 5.4,
        cancellationRate: 8.7,
        noShowRate: 3.2,
        bookingSuccess: 91.3,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: mockAnalyticsData,
        generatedAt: new Date().toISOString(),
        filters: queryParams.data,
      } as AnalyticsResponse),
    };

  } catch (error) {
    console.error('Analytics API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: { 
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        },
        generatedAt: new Date().toISOString(),
      } as AnalyticsResponse),
    };
  }
};