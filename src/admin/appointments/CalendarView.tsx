/**
 * Professional Calendar View with Drag & Drop
 * Advanced calendar component with day/week/month views and drag & drop reschedule
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Phone, Mail, MoreVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AppointmentFilters } from './CalendarPro'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isToday } from 'date-fns'
import { de } from 'date-fns/locale'

interface CalendarViewProps {
  appointments: any[]
  loading: boolean
  onReschedule: (appointmentId: string, newStartTime: string, newEndTime: string) => Promise<boolean>
  onCancel: (appointmentId: string, reason?: string) => Promise<void>
  onStatusUpdate: (data: { appointmentId: string; status: string; notes?: string }) => Promise<void>
  filters: AppointmentFilters
  onFilterChange: (filters: Partial<AppointmentFilters>) => void
}

type ViewType = 'day' | 'week' | 'month'

interface DragState {
  isDragging: boolean
  appointmentId: string | null
  startSlot: string | null
  currentSlot: string | null
}

export function CalendarView({
  appointments,
  loading,
  onReschedule,
  onCancel,
  onStatusUpdate,
  filters,
  onFilterChange
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('week')
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    appointmentId: null,
    startSlot: null,
    currentSlot: null
  })
  const [conflictCheck, setConflictCheck] = useState<string[]>([])
  const dragRef = useRef<HTMLDivElement>(null)

  // Calculate visible date range
  const dateRange = useMemo(() => {
    switch (viewType) {
      case 'day':
        return {
          start: new Date(currentDate.setHours(0, 0, 0, 0)),
          end: new Date(currentDate.setHours(23, 59, 59, 999))
        }
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        }
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        }
    }
  }, [currentDate, viewType])

  // Generate time slots for calendar grid
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 7; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          hour,
          minute
        })
      }
    }
    return slots
  }, [])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = []
    const start = dateRange.start
    const end = dateRange.end
    
    if (viewType === 'day') {
      days.push(currentDate)
    } else if (viewType === 'week') {
      for (let i = 0; i < 7; i++) {
        days.push(addDays(start, i))
      }
    } else {
      // Month view - simplified for now
      for (let i = 0; i < 7; i++) {
        days.push(addDays(start, i))
      }
    }
    
    return days
  }, [dateRange, viewType, currentDate])

  // Filter appointments for current view
  const visibleAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.start_time)
      return aptDate >= dateRange.start && aptDate <= dateRange.end
    })
  }, [appointments, dateRange])

  // Navigation handlers
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    switch (viewType) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCurrentDate(newDate)
  }, [currentDate, viewType])

  // Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, appointment: any) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', appointment.id)
    
    setDragState({
      isDragging: true,
      appointmentId: appointment.id,
      startSlot: null,
      currentSlot: null
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    
    if (dragState.isDragging) {
      setDragState(prev => ({
        ...prev,
        currentSlot: slotId
      }))
    }
  }, [dragState.isDragging])

  const handleDrop = useCallback(async (e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    
    const appointmentId = e.dataTransfer.getData('text/plain')
    const appointment = appointments.find(apt => apt.id === appointmentId)
    
    if (!appointment) return
    
    // Parse slot ID (format: "date-time")
    const [dateStr, timeStr] = slotId.split('-')
    const [hour, minute] = timeStr.split(':').map(Number)
    
    const dropDate = new Date(dateStr)
    dropDate.setHours(hour, minute, 0, 0)
    
    const duration = new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()
    const newEndTime = new Date(dropDate.getTime() + duration)
    
    const success = await onReschedule(
      appointmentId,
      dropDate.toISOString(),
      newEndTime.toISOString()
    )
    
    setDragState({
      isDragging: false,
      appointmentId: null,
      startSlot: null,
      currentSlot: null
    })
    
    setConflictCheck([])
  }, [appointments, onReschedule])

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      appointmentId: null,
      startSlot: null,
      currentSlot: null
    })
    setConflictCheck([])
  }, [])

  // Get appointment position in grid
  const getAppointmentPosition = useCallback((appointment: any, dayIndex: number) => {
    const startTime = new Date(appointment.start_time)
    const hour = startTime.getHours()
    const minute = startTime.getMinutes()
    
    const slotIndex = timeSlots.findIndex(slot => 
      slot.hour === hour && slot.minute === minute
    )
    
    const duration = (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / (1000 * 60)
    const slotHeight = 60 // pixels per 30-minute slot
    const height = (duration / 30) * slotHeight
    
    return {
      top: slotIndex * slotHeight,
      height,
      left: dayIndex * (100 / calendarDays.length) + '%',
      width: (100 / calendarDays.length) + '%'
    }
  }, [timeSlots, calendarDays.length])

  // Get status color
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'pending':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 border-red-300 text-red-800'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }, [])

  const formatDateRange = useCallback(() => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
        return `${format(weekStart, 'd. MMM', { locale: de })} - ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: de })
    }
  }, [currentDate, viewType])

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {['day', 'week', 'month'].map((view) => (
                  <Button
                    key={view}
                    variant={viewType === view ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewType(view as ViewType)}
                  >
                    {view === 'day' ? 'Tag' : view === 'week' ? 'Woche' : 'Monat'}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="min-w-[200px] text-center">
                  <h3 className="font-semibold">{formatDateRange()}</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Heute
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="calendar-grid" style={{ height: viewType === 'month' ? '600px' : '800px' }}>
            {/* Header with days */}
            <div className="grid grid-cols-8 border-b">
              <div className="p-2 text-sm font-medium text-muted-foreground border-r">
                Zeit
              </div>
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`p-2 text-center border-r ${
                    isToday(day) ? 'bg-primary/10 font-bold' : ''
                  }`}
                >
                  <div className="text-sm font-medium">
                    {format(day, 'EEE', { locale: de })}
                  </div>
                  <div className="text-lg">
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Time slots grid */}
            <div className="relative overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
              <div className="grid grid-cols-8">
                {/* Time column */}
                <div className="border-r">
                  {timeSlots.map((slot, index) => (
                    <div
                      key={slot.time}
                      className="h-[60px] border-b text-xs text-muted-foreground p-2 flex items-start"
                    >
                      {slot.minute === 0 ? slot.time : ''}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {calendarDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="border-r relative">
                    {timeSlots.map((slot, slotIndex) => {
                      const slotId = `${format(day, 'yyyy-MM-dd')}-${slot.time}`
                      const isDropTarget = dragState.currentSlot === slotId
                      
                      return (
                        <div
                          key={slotIndex}
                          className={`h-[60px] border-b transition-colors ${
                            isDropTarget ? 'bg-primary/20' : 'hover:bg-muted/50'
                          }`}
                          onDragOver={handleDragOver}
                          onDragEnter={(e) => handleDragEnter(e, slotId)}
                          onDrop={(e) => handleDrop(e, slotId)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Appointments overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {visibleAppointments.map((appointment) => {
                  const dayIndex = calendarDays.findIndex(day =>
                    isSameDay(day, new Date(appointment.start_time))
                  )
                  
                  if (dayIndex === -1) return null
                  
                  const position = getAppointmentPosition(appointment, dayIndex)
                  
                  return (
                    <div
                      key={appointment.id}
                      className={`absolute pointer-events-auto cursor-move border-2 rounded-lg p-2 ${getStatusColor(appointment.status)} ${
                        dragState.appointmentId === appointment.id ? 'opacity-50' : ''
                      }`}
                      style={{
                        top: position.top + 80, // Offset for header
                        height: position.height,
                        left: `calc(${(100 / 8) * (dayIndex + 1)}% + 2px)`,
                        width: `calc(${100 / 8}% - 4px)`,
                        minHeight: '50px'
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, appointment)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="text-xs font-medium truncate">
                        {appointment.customer_name}
                      </div>
                      <div className="text-xs opacity-75 truncate">
                        {appointment.service_name}
                      </div>
                      <div className="text-xs opacity-75">
                        {format(new Date(appointment.start_time), 'HH:mm')} - 
                        {format(new Date(appointment.end_time), 'HH:mm')}
                      </div>
                      
                      {/* Context menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => onStatusUpdate({
                              appointmentId: appointment.id,
                              status: appointment.status === 'confirmed' ? 'pending' : 'confirmed'
                            })}
                          >
                            {appointment.status === 'confirmed' ? 'Als ausstehend markieren' : 'Bestätigen'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onCancel(appointment.id)}
                            className="text-red-600"
                          >
                            Stornieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Termine werden geladen...</p>
        </div>
      )}
    </div>
  )
}