/**
 * Staff Utilization Chart Component
 * Displays staff performance and utilization metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, Clock, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface StaffUtilization {
  staffId: string
  name: string
  utilization: number
  totalAppointments: number
  totalRevenue: number
}

interface StaffUtilizationChartProps {
  data: StaffUtilization[]
  isLoading?: boolean
}

export function StaffUtilizationChart({ data, isLoading }: StaffUtilizationChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  // Sort data by utilization for better visualization
  const sortedData = [...data].sort((a, b) => b.utilization - a.utilization)

  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658']

  // Calculate totals
  const totalAppointments = data.reduce((sum, staff) => sum + staff.totalAppointments, 0)
  const totalRevenue = data.reduce((sum, staff) => sum + staff.totalRevenue, 0)
  const averageUtilization = data.length > 0 
    ? data.reduce((sum, staff) => sum + staff.utilization, 0) / data.length 
    : 0

  // Get utilization status
  const getUtilizationStatus = (utilization: number) => {
    if (utilization >= 80) return { label: 'Excellent', color: 'bg-green-500' }
    if (utilization >= 60) return { label: 'Good', color: 'bg-blue-500' }
    if (utilization >= 40) return { label: 'Fair', color: 'bg-yellow-500' }
    return { label: 'Low', color: 'bg-red-500' }
  }

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Mitarbeiter Auslastung
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Durchschnittliche Auslastung</div>
            <div className="font-semibold text-lg">{formatPercentage(averageUtilization)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Termine Gesamt</div>
            <div className="font-semibold text-lg">{totalAppointments}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Umsatz Gesamt</div>
            <div className="font-semibold text-lg">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Utilization Bar Chart */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Auslastung nach Mitarbeiter</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      fontSize={12}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={80}
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatPercentage(value), 'Auslastung']}
                    />
                    <Bar 
                      dataKey="utilization" 
                      fill="#8884d8"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Distribution */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Umsatzverteilung</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name.split(' ')[0]}: ${formatCurrency(entry.totalRevenue)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalRevenue"
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Umsatz']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Staff Table */}
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Detaillierte Übersicht
              </h4>
              <div className="space-y-3">
                {sortedData.map((staff, index) => {
                  const status = getUtilizationStatus(staff.utilization)
                  
                  return (
                    <div key={staff.staffId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="w-8 h-8 p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {staff.totalAppointments} Termine
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(staff.totalRevenue)}</div>
                          <div className="text-sm text-muted-foreground">Umsatz</div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.color}`} />
                            <span className="font-semibold">{formatPercentage(staff.utilization)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">Auslastung</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {data.filter(s => s.utilization >= 80).length}
                </div>
                <div className="text-sm text-muted-foreground">Hoch ausgelastet (≥80%)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {data.filter(s => s.utilization >= 40 && s.utilization < 80).length}
                </div>
                <div className="text-sm text-muted-foreground">Moderat ausgelastet (40-79%)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {data.filter(s => s.utilization < 40).length}
                </div>
                <div className="text-sm text-muted-foreground">Niedrig ausgelastet (&lt;40%)</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Mitarbeiterdaten verfügbar</p>
              <p className="text-sm">Für den ausgewählten Zeitraum</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}