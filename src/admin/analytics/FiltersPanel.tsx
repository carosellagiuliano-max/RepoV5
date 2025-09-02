import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Staff {
  id: string
  full_name: string
}

interface Service {
  id: string
  name: string
  category: string
}

interface FiltersPanelProps {
  dateRange: {
    from: Date
    to: Date
  }
  onDateRangeChange: (range: { from: Date; to: Date }) => void
  selectedStaff: string
  onStaffChange: (staffId: string) => void
  selectedService: string
  onServiceChange: (serviceId: string) => void
  period: 'day' | 'week' | 'month'
  onPeriodChange: (period: 'day' | 'week' | 'month') => void
  staff: Staff[]
  services: Service[]
}

export function FiltersPanel({
  dateRange,
  onDateRangeChange,
  selectedStaff,
  onStaffChange,
  selectedService,
  onServiceChange,
  period,
  onPeriodChange,
  staff,
  services
}: FiltersPanelProps) {
  
  const setQuickDateRange = (days: number) => {
    const to = new Date()
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    onDateRangeChange({ from, to })
  }

  const clearFilters = () => {
    onStaffChange('')
    onServiceChange('')
    setQuickDateRange(30) // Reset to last 30 days
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filter & Zeitraum
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          
          {/* Date Range Picker */}
          <div className="lg:col-span-2">
            <label className="text-sm font-medium mb-2 block">Zeitraum</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd.MM.yyyy", { locale: de })} -{" "}
                        {format(dateRange.to, "dd.MM.yyyy", { locale: de })}
                      </>
                    ) : (
                      format(dateRange.from, "dd.MM.yyyy", { locale: de })
                    )
                  ) : (
                    <span>Zeitraum auswählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      onDateRangeChange({ from: range.from, to: range.to })
                    }
                  }}
                  numberOfMonths={2}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick Date Buttons */}
          <div>
            <label className="text-sm font-medium mb-2 block">Schnellauswahl</label>
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickDateRange(7)}
                className="text-xs"
              >
                7 Tage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickDateRange(30)}
                className="text-xs"
              >
                30 Tage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickDateRange(90)}
                className="text-xs"
              >
                90 Tage
              </Button>
            </div>
          </div>

          {/* Period Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Gruppierung</label>
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger>
                <SelectValue placeholder="Zeitraum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Täglich</SelectItem>
                <SelectItem value="week">Wöchentlich</SelectItem>
                <SelectItem value="month">Monatlich</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Mitarbeiter</label>
            <Select value={selectedStaff} onValueChange={onStaffChange}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Mitarbeiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Mitarbeiter</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Service</label>
            <Select value={selectedService} onValueChange={onServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex flex-col items-start">
                      <span>{service.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {service.category}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Active Filters & Clear Button */}
        {(selectedStaff || selectedService) && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Aktive Filter:</span>
              {selectedStaff && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  {staff.find(s => s.id === selectedStaff)?.full_name || 'Mitarbeiter'}
                </span>
              )}
              {selectedService && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  {services.find(s => s.id === selectedService)?.name || 'Service'}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Filter zurücksetzen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}