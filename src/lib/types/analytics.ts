/**
 * Analytics Types
 * Extended types for the enhanced analytics system
 */

// Core analytics interfaces
export interface AnalyticsFilters {
  startDate: string
  endDate: string
  staffId: string
  serviceId: string
  period: 'day' | 'week' | 'month'
  comparisonPeriod?: 'previous_period' | 'previous_year' | 'none'
}

export interface StaffUtilization {
  staffId: string
  name: string
  utilization: number
  totalAppointments: number
  totalRevenue: number
  completedAppointments?: number
  cancelledAppointments?: number
  averageServiceTime?: number
}

export interface PopularService {
  serviceId: string
  name: string
  category?: string
  bookingCount: number
  revenue: number
  averagePrice?: number
  growthRate?: number
}

export interface DailyStat {
  date: string
  appointments: number
  revenue: number
  newCustomers: number
  averageServiceTime?: number
  completionRate?: number
}

export interface ComparisonData {
  current: number
  previous: number
  change: number
  changePercentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface KPIData {
  totalAppointments: number
  totalRevenue: number
  averageServiceTime: number
  bookingRate: number
  cancellationRate: number
  staffUtilization: StaffUtilization[]
  popularServices: PopularService[]
  dailyStats: DailyStat[]
  period: 'day' | 'week' | 'month'
  dateRange: {
    startDate: string
    endDate: string
  }
  // Enhanced features
  comparison?: {
    totalAppointments: ComparisonData
    totalRevenue: ComparisonData
    bookingRate: ComparisonData
    cancellationRate: ComparisonData
  }
  heatmapData?: HeatmapData[]
  realTimeUpdate?: boolean
}

// Heatmap data for peak times analysis
export interface HeatmapData {
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  hour: number // 0-23
  appointments: number
  density: number // 0-1 normalized density
  revenue?: number
}

// Drilldown data structures
export interface DrilldownAppointment {
  id: string
  date: string
  time: string
  customerName: string
  customerEmail?: string
  staffName: string
  serviceName: string
  duration: number
  price: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string
}

export interface DrilldownFilters {
  metric: 'appointments' | 'revenue' | 'staff' | 'service'
  value?: string // staff ID, service ID, etc.
  startDate: string
  endDate: string
  status?: string[]
}

// Scheduled reports
export interface ScheduledReport {
  id: string
  name: string
  description?: string
  frequency: 'weekly' | 'monthly'
  format: 'csv' | 'pdf'
  recipients: string[]
  filters: Partial<AnalyticsFilters>
  isActive: boolean
  nextRun: string
  lastRun?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ReportDelivery {
  id: string
  reportId: string
  status: 'pending' | 'generating' | 'sent' | 'failed'
  generatedAt?: string
  sentAt?: string
  fileUrl?: string
  error?: string
}

// Real-time update types
export interface RealtimeEvent {
  type: 'appointment_created' | 'appointment_updated' | 'appointment_cancelled'
  data: Record<string, unknown>
  timestamp: string
}

export interface RealtimeConfig {
  enabled: boolean
  fallbackPollingInterval: number // ms
  maxReconnectAttempts: number
}

// Role-based access
export interface AnalyticsPermissions {
  canViewAllStaff: boolean
  canViewRevenue: boolean
  canExportData: boolean
  canManageReports: boolean
  ownStaffId?: string
}

// Export formats
export interface ExportOptions {
  type: 'appointments' | 'staff-utilization' | 'services-revenue' | 'heatmap'
  format: 'csv' | 'pdf'
  filters: AnalyticsFilters
  includeComparison?: boolean
}

// API response types
export interface AnalyticsResponse {
  success: boolean
  data?: KPIData
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface DrilldownResponse {
  success: boolean
  data?: {
    appointments: DrilldownAppointment[]
    total: number
    summary: {
      totalRevenue: number
      averageDuration: number
      completionRate: number
    }
  }
  error?: {
    code: string
    message: string
  }
}

export interface HeatmapResponse {
  success: boolean
  data?: HeatmapData[]
  error?: {
    code: string
    message: string
  }
}