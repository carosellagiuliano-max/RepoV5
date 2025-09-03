/**
 * Comparison Analytics Component
 * Shows period-over-period comparison with trend indicators
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  Euro,
  Clock,
  Users
} from 'lucide-react'
import { ComparisonData } from '@/lib/types/analytics'

interface ComparisonCardProps {
  title: string
  icon: React.ReactNode
  current: number
  comparison: ComparisonData
  formatter?: (value: number) => string
  isLoading?: boolean
}

function ComparisonCard({ 
  title, 
  icon, 
  current, 
  comparison, 
  formatter = (val) => val.toString(),
  isLoading = false 
}: ComparisonCardProps) {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />
      case 'down':
        return <TrendingDown className="w-4 h-4" />
      case 'stable':
        return <Minus className="w-4 h-4" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50'
      case 'down':
        return 'text-red-600 bg-red-50'
      case 'stable':
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatPercentage = (percentage: number) => {
    const sign = percentage > 0 ? '+' : ''
    return `${sign}${percentage.toFixed(1)}%`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <div className="flex items-center gap-2">
              {icon}
              {title}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            {icon}
            {title}
          </div>
        </CardTitle>
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1 ${getTrendColor(comparison.trend)}`}
        >
          {getTrendIcon(comparison.trend)}
          {formatPercentage(comparison.changePercentage)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-2xl font-bold">
            {formatter(current)}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aktuell:</span>
              <span className="font-medium">{formatter(comparison.current)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Vorperiode:</span>
              <span className="font-medium">{formatter(comparison.previous)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Änderung:</span>
              <span className={`font-medium ${
                comparison.change > 0 ? 'text-green-600' : 
                comparison.change < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {comparison.change > 0 ? '+' : ''}{formatter(comparison.change)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ComparisonAnalyticsProps {
  data: {
    totalAppointments: ComparisonData
    totalRevenue: ComparisonData
    bookingRate: ComparisonData
    cancellationRate: ComparisonData
  }
  period: 'day' | 'week' | 'month'
  isLoading?: boolean
}

export function ComparisonAnalytics({ data, period, isLoading = false }: ComparisonAnalyticsProps) {
  const formatCurrency = (value: number) => 
    `CHF ${value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
  
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`
  
  const formatNumber = (value: number) => value.toString()

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'day':
        return 'vs. Vortag'
      case 'week':
        return 'vs. Vorwoche'
      case 'month':
        return 'vs. Vormonat'
      default:
        return 'vs. Vorperiode'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vergleichsanalyse</h3>
          <p className="text-sm text-muted-foreground">
            Leistung im Vergleich zur Vorperiode {getPeriodLabel(period)}
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {getPeriodLabel(period)}
        </Badge>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComparisonCard
          title="Termine Gesamt"
          icon={<Calendar className="w-4 h-4" />}
          current={data.totalAppointments.current}
          comparison={data.totalAppointments}
          formatter={formatNumber}
          isLoading={isLoading}
        />
        
        <ComparisonCard
          title="Gesamtumsatz"
          icon={<Euro className="w-4 h-4" />}
          current={data.totalRevenue.current}
          comparison={data.totalRevenue}
          formatter={formatCurrency}
          isLoading={isLoading}
        />
        
        <ComparisonCard
          title="Buchungsrate"
          icon={<TrendingUp className="w-4 h-4" />}
          current={data.bookingRate.current}
          comparison={data.bookingRate}
          formatter={formatPercentage}
          isLoading={isLoading}
        />
        
        <ComparisonCard
          title="Stornierungsrate"
          icon={<TrendingDown className="w-4 h-4" />}
          current={data.cancellationRate.current}
          comparison={data.cancellationRate}
          formatter={formatPercentage}
          isLoading={isLoading}
        />
      </div>

      {/* Summary Insights */}
      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wichtige Erkenntnisse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Appointments insight */}
              {data.totalAppointments.trend === 'up' && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span>
                    Termineanzahl ist um {data.totalAppointments.changePercentage.toFixed(1)}% gestiegen
                  </span>
                </div>
              )}
              
              {data.totalAppointments.trend === 'down' && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span>
                    Termineanzahl ist um {Math.abs(data.totalAppointments.changePercentage).toFixed(1)}% gefallen
                  </span>
                </div>
              )}

              {/* Revenue insight */}
              {data.totalRevenue.trend === 'up' && (
                <div className="flex items-center gap-2 text-sm">
                  <Euro className="w-4 h-4 text-green-600" />
                  <span>
                    Umsatz ist um {formatCurrency(data.totalRevenue.change)} gestiegen
                  </span>
                </div>
              )}
              
              {data.totalRevenue.trend === 'down' && (
                <div className="flex items-center gap-2 text-sm">
                  <Euro className="w-4 h-4 text-red-600" />
                  <span>
                    Umsatz ist um {formatCurrency(Math.abs(data.totalRevenue.change))} gefallen
                  </span>
                </div>
              )}

              {/* Booking rate insight */}
              {data.bookingRate.trend === 'up' && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-green-600" />
                  <span>
                    Buchungsrate hat sich verbessert
                  </span>
                </div>
              )}
              
              {data.bookingRate.trend === 'down' && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-red-600" />
                  <span>
                    Buchungsrate hat sich verschlechtert
                  </span>
                </div>
              )}

              {/* Performance summary */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-1">Gesamtbewertung:</div>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const positiveMetrics = [
                      data.totalAppointments.trend === 'up',
                      data.totalRevenue.trend === 'up',
                      data.bookingRate.trend === 'up',
                      data.cancellationRate.trend === 'down' // Lower cancellation is better
                    ].filter(Boolean).length

                    if (positiveMetrics >= 3) {
                      return '🟢 Sehr gute Leistung - Die meisten Kennzahlen zeigen positive Trends'
                    } else if (positiveMetrics >= 2) {
                      return '🟡 Solide Leistung - Gemischte Trends bei den Kennzahlen'
                    } else {
                      return '🔴 Verbesserungspotential - Mehrere Kennzahlen zeigen negative Trends'
                    }
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}