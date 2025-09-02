/**
 * Appointment Statistics Dashboard
 * Real-time statistics and metrics for appointment management
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, User, DollarSign, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { AppointmentWithDetails } from '@/lib/types/database'
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns'
import { de } from 'date-fns/locale'

interface AppointmentStatsProps {
  appointments: AppointmentWithDetails[]
}

export function AppointmentStats({ appointments }: AppointmentStatsProps) {
  const stats = useMemo(() => {
    const now = new Date()
    
    // Filter appointments by time periods
    const todayAppointments = appointments.filter(apt => isToday(new Date(apt.start_time)))
    const thisWeekAppointments = appointments.filter(apt => isThisWeek(new Date(apt.start_time), { weekStartsOn: 1 }))
    const thisMonthAppointments = appointments.filter(apt => isThisMonth(new Date(apt.start_time)))
    
    // Status counts
    const statusCounts = {
      total: appointments.length,
      confirmed: appointments.filter(apt => apt.status === 'confirmed').length,
      pending: appointments.filter(apt => apt.status === 'pending').length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      noShow: appointments.filter(apt => apt.status === 'no_show').length
    }
    
    // Today's statistics
    const todayStats = {
      total: todayAppointments.length,
      confirmed: todayAppointments.filter(apt => apt.status === 'confirmed').length,
      pending: todayAppointments.filter(apt => apt.status === 'pending').length,
      completed: todayAppointments.filter(apt => apt.status === 'completed').length,
      revenue: todayAppointments
        .filter(apt => apt.status === 'completed')
        .reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100
    }
    
    // Weekly statistics
    const weekStats = {
      total: thisWeekAppointments.length,
      revenue: thisWeekAppointments
        .filter(apt => apt.status === 'completed')
        .reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100,
      averagePerDay: Math.round((thisWeekAppointments.length / 7) * 10) / 10
    }
    
    // Monthly statistics
    const monthStats = {
      total: thisMonthAppointments.length,
      revenue: thisMonthAppointments
        .filter(apt => apt.status === 'completed')
        .reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100,
      averagePerDay: Math.round((thisMonthAppointments.length / new Date().getDate()) * 10) / 10
    }
    
    // Calculate total duration for today
    const todayDuration = todayAppointments.reduce((total, apt) => {
      const start = new Date(apt.start_time)
      const end = new Date(apt.end_time)
      return total + (end.getTime() - start.getTime())
    }, 0)
    
    const todayHours = Math.floor(todayDuration / (1000 * 60 * 60))
    const todayMinutes = Math.floor((todayDuration % (1000 * 60 * 60)) / (1000 * 60))
    
    // Service popularity
    const serviceStats = appointments.reduce((acc, apt) => {
      const serviceName = apt.service_name || 'Unbekannt'
      acc[serviceName] = (acc[serviceName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topServices = Object.entries(serviceStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    
    // Staff performance
    const staffStats = appointments.reduce((acc, apt) => {
      const staffName = apt.staff_name || 'Unbekannt'
      if (!acc[staffName]) {
        acc[staffName] = { appointments: 0, revenue: 0 }
      }
      acc[staffName].appointments += 1
      if (apt.status === 'completed') {
        acc[staffName].revenue += (apt.service_price_cents || 0) / 100
      }
      return acc
    }, {} as Record<string, { appointments: number; revenue: number }>)
    
    const topStaff = Object.entries(staffStats)
      .sort(([, a], [, b]) => b.appointments - a.appointments)
      .slice(0, 3)
    
    return {
      statusCounts,
      todayStats,
      weekStats,
      monthStats,
      todayDuration: { hours: todayHours, minutes: todayMinutes },
      topServices,
      topStaff
    }
  }, [appointments])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'no_show':
        return <AlertCircle className="w-4 h-4 text-gray-600" />
      default:
        return <Calendar className="w-4 h-4 text-gray-600" />
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Today's Overview */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Heute
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{stats.todayStats.total}</span>
            <span className="text-sm text-muted-foreground">Termine</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{stats.todayDuration.hours}h {stats.todayDuration.minutes}m</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">{formatCurrency(stats.todayStats.revenue)}</span>
          </div>
          
          <div className="flex flex-wrap gap-1 pt-2">
            <Badge variant="secondary" className="text-xs">
              {stats.todayStats.confirmed} bestätigt
            </Badge>
            <Badge variant="outline" className="text-xs">
              {stats.todayStats.pending} ausstehend
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Diese Woche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold">{stats.weekStats.total}</span>
            <span className="text-sm text-muted-foreground">Termine</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span>⌀ {stats.weekStats.averagePerDay} pro Tag</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">{formatCurrency(stats.weekStats.revenue)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Overview */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Dieser Monat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold">{stats.monthStats.total}</span>
            <span className="text-sm text-muted-foreground">Termine</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span>⌀ {stats.monthStats.averagePerDay} pro Tag</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">{formatCurrency(stats.monthStats.revenue)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Status Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            {[
              { key: 'confirmed', label: 'Bestätigt', count: stats.statusCounts.confirmed },
              { key: 'pending', label: 'Ausstehend', count: stats.statusCounts.pending },
              { key: 'completed', label: 'Abgeschlossen', count: stats.statusCounts.completed },
              { key: 'cancelled', label: 'Storniert', count: stats.statusCounts.cancelled }
            ].map(({ key, label, count }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {getStatusIcon(key)}
                  <span>{label}</span>
                </div>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Services */}
      {stats.topServices.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Beliebteste Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topServices.map(([service, count], index) => (
                <div key={service} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{service}</span>
                  </div>
                  <span className="text-sm font-medium">{count} Termine</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Staff */}
      {stats.topStaff.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mitarbeiter Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topStaff.map(([staff, data], index) => (
                <div key={staff} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{staff}</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{data.appointments} Termine</div>
                    <div className="text-muted-foreground">
                      {formatCurrency(data.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}