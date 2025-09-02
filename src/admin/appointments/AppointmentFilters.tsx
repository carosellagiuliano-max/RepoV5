/**
 * Advanced Appointment Filters
 * Professional filtering interface for appointment management
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { X, Search, Filter, RotateCcw } from 'lucide-react'
import { AppointmentFilters } from './CalendarPro'
import { useServices } from '@/hooks/use-services'
import { useStaff } from '@/hooks/use-staff'

interface AppointmentFiltersProps {
  filters: AppointmentFilters
  onChange: (filters: Partial<AppointmentFilters>) => void
  onClose: () => void
}

export function AppointmentFilters({ filters, onChange, onClose }: AppointmentFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AppointmentFilters>(filters)
  const { data: services } = useServices()
  const { data: staff } = useStaff()

  const statusOptions = [
    { value: 'pending', label: 'Ausstehend', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'confirmed', label: 'Bestätigt', color: 'bg-green-100 text-green-800' },
    { value: 'completed', label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-800' },
    { value: 'cancelled', label: 'Storniert', color: 'bg-red-100 text-red-800' },
    { value: 'no_show', label: 'Nicht erschienen', color: 'bg-gray-100 text-gray-800' }
  ]

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleFilterChange = (key: keyof AppointmentFilters, value: string | undefined) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
  }

  const applyFilters = () => {
    onChange(localFilters)
    onClose()
  }

  const resetFilters = () => {
    const resetFilters: AppointmentFilters = {
      page: 1,
      limit: 50
    }
    setLocalFilters(resetFilters)
    onChange(resetFilters)
  }

  const clearFilter = (key: keyof AppointmentFilters) => {
    const newFilters = { ...localFilters }
    delete newFilters[key]
    setLocalFilters(newFilters)
  }

  const getActiveFiltersCount = () => {
    return Object.keys(localFilters).filter(key => 
      !['page', 'limit'].includes(key) && 
      localFilters[key as keyof AppointmentFilters] !== undefined &&
      localFilters[key as keyof AppointmentFilters] !== ''
    ).length
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Erweiterte Filter</CardTitle>
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary">
                {getActiveFiltersCount()} Filter aktiv
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Suche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Kunde, Mitarbeiter, Service oder Notizen durchsuchen..."
              value={localFilters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
            {localFilters.search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('search')}
                className="absolute right-2 top-1 h-8 w-8 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Staff Filter */}
          <div className="space-y-2">
            <Label>Mitarbeiter</Label>
            <Select
              value={localFilters.staffId || ''}
              onValueChange={(value) => handleFilterChange('staffId', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Mitarbeiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Mitarbeiter</SelectItem>
                {staff?.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localFilters.staffId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('staffId')}
                className="h-6 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          {/* Service Filter */}
          <div className="space-y-2">
            <Label>Service</Label>
            <Select
              value={localFilters.serviceId || ''}
              onValueChange={(value) => handleFilterChange('serviceId', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Services</SelectItem>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localFilters.serviceId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('serviceId')}
                className="h-6 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={localFilters.status || ''}
              onValueChange={(value) => handleFilterChange('status', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status.color.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')}`} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localFilters.status && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('status')}
                className="h-6 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Von Datum</Label>
            <Input
              type="date"
              value={localFilters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
            />
            {localFilters.startDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('startDate')}
                className="h-6 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bis Datum</Label>
            <Input
              type="date"
              value={localFilters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
            />
            {localFilters.endDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('endDate')}
                className="h-6 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="space-y-2">
          <Label>Schnellauswahl</Label>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: 'Heute',
                onClick: () => {
                  const today = new Date().toISOString().split('T')[0]
                  handleFilterChange('startDate', today)
                  handleFilterChange('endDate', today)
                }
              },
              {
                label: 'Diese Woche',
                onClick: () => {
                  const today = new Date()
                  const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1))
                  const sunday = new Date(monday)
                  sunday.setDate(monday.getDate() + 6)
                  
                  handleFilterChange('startDate', monday.toISOString().split('T')[0])
                  handleFilterChange('endDate', sunday.toISOString().split('T')[0])
                }
              },
              {
                label: 'Dieser Monat',
                onClick: () => {
                  const today = new Date()
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
                  
                  handleFilterChange('startDate', firstDay.toISOString().split('T')[0])
                  handleFilterChange('endDate', lastDay.toISOString().split('T')[0])
                }
              },
              {
                label: 'Nächste 7 Tage',
                onClick: () => {
                  const today = new Date()
                  const nextWeek = new Date(today)
                  nextWeek.setDate(today.getDate() + 7)
                  
                  handleFilterChange('startDate', today.toISOString().split('T')[0])
                  handleFilterChange('endDate', nextWeek.toISOString().split('T')[0])
                }
              }
            ].map((quickFilter) => (
              <Button
                key={quickFilter.label}
                variant="outline"
                size="sm"
                onClick={quickFilter.onClick}
              >
                {quickFilter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFiltersCount() > 0 && (
          <div className="space-y-2">
            <Label>Aktive Filter</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(localFilters).map(([key, value]) => {
                if (['page', 'limit'].includes(key) || !value) return null
                
                let displayValue = value
                if (key === 'staffId') {
                  const staffMember = staff?.find(s => s.id === value)
                  displayValue = staffMember?.full_name || value
                } else if (key === 'serviceId') {
                  const service = services?.find(s => s.id === value)
                  displayValue = service?.name || value
                } else if (key === 'status') {
                  const status = statusOptions.find(s => s.value === value)
                  displayValue = status?.label || value
                }
                
                return (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {key === 'search' ? 'Suche' : 
                     key === 'staffId' ? 'Mitarbeiter' :
                     key === 'serviceId' ? 'Service' :
                     key === 'status' ? 'Status' :
                     key === 'startDate' ? 'Von' :
                     key === 'endDate' ? 'Bis' : key}: {displayValue}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearFilter(key as keyof AppointmentFilters)}
                      className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="w-2 h-2" />
                    </Button>
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={resetFilters}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Alle zurücksetzen
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={applyFilters}>
              Filter anwenden
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}