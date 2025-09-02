import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon, Download, TrendingUp, TrendingDown, Users, Euro, Clock, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MetricsCards } from './MetricsCards'
import { ChartsSection } from './ChartsSection'
import { FiltersPanel } from './FiltersPanel'
import { ExportButton } from './ExportButton'
import { useToast } from '@/hooks/use-toast'

interface AnalyticsData {
  period: {
    startDate: string
    endDate: string
    period: string
  }
  overview: {
    totalAppointments: number
    completedAppointments: number
    cancelledAppointments: number
    totalRevenue: number
    averageTicket: number
    uniqueCustomers: number
    averageDuration: number
    appointmentsGrowth: string
    revenueGrowth: string
    customersGrowth: string
  }
  staffPerformance: Array<{
    staff_id: string
    staff_name: string
    total_appointments: number
    completed_appointments: number
    total_revenue: number
    average_ticket: number
    utilization_rate: number
  }>
  servicePopularity: Array<{
    service_id: string
    service_name: string
    service_category: string
    total_bookings: number
    completed_bookings: number
    total_revenue: number
    average_price: number
    bookings_last_30_days: number
  }>
  chartData: Array<{
    date: string
    appointments: number
    revenue: number
    completed: number
    cancelled: number
  }>
  revenueData: Array<{
    date: string
    daily_revenue: number
    total_appointments: number
    unique_customers: number
  }>
}

interface Staff {
  id: string
  full_name: string
}

interface Service {
  id: string
  name: string
  category: string
}

export function AnalyticsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  
  // Filter states
  const [dateRange, setDateRange] = useState<{
    from: Date
    to: Date
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  })
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')

  // Load initial data
  useEffect(() => {
    loadAnalyticsData()
    loadStaff()
    loadServices()
  }, [])

  // Reload data when filters change
  useEffect(() => {
    loadAnalyticsData()
  }, [dateRange, selectedStaff, selectedService, period])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        period
      })

      if (selectedStaff) {
        params.append('staffId', selectedStaff)
      }
      if (selectedService) {
        params.append('serviceId', selectedService)
      }

      const response = await fetch(`/netlify/functions/admin/analytics/metrics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load analytics data')
      }

      const data = await response.json()
      setAnalyticsData(data.data)

    } catch (error) {
      console.error('Error loading analytics:', error)
      toast({
        title: 'Fehler',
        description: 'Analytics-Daten konnten nicht geladen werden.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStaff = async () => {
    try {
      const response = await fetch('/netlify/functions/admin/staff', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStaff(data.data || [])
      }
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  const loadServices = async () => {
    try {
      const response = await fetch('/netlify/functions/services', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setServices(data.data || [])
      }
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics & Reporting</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics & Reporting</h2>
          <p className="text-muted-foreground">
            Auswertungen und KPIs für {format(dateRange.from, 'dd.MM.yyyy', { locale: de })} - {format(dateRange.to, 'dd.MM.yyyy', { locale: de })}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            dateRange={dateRange}
            selectedStaff={selectedStaff}
            selectedService={selectedService}
          />
        </div>
      </div>

      {/* Filters */}
      <FiltersPanel
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedStaff={selectedStaff}
        onStaffChange={setSelectedStaff}
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        period={period}
        onPeriodChange={setPeriod}
        staff={staff}
        services={services}
      />

      {/* Metrics Cards */}
      {analyticsData && (
        <MetricsCards 
          data={analyticsData.overview}
          loading={loading}
        />
      )}

      {/* Charts and detailed analysis */}
      {analyticsData && (
        <ChartsSection
          chartData={analyticsData.chartData}
          staffPerformance={analyticsData.staffPerformance}
          servicePopularity={analyticsData.servicePopularity}
          revenueData={analyticsData.revenueData}
        />
      )}
    </div>
  )
}