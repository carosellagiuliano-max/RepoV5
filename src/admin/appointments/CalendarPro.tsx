/**
 * Admin Appointments Console (Calendar Pro)
 * Professional calendar with drag & drop, conflict checking, and advanced filtering
 */

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarView } from './CalendarView'
import { AppointmentsList } from './AppointmentsList'
import { AppointmentFilters } from './AppointmentFilters'
import { AppointmentStats } from './AppointmentStats'
import { Plus, Calendar, List, Filter, Settings } from 'lucide-react'
import { useAdminAppointments, AppointmentCreate } from '@/hooks/use-admin-appointments'
import { AppointmentCreateDialog } from './AppointmentCreateDialog'
import { toast } from 'sonner'


export function CalendarPro() {
  const [activeView, setActiveView] = useState<'calendar' | 'list'>('calendar')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<AppointmentFilters>({
    limit: 50,
    page: 1
  })

  const {
    appointments,
    loading,
    error,
    rescheduleAppointment,
    cancelAppointment,
    createAppointment,
    updateAppointmentStatus,
    checkConflicts
  } = useAdminAppointments(filters)

  const handleCreateAppointment = useCallback(async (appointmentData: AppointmentCreate) => {
    try {
      await createAppointment.mutateAsync(appointmentData)
      toast.success('Termin erfolgreich erstellt')
      setShowCreateDialog(false)
    } catch (error) {
      toast.error('Fehler beim Erstellen des Termins')
      console.error('Failed to create appointment:', error)
    }
  }, [createAppointment])

  const handleRescheduleAppointment = useCallback(async (
    appointmentId: string, 
    newStartTime: string, 
    newEndTime: string
  ) => {
    try {
      // Check for conflicts first
      const hasConflicts = await checkConflicts.mutateAsync({
        appointmentId,
        startTime: newStartTime,
        endTime: newEndTime
      })

      if (hasConflicts.length > 0) {
        toast.error('Konflikt mit bestehenden Terminen erkannt')
        return false
      }

      await rescheduleAppointment.mutateAsync({
        appointmentId,
        startTime: newStartTime,
        endTime: newEndTime
      })

      toast.success('Termin erfolgreich verschoben')
      return true
    } catch (error) {
      toast.error('Fehler beim Verschieben des Termins')
      console.error('Failed to reschedule appointment:', error)
      return false
    }
  }, [rescheduleAppointment, checkConflicts])

  const handleCancelAppointment = useCallback(async (
    appointmentId: string, 
    reason?: string
  ) => {
    try {
      await cancelAppointment.mutateAsync({ appointmentId, reason })
      toast.success('Termin erfolgreich storniert')
    } catch (error) {
      toast.error('Fehler beim Stornieren des Termins')
      console.error('Failed to cancel appointment:', error)
    }
  }, [cancelAppointment])

  const handleFilterChange = useCallback((newFilters: Partial<AppointmentFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }, [])

  const memoizedAppointments = useMemo(() => appointments || [], [appointments])

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Fehler beim Laden der Termine: {error.message}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Neu laden
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Terminkalender Pro</h2>
          <p className="text-muted-foreground">
            Professionelle Terminverwaltung mit Drag & Drop
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Neuer Termin
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <AppointmentStats appointments={memoizedAppointments} />

      {/* Filters */}
      {showFilters && (
        <AppointmentFilters
          filters={filters}
          onChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Main Content */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'calendar' | 'list')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Kalenderansicht
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="w-4 h-4" />
            Listenansicht
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarView
            appointments={memoizedAppointments}
            loading={loading}
            onReschedule={handleRescheduleAppointment}
            onCancel={handleCancelAppointment}
            onStatusUpdate={updateAppointmentStatus.mutateAsync}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <AppointmentsList
            appointments={memoizedAppointments}
            loading={loading}
            onReschedule={handleRescheduleAppointment}
            onCancel={handleCancelAppointment}
            onStatusUpdate={updateAppointmentStatus.mutateAsync}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </TabsContent>
      </Tabs>

      {/* Create Appointment Dialog */}
      {showCreateDialog && (
        <AppointmentCreateDialog
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreateAppointment}
          onCheckConflicts={checkConflicts.mutateAsync}
        />
      )}
    </div>
  )
}