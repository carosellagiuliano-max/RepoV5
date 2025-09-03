// Analytics type definitions for the admin dashboard
export interface BookingMetric {
  date: string;
  count: number;
  revenue: number;
  averageValue: number;
}

export interface ServiceRevenue {
  serviceId: string;
  serviceName: string;
  totalRevenue: number;
  bookingCount: number;
  averagePrice: number;
}

export interface StaffRevenue {
  staffId: string;
  staffName: string;
  totalRevenue: number;
  bookingCount: number;
  averageBookingValue: number;
  utilizationRate: number;
}

export interface CustomerMetrics {
  newCustomers: number;
  returningCustomers: number;
  customerRetentionRate: number;
  averageBookingValue: number;
  totalCustomers: number;
}

export interface OperationalMetrics {
  bookingConversionRate: number;
  averageBookingLead: number; // days in advance
  cancellationRate: number;
  noShowRate: number;
  bookingSuccess: number;
}

export interface PeakTimeAnalysis {
  hour: number;
  dayOfWeek: number;
  bookingCount: number;
  utilization: number;
}

export interface AnalyticsDashboardData {
  // Time-based booking trends
  bookingTrends: {
    daily: BookingMetric[];
    weekly: BookingMetric[];
    monthly: BookingMetric[];
  };
  
  // Revenue breakdown
  revenueAnalysis: {
    totalRevenue: number;
    revenueByService: ServiceRevenue[];
    revenueByStaff: StaffRevenue[];
    growthRate: number;
    monthlyGrowth: number;
  };
  
  // Customer insights
  customerAnalytics: CustomerMetrics;
  
  // Operational efficiency
  operationalData: OperationalMetrics;
  
  // Peak time analysis
  peakTimes: PeakTimeAnalysis[];
  
  // Summary stats for quick overview
  summary: {
    totalBookings: number;
    totalRevenue: number;
    activeCustomers: number;
    averageBookingValue: number;
    topService: string;
    topStaffMember: string;
  };
}

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  staffIds?: string[];
  serviceIds?: string[];
  includeNoShows?: boolean;
  includeCancelled?: boolean;
}

export interface AnalyticsApiResponse {
  success: boolean;
  data: AnalyticsDashboardData;
  generatedAt: string;
  filters: AnalyticsFilters;
}