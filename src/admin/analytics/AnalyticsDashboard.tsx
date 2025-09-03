/**
 * Analytics Dashboard
 * Main dashboard showing KPIs and reports for the salon business
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp, 
  BarChart3,
  Activity,
  Settings,
  Zap,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

import { AnalyticsFilters } from './AnalyticsFilters'
import { KPICards } from './KPICards'
import { RevenueChart } from './RevenueChart'
import { StaffUtilizationChart } from './StaffUtilizationChart'
import { TopServicesChart } from './TopServicesChart'
import { DrilldownModal } from './DrilldownModal'
import { HeatmapChart } from './HeatmapChart'
import { ComparisonAnalytics } from './ComparisonAnalytics'
import { ScheduledReports } from './ScheduledReports'
import { useAnalytics } from '@/hooks/use-analytics'
import { DrilldownFilters } from '@/lib/types/analytics'

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
    endDate: new Date().toISOString().split('T')[0], // Today
    staffId: '',
    serviceId: '',
    period: 'month' as 'day' | 'week' | 'month',
    comparisonPeriod: 'previous_period' as 'previous_period' | 'previous_year' | 'none'
  })

  const [drilldownModal, setDrilldownModal] = useState<{
    isOpen: boolean
    metric: 'appointments' | 'revenue' | 'staff' | 'service'
    title: string
    filters: DrilldownFilters
  }>({
    isOpen: false,
    metric: 'appointments',
    title: '',
    filters: {
      metric: 'appointments',
      startDate: '',
      endDate: ''
    }
  })

  const { 
    data: analyticsData, 
    isLoading, 
    error, 
    refetch,
    isRealTimeConnected,
    permissions
  } = useAnalytics(filters)

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const handleDrilldownOpen = (
    metric: 'appointments' | 'revenue' | 'staff' | 'service',
    title: string,
    value?: string
  ) => {
    setDrilldownModal({
      isOpen: true,
      metric,
      title,
      filters: {
        metric,
        value,
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    })
  }

  const handleDrilldownClose = () => {
    setDrilldownModal(prev => ({ ...prev, isOpen: false }))
  }

  const handleDrilldownFiltersChange = (newFilters: DrilldownFilters) => {
    setDrilldownModal(prev => ({
      ...prev,
      filters: newFilters
    }))
  }

  const handleHeatmapCellClick = (dayOfWeek: number, hour: number) => {
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
    handleDrilldownOpen(
      'appointments',
      `Termine ${dayNames[dayOfWeek]} ${hour}:00`,
      `${dayOfWeek}-${hour}`
    )
  }

  const handleExport = async (type: 'appointments' | 'staff-utilization' | 'services-revenue') => {
    try {
      const queryParams = new URLSearchParams({
        type,
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.staffId && { staffId: filters.staffId }),
        ...(filters.serviceId && { serviceId: filters.serviceId })
      })

      const response = await fetch(`/.netlify/functions/admin/analytics/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}` // Simplified auth for demo
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `export_${type}_${Date.now()}.csv`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Export erfolgreich heruntergeladen')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export fehlgeschlagen')
    }
  }

  useEffect(() => {
    refetch()
  }, [filters, refetch])

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>Fehler beim Laden der Analytics-Daten</p>
              <Button onClick={() => refetch()} className="mt-2">
                Erneut versuchen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Analytics & Reporting</h1>
            {isRealTimeConnected && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Live
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Übersicht über Geschäftskennzahlen und Leistungsindikatoren
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4 lg:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('appointments')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Termine CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('staff-utilization')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Mitarbeiter CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('services-revenue')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Services CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filter & Vergleich
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsFilters
            filters={filters}
            onFiltersChange={handleFilterChange}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Comparison Analytics */}
      {analyticsData?.comparison && (
        <div className="mb-6">
          <ComparisonAnalytics 
            data={analyticsData.comparison}
            period={filters.period}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* KPI Cards */}
      {analyticsData && (
        <div className="mb-6">
          <KPICards 
            data={analyticsData} 
            isLoading={isLoading}
            onCardClick={handleDrilldownOpen}
          />
        </div>
      )}

      {/* Charts and Details */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Umsatz
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Mitarbeiter
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Spitzenzeiten
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Berichte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsData && (
              <>
                <RevenueChart 
                  data={analyticsData.dailyStats} 
                  isLoading={isLoading}
                  onDataPointClick={(date) => handleDrilldownOpen('revenue', `Umsatz ${date}`, date)}
                />
                <TopServicesChart 
                  data={analyticsData.popularServices} 
                  isLoading={isLoading}
                  onServiceClick={(serviceId, serviceName) => 
                    handleDrilldownOpen('service', `Service: ${serviceName}`, serviceId)
                  }
                />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="revenue">
          {analyticsData && (
            <RevenueChart 
              data={analyticsData.dailyStats} 
              isLoading={isLoading} 
              detailed 
              onDataPointClick={(date) => handleDrilldownOpen('revenue', `Umsatz ${date}`, date)}
            />
          )}
        </TabsContent>

        <TabsContent value="staff">
          {analyticsData && (
            <StaffUtilizationChart 
              data={analyticsData.staffUtilization} 
              isLoading={isLoading}
              onStaffClick={(staffId, staffName) => 
                handleDrilldownOpen('staff', `Mitarbeiter: ${staffName}`, staffId)
              }
            />
          )}
        </TabsContent>

        <TabsContent value="services">
          {analyticsData && (
            <TopServicesChart 
              data={analyticsData.popularServices} 
              isLoading={isLoading} 
              detailed
              onServiceClick={(serviceId, serviceName) => 
                handleDrilldownOpen('service', `Service: ${serviceName}`, serviceId)
              }
            />
          )}
        </TabsContent>

        <TabsContent value="heatmap">
          {analyticsData && (
            <HeatmapChart
              data={analyticsData.heatmapData || []}
              isLoading={isLoading}
              onCellClick={handleHeatmapCellClick}
            />
          )}
        </TabsContent>

        <TabsContent value="reports">
          {permissions && (
            <ScheduledReports permissions={permissions} />
          )}
        </TabsContent>
      </Tabs>

      {/* Drilldown Modal */}
      <DrilldownModal
        isOpen={drilldownModal.isOpen}
        onClose={handleDrilldownClose}
        metric={drilldownModal.metric}
        title={drilldownModal.title}
        filters={drilldownModal.filters}
        onFiltersChange={handleDrilldownFiltersChange}
      />
    </div>
  )
}