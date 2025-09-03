/**
 * Revenue Chart Component
 * Displays revenue trends over time
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { DollarSign, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

interface DailyStat {
  date: string
  appointments: number
  revenue: number
  newCustomers: number
}

interface RevenueChartProps {
  data: DailyStat[]
  isLoading?: boolean
  detailed?: boolean
  onDataPointClick?: (date: string) => void
}

export function RevenueChart({ data, isLoading, detailed = false, onDataPointClick }: RevenueChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd.MM', { locale: de })
  }

  const formatTooltipDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de })
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const averageRevenue = data.length > 0 ? totalRevenue / data.length : 0
  const maxRevenue = Math.max(...data.map(item => item.revenue))
  const minRevenue = Math.min(...data.map(item => item.revenue))

  if (isLoading) {
    return (
      <Card className={detailed ? 'col-span-full' : ''}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={detailed ? 'col-span-full' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Umsatzentwicklung
          {!detailed && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({data.length} Tage)
            </span>
          )}
        </CardTitle>
        {detailed && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Gesamt</div>
              <div className="font-semibold">{formatCurrency(totalRevenue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Durchschnitt</div>
              <div className="font-semibold">{formatCurrency(averageRevenue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Maximum</div>
              <div className="font-semibold text-green-600">{formatCurrency(maxRevenue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Minimum</div>
              <div className="font-semibold text-red-600">{formatCurrency(minRevenue)}</div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={detailed ? 400 : 300}>
              <LineChart 
                data={data}
                onClick={(data) => {
                  if (data && data.activeLabel && onDataPointClick) {
                    onDataPointClick(data.activeLabel as string)
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                  fontSize={12}
                />
                <Tooltip
                  labelFormatter={(label) => formatTooltipDate(label)}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'revenue' ? 'Umsatz' : name
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {detailed && (
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Termine pro Tag
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      labelFormatter={(label) => formatTooltipDate(label)}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'appointments' ? 'Termine' : 
                        name === 'newCustomers' ? 'Neue Kunden' : name
                      ]}
                    />
                    <Bar 
                      dataKey="appointments" 
                      fill="#8884d8" 
                      name="appointments"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="newCustomers" 
                      fill="#82ca9d" 
                      name="newCustomers"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Umsatzdaten verfügbar</p>
              <p className="text-sm">Für den ausgewählten Zeitraum</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}