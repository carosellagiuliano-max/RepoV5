import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Users, 
  DollarSign, 
  Clock,
  Star,
  Target,
  Activity,
  RefreshCw
} from 'lucide-react';
import { subDays, format } from 'date-fns';

interface AnalyticsOverviewProps {
  className?: string;
}

// Mock data for demonstration - in a real implementation, this would come from the API
const mockAnalyticsData = {
  summary: {
    totalBookings: 1247,
    totalRevenue: 32580,
    activeCustomers: 892,
    averageBookingValue: 26.14,
    topService: 'Damenschnitt',
    topStaffMember: 'Maria Schmidt',
  },
  trends: {
    bookingsChange: 12.5,
    revenueChange: 8.3,
    customersChange: 15.2,
    avgValueChange: -2.1,
  },
  recentMetrics: {
    todayBookings: 18,
    todayRevenue: 467,
    weekBookings: 94,
    weekRevenue: 2456,
  },
  topServices: [
    { name: 'Damenschnitt', bookings: 324, revenue: 8424 },
    { name: 'Herrenbarber', bookings: 298, revenue: 5960 },
    { name: 'Colorationen', bookings: 187, revenue: 11220 },
    { name: 'Styling', bookings: 156, revenue: 3120 },
    { name: 'Treatments', bookings: 89, revenue: 2670 },
  ],
  staffPerformance: [
    { name: 'Maria Schmidt', bookings: 189, revenue: 4914, utilization: 92 },
    { name: 'Thomas Weber', bookings: 167, revenue: 4342, utilization: 87 },
    { name: 'Anna Fischer', bookings: 145, revenue: 3770, utilization: 85 },
    { name: 'Michael Klein', bookings: 132, revenue: 3432, utilization: 81 },
  ],
};

export function AnalyticsOverview({ className = '' }: AnalyticsOverviewProps) {
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [timePeriod, setTimePeriod] = useState<string>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const isPositive = value > 0;
    return (
      <span className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive business insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Activity className="w-3 h-3" />
            Live Data
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Aktualisiert...' : 'Aktualisieren'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zeitraum & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Zeitraum</label>
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Zeitraum wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                  <SelectItem value="30d">Letzte 30 Tage</SelectItem>
                  <SelectItem value="90d">Letzte 3 Monate</SelectItem>
                  <SelectItem value="365d">Letztes Jahr</SelectItem>
                  <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {timePeriod === 'custom' && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Von</label>
                  <DatePicker 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Bis</label>
                  <DatePicker 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamte Termine</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockAnalyticsData.summary.totalBookings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {formatPercentage(mockAnalyticsData.trends.bookingsChange)} gegenüber Vorperiode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mockAnalyticsData.summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {formatPercentage(mockAnalyticsData.trends.revenueChange)} gegenüber Vorperiode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Kunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockAnalyticsData.summary.activeCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {formatPercentage(mockAnalyticsData.trends.customersChange)} gegenüber Vorperiode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø Terminwert</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mockAnalyticsData.summary.averageBookingValue)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {formatPercentage(mockAnalyticsData.trends.avgValueChange)} gegenüber Vorperiode
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="staff">Mitarbeiter</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Aktuelle Performance
                </CardTitle>
                <CardDescription>Heute und diese Woche</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Heute</p>
                    <p className="text-lg font-semibold">{mockAnalyticsData.recentMetrics.todayBookings} Termine</p>
                    <p className="text-sm text-green-600">{formatCurrency(mockAnalyticsData.recentMetrics.todayRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Diese Woche</p>
                    <p className="text-lg font-semibold">{mockAnalyticsData.recentMetrics.weekBookings} Termine</p>
                    <p className="text-sm text-green-600">{formatCurrency(mockAnalyticsData.recentMetrics.weekRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Top Performer
                </CardTitle>
                <CardDescription>Beste Service und Mitarbeiter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Beliebtester Service</p>
                  <p className="text-lg font-semibold">{mockAnalyticsData.summary.topService}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Mitarbeiter</p>
                  <p className="text-lg font-semibold">{mockAnalyticsData.summary.topStaffMember}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Service Performance
              </CardTitle>
              <CardDescription>Top 5 Services nach Buchungen und Umsatz</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAnalyticsData.topServices.map((service, index) => (
                  <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">{service.bookings} Buchungen</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(service.revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        Ø {formatCurrency(service.revenue / service.bookings)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Mitarbeiter Performance
              </CardTitle>
              <CardDescription>Leistung und Auslastung der Mitarbeiter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAnalyticsData.staffPerformance.map((staff, index) => (
                  <div key={staff.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-muted-foreground">{staff.bookings} Termine</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(staff.revenue)}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Auslastung:</p>
                        <Badge variant={staff.utilization >= 85 ? "default" : "secondary"}>
                          {staff.utilization}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Trend-Analyse
              </CardTitle>
              <CardDescription>Entwicklung über Zeit (Demo-Visualisierung)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Trend-Diagramme</p>
                  <p className="text-sm text-muted-foreground">
                    Hier würden interaktive Charts zur Darstellung<br />
                    von Buchungstrends, Umsatzentwicklung und mehr erscheinen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}