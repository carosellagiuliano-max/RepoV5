/**
 * KPI Cards Component
 * Displays key performance indicators in card format
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface KPIData {
  totalAppointments: number
  totalRevenue: number
  averageServiceTime: number
  bookingRate: number
  cancellationRate: number
  staffUtilization: Array<{
    staffId: string
    name: string
    utilization: number
    totalAppointments: number
    totalRevenue: number
  }>
  popularServices: Array<{
    serviceId: string
    name: string
    bookingCount: number
    revenue: number
  }>
  dailyStats: Array<{
    date: string
    appointments: number
    revenue: number
    newCustomers: number
  }>
  period: 'day' | 'week' | 'month'
  dateRange: {
    startDate: string
    endDate: string
  }
}

interface KPICardsProps {
  data: KPIData
  isLoading?: boolean
  onCardClick?: (metric: 'appointments' | 'revenue' | 'staff' | 'service', title: string, value?: string) => void
}

export function KPICards({ data, isLoading, onCardClick }: KPICardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getTrendIcon = (value: number, isGood: boolean = true) => {
    if (value > 0) {
      return isGood ? (
        <TrendingUp className="w-4 h-4 text-green-600" />
      ) : (
        <TrendingUp className="w-4 h-4 text-red-600" />
      )
    } else if (value < 0) {
      return isGood ? (
        <TrendingDown className="w-4 h-4 text-red-600" />
      ) : (
        <TrendingDown className="w-4 h-4 text-green-600" />
      )
    }
    return null
  }

  const getStatusColor = (rate: number, threshold: number = 80) => {
    if (rate >= threshold) return 'text-green-600'
    if (rate >= threshold * 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const averageUtilization = data.staffUtilization.length > 0
    ? data.staffUtilization.reduce((sum, staff) => sum + staff.utilization, 0) / data.staffUtilization.length
    : 0

  const topStaff = data.staffUtilization
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 3)

  const averageDailyRevenue = data.dailyStats.length > 0
    ? data.dailyStats.reduce((sum, day) => sum + day.revenue, 0) / data.dailyStats.length
    : 0

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Appointments */}
      <Card 
        className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onCardClick?.('appointments', 'Alle Termine')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Termine Gesamt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalAppointments}</div>
          <p className="text-xs text-muted-foreground">
            {data.period === 'day' ? 'Heute' : 
             data.period === 'week' ? 'Diese Woche' : 
             'Dieser Monat'}
          </p>
        </CardContent>
      </Card>

      {/* Total Revenue */}
      <Card 
        className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onCardClick?.('revenue', 'Umsatz Details')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Gesamtumsatz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">
            ⌀ {formatCurrency(averageDailyRevenue)} pro Tag
          </p>
        </CardContent>
      </Card>

      {/* Average Service Time */}
      <Card 
        className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onCardClick?.('appointments', 'Service-Zeit Details')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            ⌀ Service-Zeit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.averageServiceTime} min</div>
          <p className="text-xs text-muted-foreground">
            Pro abgeschlossenem Termin
          </p>
        </CardContent>
      </Card>

      {/* Booking Rate */}
      <Card 
        className="border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onCardClick?.('appointments', 'Abgeschlossene Termine')}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Erfolgsquote
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatusColor(data.bookingRate)}`}>
            {formatPercentage(data.bookingRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Abgeschlossene Termine
          </p>
        </CardContent>
      </Card>

      {/* Cancellation Rate */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Stornierungsrate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${data.cancellationRate > 20 ? 'text-red-600' : data.cancellationRate > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
            {formatPercentage(data.cancellationRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Stornierte Termine
          </p>
        </CardContent>
      </Card>

      {/* Staff Utilization */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            ⌀ Auslastung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatusColor(averageUtilization)}`}>
            {formatPercentage(averageUtilization)}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.staffUtilization.length} Mitarbeiter
          </p>
        </CardContent>
      </Card>

      {/* Top Performing Staff */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Mitarbeiter (Umsatz)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topStaff.length > 0 ? (
              topStaff.map((staff, index) => (
                <div key={staff.staffId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{staff.name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{formatCurrency(staff.totalRevenue)}</div>
                    <div className="text-muted-foreground text-xs">
                      {staff.totalAppointments} Termine
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Services */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Beliebtester Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.popularServices.length > 0 ? (
            <div>
              <div className="text-lg font-semibold">{data.popularServices[0].name}</div>
              <div className="text-sm text-muted-foreground">
                {data.popularServices[0].bookingCount} Buchungen
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(data.popularServices[0].revenue)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Services verfügbar</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}