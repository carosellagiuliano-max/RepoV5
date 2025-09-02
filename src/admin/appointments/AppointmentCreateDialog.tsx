/**
 * Appointment Creation Dialog
 * Professional dialog for creating new appointments with conflict checking
 */

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar, Clock, User, Scissors, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useServices } from '@/hooks/use-services'
import { useStaff } from '@/hooks/use-staff'
import { useCustomers } from '@/hooks/use-customers'
import { Service } from '@/lib/types/database'
import { AppointmentCreate, ConflictCheck, ConflictDetails, ConflictSuggestion, ConflictCheckResponse } from '@/hooks/use-admin-appointments'
import { format, addMinutes, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

// Type definitions for props and data structures
interface AppointmentCreateDialogProps {
  onClose: () => void
  onSave: (appointmentData: AppointmentCreate) => Promise<void>
  onCheckConflicts: (conflictData: ConflictCheck) => Promise<ConflictCheckResponse>
  initialData?: {
    date?: string
    time?: string
    staffId?: string
    customerId?: string
  }
}

interface FormData {
  customerId: string
  staffId: string
  serviceId: string
  date: string
  time: string
  notes: string
  status: 'pending' | 'confirmed'
}

interface ConflictResult {
  hasConflicts: boolean
  conflicts: ConflictDetails[]
  availability: boolean
  suggestions: ConflictSuggestion[]
}

export function AppointmentCreateDialog({
  onClose,
  onSave,
  onCheckConflicts,
  initialData
}: AppointmentCreateDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    customerId: initialData?.customerId || '',
    staffId: initialData?.staffId || '',
    serviceId: '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    time: initialData?.time || '09:00',
    notes: '',
    status: 'confirmed'
  })

  const [conflicts, setConflicts] = useState<ConflictResult | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  const { data: services } = useServices()
  const { data: staff } = useStaff()
  const { data: customers } = useCustomers()

  // Calculate end time based on service duration
  const endTime = useMemo(() => {
    if (!selectedService || !formData.time) return ''
    
    const [hours, minutes] = formData.time.split(':').map(Number)
    const startDateTime = new Date()
    startDateTime.setHours(hours, minutes, 0, 0)
    
    const endDateTime = addMinutes(startDateTime, selectedService.duration_minutes)
    return format(endDateTime, 'HH:mm')
  }, [selectedService, formData.time])

  // Get full datetime strings
  const startDateTime = useMemo(() => {
    if (!formData.date || !formData.time) return ''
    return `${formData.date}T${formData.time}:00`
  }, [formData.date, formData.time])

  const endDateTime = useMemo(() => {
    if (!formData.date || !endTime) return ''
    return `${formData.date}T${endTime}:00`
  }, [formData.date, endTime])

  // Update selected service when serviceId changes
  useEffect(() => {
    if (formData.serviceId && services) {
      const service = services.find(s => s.id === formData.serviceId)
      setSelectedService(service || null)
    } else {
      setSelectedService(null)
    }
  }, [formData.serviceId, services])

  // Check conflicts when relevant data changes
  useEffect(() => {
    if (formData.staffId && startDateTime && endDateTime) {
      checkConflicts()
    }
  }, [formData.staffId, startDateTime, endDateTime])

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear conflicts when changing critical fields
    if (['staffId', 'date', 'time', 'serviceId'].includes(field)) {
      setConflicts(null)
    }
  }

  const checkConflicts = async () => {
    if (!formData.staffId || !startDateTime || !endDateTime) return
    
    setCheckingConflicts(true)
    try {
      const result = await onCheckConflicts({
        staffId: formData.staffId,
        startTime: startDateTime,
        endTime: endDateTime
      })
      setConflicts(result)
    } catch (error) {
      console.error('Failed to check conflicts:', error)
      setConflicts(null)
    } finally {
      setCheckingConflicts(false)
    }
  }

  const handleSave = async () => {
    if (!isFormValid()) return
    
    setSaving(true)
    try {
      await onSave({
        customerId: formData.customerId,
        staffId: formData.staffId,
        serviceId: formData.serviceId,
        startTime: startDateTime,
        endTime: endDateTime,
        notes: formData.notes,
        status: formData.status
      })
    } catch (error) {
      console.error('Failed to save appointment:', error)
    } finally {
      setSaving(false)
    }
  }

  const isFormValid = () => {
    return formData.customerId && 
           formData.staffId && 
           formData.serviceId && 
           formData.date && 
           formData.time &&
           !conflicts?.hasConflicts
  }

  const selectedCustomer = customers?.find(c => c.id === formData.customerId)
  const selectedStaff = staff?.find(s => s.id === formData.staffId)

  // Generate time options (every 15 minutes from 7:00 to 20:00)
  const timeOptions = useMemo(() => {
    const options = []
    for (let hour = 7; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 20 && minute > 0) break // Stop at 20:00
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        options.push(time)
      }
    }
    return options
  }, [])

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Neuen Termin erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Kunde *</Label>
            <Select value={formData.customerId} onValueChange={(value) => handleInputChange('customerId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{customer.full_name}</div>
                        <div className="text-xs text-muted-foreground">{customer.email}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCustomer && (
              <Card>
                <CardContent className="p-3">
                  <div className="text-sm">
                    <div className="font-medium">{selectedCustomer.full_name}</div>
                    <div className="text-muted-foreground">{selectedCustomer.email}</div>
                    {selectedCustomer.phone && (
                      <div className="text-muted-foreground">{selectedCustomer.phone}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service">Service *</Label>
            <Select value={formData.serviceId} onValueChange={(value) => handleInputChange('serviceId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Service auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {service.duration_minutes} Min. • CHF {(service.price_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedService && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{selectedService.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedService.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">CHF {(selectedService.price_cents / 100).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{selectedService.duration_minutes} Min.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Staff Selection */}
          <div className="space-y-2">
            <Label htmlFor="staff">Mitarbeiter *</Label>
            <Select value={formData.staffId} onValueChange={(value) => handleInputChange('staffId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {staff?.filter(s => s.is_active).map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time">Uhrzeit *</Label>
              <Select value={formData.time} onValueChange={(value) => handleInputChange('time', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Zeit auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time Summary */}
          {selectedService && formData.time && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Start: {formData.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Ende: {endTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Dauer: {selectedService.duration_minutes} Min.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conflict Checking */}
          {checkingConflicts && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Prüfe Verfügbarkeit...
              </AlertDescription>
            </Alert>
          )}

          {conflicts && (
            <div className="space-y-2">
              {conflicts.hasConflicts ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium">Konflikt erkannt!</div>
                      {conflicts.conflicts.length > 0 && (
                        <div>
                          <div className="text-sm">Überschneidende Termine:</div>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {conflicts.conflicts.map((conflict, index) => (
                              <li key={index}>
                                {conflict.customer_name} • {conflict.service_name} • 
                                {format(parseISO(conflict.start_time), 'HH:mm')} - 
                                {format(parseISO(conflict.end_time), 'HH:mm')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!conflicts.availability && (
                        <div className="text-sm">
                          Der Mitarbeiter ist zu dieser Zeit nicht verfügbar.
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Termin ist verfügbar und kann gebucht werden.
                  </AlertDescription>
                </Alert>
              )}

              {/* Suggestions */}
              {conflicts.suggestions && conflicts.suggestions.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Alternative Zeiten:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {conflicts.suggestions.slice(0, 4).map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const time = format(parseISO(suggestion.start_time), 'HH:mm')
                              handleInputChange('time', time)
                            }}
                          >
                            {format(parseISO(suggestion.start_time), 'HH:mm')} - 
                            {format(parseISO(suggestion.end_time), 'HH:mm')}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as 'pending' | 'confirmed')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <Badge className="bg-yellow-100 text-yellow-800">Ausstehend</Badge>
                </SelectItem>
                <SelectItem value="confirmed">
                  <Badge className="bg-green-100 text-green-800">Bestätigt</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Besondere Wünsche oder Notizen..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isFormValid() || saving}
          >
            {saving ? 'Wird gespeichert...' : 'Termin erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}