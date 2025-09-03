/**
 * Top Services Chart Component
 * Displays popular services and their revenue performance
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Star, Award } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface PopularService {
  serviceId: string
  name: string
  bookingCount: number
  revenue: number
}

interface TopServicesChartProps {
  data: PopularService[]
  isLoading?: boolean
  detailed?: boolean
  onServiceClick?: (serviceId: string, serviceName: string) => void
}

export function TopServicesChart({ data, isLoading, detailed = false, onServiceClick }: TopServicesChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount)
  }

  // Colors for the charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B', '#4ECDC4', '#45B7D1']

  // Calculate totals and averages
  const totalBookings = data.reduce((sum, service) => sum + service.bookingCount, 0)
  const totalRevenue = data.reduce((sum, service) => sum + service.revenue, 0)
  const averageRevenue = data.length > 0 ? totalRevenue / data.length : 0

  // Top services by bookings and revenue
  const topByBookings = [...data].sort((a, b) => b.bookingCount - a.bookingCount).slice(0, 10)
  const topByRevenue = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Calculate average price per service
  const dataWithAvgPrice = data.map(service => ({
    ...service,
    averagePrice: service.bookingCount > 0 ? service.revenue / service.bookingCount : 0
  }))

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
          <TrendingUp className="w-5 h-5" />
          Service Performance
          {!detailed && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Top {Math.min(5, data.length)})
            </span>
          )}
        </CardTitle>
        {detailed && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Services Gesamt</div>
              <div className="font-semibold">{data.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Buchungen Gesamt</div>
              <div className="font-semibold">{totalBookings}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Umsatz Gesamt</div>
              <div className="font-semibold">{formatCurrency(totalRevenue)}</div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-6">
            {detailed ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bookings Chart */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Top Services (Buchungen)
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topByBookings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={11}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => [value, 'Buchungen']}
                      />
                      <Bar 
                        dataKey="bookingCount" 
                        fill="#8884d8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue Chart */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Top Services (Umsatz)
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topByRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={11}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Umsatz']}
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="#82ca9d"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              // Simple view for overview tab
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.bookingCount}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="bookingCount"
                  >
                    {data.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'bookingCount' ? 'Buchungen' : name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            {detailed && (
              <div>
                <h4 className="text-lg font-semibold mb-4">Detaillierte Service-Übersicht</h4>
                <div className="space-y-3">
                  {topByRevenue.slice(0, 10).map((service, index) => {
                    const averagePrice = service.bookingCount > 0 ? service.revenue / service.bookingCount : 0
                    const revenuePercentage = totalRevenue > 0 ? (service.revenue / totalRevenue) * 100 : 0
                    
                    return (
                      <div key={service.serviceId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="w-8 h-8 p-0 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">{service.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {service.bookingCount} Buchungen
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(service.revenue)}</div>
                            <div className="text-sm text-muted-foreground">
                              {revenuePercentage.toFixed(1)}% vom Gesamtumsatz
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(averagePrice)}</div>
                            <div className="text-sm text-muted-foreground">⌀ Preis</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!detailed && data.length > 5 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Zeige Top 5 von {data.length} Services
                </p>
              </div>
            )}

            {detailed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Services Aktiv</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(averageRevenue)}
                  </div>
                  <div className="text-sm text-muted-foreground">⌀ Umsatz pro Service</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {data.length > 0 ? Math.round(totalBookings / data.length) : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">⌀ Buchungen pro Service</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {data.length > 0 ? formatCurrency(totalRevenue / totalBookings) : formatCurrency(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">⌀ Buchungswert</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Service-Daten verfügbar</p>
              <p className="text-sm">Für den ausgewählten Zeitraum</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}