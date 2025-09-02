import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface ChartDataPoint {
  date: string
  appointments: number
  revenue: number
  completed: number
  cancelled: number
}

interface StaffPerformance {
  staff_id: string
  staff_name: string
  total_appointments: number
  completed_appointments: number
  total_revenue: number
  average_ticket: number
  utilization_rate: number
}

interface ServicePopularity {
  service_id: string
  service_name: string
  service_category: string
  total_bookings: number
  completed_bookings: number
  total_revenue: number
  average_price: number
  bookings_last_30_days: number
}

interface RevenueData {
  date: string
  daily_revenue: number
  total_appointments: number
  unique_customers: number
}

interface ChartsSectionProps {
  chartData: ChartDataPoint[]
  staffPerformance: StaffPerformance[]
  servicePopularity: ServicePopularity[]
  revenueData: RevenueData[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export function ChartsSection({ 
  chartData, 
  staffPerformance, 
  servicePopularity, 
  revenueData 
}: ChartsSectionProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd.MM', { locale: de })
  }

  // Prepare data for charts
  const appointmentTrendData = chartData.map(item => ({
    ...item,
    date: formatDate(item.date)
  }))

  const staffChartData = staffPerformance.slice(0, 8).map(staff => ({
    name: staff.staff_name.split(' ')[0], // First name only for chart
    umsatz: staff.total_revenue,
    termine: staff.total_appointments,
    auslastung: staff.utilization_rate
  }))

  const serviceChartData = servicePopularity.slice(0, 6).map(service => ({
    name: service.service_name.length > 15 
      ? service.service_name.substring(0, 15) + '...' 
      : service.service_name,
    value: service.total_bookings,
    revenue: service.total_revenue
  }))

  const revenueChartData = revenueData.slice(0, 30).map(item => ({
    ...item,
    date: formatDate(item.date)
  })).reverse() // Show chronologically

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Appointment Trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Terminentwicklung</CardTitle>
          <CardDescription>Tägliche Termine und Umsatz im Zeitverlauf</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={appointmentTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="appointments" orientation="left" />
              <YAxis yAxisId="revenue" orientation="right" />
              <Tooltip
                labelFormatter={(label) => `Datum: ${label}`}
                formatter={(value, name) => {
                  if (name === 'revenue') {
                    return [formatCurrency(value as number), 'Umsatz']
                  }
                  return [value, name === 'appointments' ? 'Termine' : name === 'completed' ? 'Abgeschlossen' : 'Storniert']
                }}
              />
              <Bar dataKey="appointments" fill="#8884d8" yAxisId="appointments" />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#82ca9d" 
                strokeWidth={2}
                yAxisId="revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Staff Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter Performance</CardTitle>
          <CardDescription>Umsatz und Auslastung pro Mitarbeiter</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffChartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'umsatz') {
                    return [formatCurrency(value as number), 'Umsatz']
                  }
                  if (name === 'auslastung') {
                    return [`${value}%`, 'Auslastung']
                  }
                  return [value, 'Termine']
                }}
              />
              <Bar dataKey="umsatz" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Service Popularity */}
      <Card>
        <CardHeader>
          <CardTitle>Beliebteste Services</CardTitle>
          <CardDescription>Buchungen nach Service-Art</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={serviceChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {serviceChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [value, 'Buchungen']}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Umsatzentwicklung</CardTitle>
          <CardDescription>Täglicher Umsatz und Kundenzahl</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="revenue" orientation="left" />
              <YAxis yAxisId="customers" orientation="right" />
              <Tooltip
                labelFormatter={(label) => `Datum: ${label}`}
                formatter={(value, name) => {
                  if (name === 'daily_revenue') {
                    return [formatCurrency(value as number), 'Umsatz']
                  }
                  if (name === 'unique_customers') {
                    return [value, 'Kunden']
                  }
                  return [value, 'Termine']
                }}
              />
              <Line 
                type="monotone" 
                dataKey="daily_revenue" 
                stroke="#8884d8" 
                strokeWidth={2}
                yAxisId="revenue"
              />
              <Line 
                type="monotone" 
                dataKey="unique_customers" 
                stroke="#82ca9d" 
                strokeWidth={2}
                yAxisId="customers"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Staff Performance Table */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detaillierte Mitarbeiter-Statistiken</CardTitle>
          <CardDescription>Vollständige Performance-Übersicht</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-left">Mitarbeiter</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Termine</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Abgeschlossen</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Umsatz</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Ø Preis</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.map((staff) => (
                  <tr key={staff.staff_id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2 font-medium">
                      {staff.staff_name}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right">
                      {staff.total_appointments}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right">
                      {staff.completed_appointments}
                      <span className="text-gray-500 text-sm ml-1">
                        ({staff.total_appointments > 0 
                          ? ((staff.completed_appointments / staff.total_appointments) * 100).toFixed(0)
                          : 0}%)
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right font-mono">
                      {formatCurrency(staff.total_revenue)}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right font-mono">
                      {formatCurrency(staff.average_ticket)}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        staff.utilization_rate >= 80 
                          ? 'bg-green-100 text-green-800'
                          : staff.utilization_rate >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {staff.utilization_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}