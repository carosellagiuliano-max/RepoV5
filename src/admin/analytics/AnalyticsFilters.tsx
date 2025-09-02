/**
 * Analytics Filters Component
 * Provides filtering controls for analytics data
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, X, Filter } from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'

interface AnalyticsFiltersProps {
  filters: {
    startDate: string
    endDate: string
    staffId: string
    serviceId: string
    period: 'day' | 'week' | 'month'
  }
  onFiltersChange: (filters: AnalyticsFiltersProps['filters']) => void
  isLoading?: boolean
}

interface Staff {
  id: string
  first_name: string | null
  last_name: string | null
}

interface Service {
  id: string
  name: string
  category: string | null
}

export function AnalyticsFilters({ filters, onFiltersChange, isLoading }: AnalyticsFiltersProps) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [localFilters, setLocalFilters] = useState(filters)

  // Load staff and services for filter dropdowns
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Load staff
        const staffResponse = await fetch('/.netlify/functions/admin/staff', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        if (staffResponse.ok) {
          const staffData = await staffResponse.json()
          setStaff(staffData.staff || [])
        }

        // Load services
        const servicesResponse = await fetch('/.netlify/functions/admin/services', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json()
          setServices(servicesData.services || [])
        }
      } catch (error) {
        console.error('Failed to load filter options:', error)
      }
    }

    loadFilterOptions()
  }, [])

  const handlePeriodChange = (period: 'day' | 'week' | 'month') => {
    const now = new Date()
    let startDate: string
    let endDate: string

    switch (period) {
      case 'day':
        startDate = format(startOfDay(now), 'yyyy-MM-dd')
        endDate = format(startOfDay(now), 'yyyy-MM-dd')
        break
      case 'week':
        startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'month':
      default:
        startDate = format(startOfMonth(now), 'yyyy-MM-dd')
        endDate = format(endOfMonth(now), 'yyyy-MM-dd')
        break
    }

    const newFilters = { ...localFilters, period, startDate, endDate }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
  }

  const applyFilters = () => {
    onFiltersChange(localFilters)
  }

  const resetFilters = () => {
    const defaultFilters = {
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      staffId: '',
      serviceId: '',
      period: 'month' as const
    }
    setLocalFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  const getStaffName = (staff: Staff) => {
    if (staff.first_name && staff.last_name) {
      return `${staff.first_name} ${staff.last_name}`
    }
    return staff.first_name || staff.last_name || 'Unbekannt'
  }

  const activeFiltersCount = [
    localFilters.staffId,
    localFilters.serviceId,
    // Don't count date range as "active" since it's always set
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Quick Period Selection */}
      <div>
        <Label className="text-sm font-medium">Zeitraum</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {[
            { key: 'day', label: 'Heute' },
            { key: 'week', label: 'Diese Woche' },
            { key: 'month', label: 'Dieser Monat' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={localFilters.period === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange(key as 'day' | 'week' | 'month')}
              disabled={isLoading}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate" className="text-sm font-medium">
            Von
          </Label>
          <Input
            id="startDate"
            type="date"
            value={localFilters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            disabled={isLoading}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="endDate" className="text-sm font-medium">
            Bis
          </Label>
          <Input
            id="endDate"
            type="date"
            value={localFilters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            disabled={isLoading}
            className="mt-1"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="staffFilter" className="text-sm font-medium">
            Mitarbeiter
          </Label>
          <Select
            value={localFilters.staffId}
            onValueChange={(value) => handleFilterChange('staffId', value)}
            disabled={isLoading}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Alle Mitarbeiter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Mitarbeiter</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {getStaffName(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="serviceFilter" className="text-sm font-medium">
            Service
          </Label>
          <Select
            value={localFilters.serviceId}
            onValueChange={(value) => handleFilterChange('serviceId', value)}
            disabled={isLoading}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Alle Services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Services</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                  {service.category && (
                    <span className="text-muted-foreground ml-2">({service.category})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Filter className="w-3 h-3" />
              {activeFiltersCount} Filter aktiv
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {format(new Date(localFilters.startDate), 'dd.MM.yyyy', { locale: de })} - {' '}
            {format(new Date(localFilters.endDate), 'dd.MM.yyyy', { locale: de })}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Zurücksetzen
          </Button>
          <Button
            size="sm"
            onClick={applyFilters}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" />
            Filter anwenden
          </Button>
        </div>
      </div>
    </div>
  )
}