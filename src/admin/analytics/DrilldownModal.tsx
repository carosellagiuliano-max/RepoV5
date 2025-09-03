/**
 * Drilldown Modal Component
 * Shows detailed appointment data when clicking on KPI cards or charts
 */

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Download, 
  Calendar, 
  Clock, 
  Users, 
  Euro, 
  Filter,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { DrilldownAppointment, DrilldownFilters } from '@/lib/types/analytics'

interface DrilldownModalProps {
  isOpen: boolean
  onClose: () => void
  metric: 'appointments' | 'revenue' | 'staff' | 'service'
  title: string
  filters: DrilldownFilters
  onFiltersChange: (filters: DrilldownFilters) => void
}

export function DrilldownModal({
  isOpen,
  onClose,
  metric,
  title,
  filters,
  onFiltersChange
}: DrilldownModalProps) {
  const [appointments, setAppointments] = useState<DrilldownAppointment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    averageDuration: 0,
    completionRate: 0
  })

  const fetchDrilldownData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const queryParams = new URLSearchParams({
        metric,
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.value && { value: filters.value }),
        ...(filters.status && { status: filters.status.join(',') })
      })

      const response = await fetch(`/.netlify/functions/admin/analytics/drilldown?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch drilldown data')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch data')
      }

      setAppointments(result.data.appointments)
      setSummary(result.data.summary)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast.error('Fehler beim Laden der Detail-Daten')
    } finally {
      setIsLoading(false)
    }
  }, [metric, filters.startDate, filters.endDate, filters.value, filters.status])

  useEffect(() => {
    if (isOpen) {
      fetchDrilldownData()
    }
  }, [isOpen, fetchDrilldownData])

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = searchTerm === '' || 
      appointment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const variants = {
      'completed': 'default',
      'confirmed': 'secondary',
      'pending': 'outline',
      'cancelled': 'destructive'
    } as const

    const labels = {
      'completed': 'Abgeschlossen',
      'confirmed': 'Bestätigt',
      'pending': 'Ausstehend',
      'cancelled': 'Storniert'
    }

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    )
  }

  const handleExport = async () => {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const queryParams = new URLSearchParams({
        type: 'drilldown',
        metric,
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.value && { value: filters.value }),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/.netlify/functions/admin/analytics/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
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
      
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
        `drilldown_${metric}_${format(new Date(), 'yyyy-MM-dd')}.csv`
      
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
              <DialogDescription className="mt-2">
                Detail-Ansicht der Termine für den ausgewählten Zeitraum
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  CHF {summary.totalRevenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ø Termindauer</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {Math.round(summary.averageDuration)} min
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Abschlussrate</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">
                  {summary.completionRate.toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Kunde, Mitarbeiter oder Service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
              <SelectItem value="confirmed">Bestätigt</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="cancelled">Storniert</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Appointments Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>Fehler beim Laden der Daten</p>
              <Button onClick={fetchDrilldownData} className="mt-2">
                Erneut versuchen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Keine Termine gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(appointment.date), 'dd.MM.yyyy', { locale: de })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {appointment.time}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{appointment.customerName}</div>
                          {appointment.customerEmail && (
                            <div className="text-sm text-muted-foreground">
                              {appointment.customerEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {appointment.staffName}
                        </div>
                      </TableCell>
                      <TableCell>{appointment.serviceName}</TableCell>
                      <TableCell>{appointment.duration} min</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Euro className="w-4 h-4 text-muted-foreground" />
                          CHF {appointment.price.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {filteredAppointments.length} von {appointments.length} Terminen
          </div>
          <div className="text-sm font-medium">
            Zeitraum: {format(new Date(filters.startDate), 'dd.MM.yyyy', { locale: de })} - {format(new Date(filters.endDate), 'dd.MM.yyyy', { locale: de })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}