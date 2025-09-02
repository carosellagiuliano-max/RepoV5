import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Users, Euro, Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricsData {
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

interface MetricsCardsProps {
  data: MetricsData
  loading: boolean
}

function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  growth, 
  loading 
}: { 
  title: string
  value: string | number
  description: string
  icon: any
  growth?: string
  loading: boolean
}) {
  const growthNum = parseFloat(growth || '0')
  const isPositive = growthNum > 0
  const isNegative = growthNum < 0

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center text-xs text-muted-foreground">
          <span>{description}</span>
          {growth && (
            <div className={cn(
              "ml-2 flex items-center",
              isPositive && "text-green-600",
              isNegative && "text-red-600"
            )}>
              {isPositive && <TrendingUp className="h-3 w-3 mr-1" />}
              {isNegative && <TrendingDown className="h-3 w-3 mr-1" />}
              <span>{Math.abs(growthNum)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricsCards({ data, loading }: MetricsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const completionRate = data.totalAppointments > 0 
    ? ((data.completedAppointments / data.totalAppointments) * 100).toFixed(1)
    : '0'

  const metrics = [
    {
      title: 'Termine Gesamt',
      value: data.totalAppointments.toLocaleString('de-DE'),
      description: `${completionRate}% abgeschlossen`,
      icon: Calendar,
      growth: data.appointmentsGrowth
    },
    {
      title: 'Umsatz',
      value: formatCurrency(data.totalRevenue),
      description: `Ø ${formatCurrency(data.averageTicket)} pro Termin`,
      icon: Euro,
      growth: data.revenueGrowth
    },
    {
      title: 'Kunden',
      value: data.uniqueCustomers.toLocaleString('de-DE'),
      description: 'Unique Kunden',
      icon: Users,
      growth: data.customersGrowth
    },
    {
      title: 'Ø Dauer',
      value: formatDuration(data.averageDuration),
      description: 'Durchschnittliche Termindauer',
      icon: Clock
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          growth={metric.growth}
          loading={loading}
        />
      ))}
    </div>
  )
}