import React, { useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarIcon, Clock, Scissors, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { bookingHelpers } from '@/lib/supabase'
import { useBusinessSettings, useAppointmentValidation } from '@/hooks/use-settings'
import HaircutLengthDialog from './haircut-length-dialog'
import AdditionalServicesDialog from './additional-services-dialog'

// Using existing team owner image for Vanessa
import vanessaLogo from '@/assets/team-owner.jpg'

interface AppointmentBookingDialogProps {
  children: React.ReactNode
  onBookingSuccess?: () => void
}








































// Generate available time slots based on business hours for selected date
const getAvailableTimeSlots = () => {
  if (!selectedDate || !businessSettings?.opening_hours) {
    return timeSlots // fallback to default slots
  }
  
  const dayOfWeek = selectedDate.getDay()
  const dayHours = businessSettings.opening_hours[dayOfWeek.toString()]
  
  if (!dayHours?.is_open) {
    return [] // No slots if closed
  }
  
  const startTime = dayHours.start_time
  const endTime = dayHours.end_time
  
  // Generate 30-minute slots between opening and closing
  const slots: string[] = []
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  let currentHour = startHour
  let currentMin = startMin
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`
    slots.push(timeSlot)
    
    // Add 30 minutes
    currentMin += 30
    if (currentMin >= 60) {
      currentMin = 0
      currentHour += 1
    }
  }
  
  return slots
}

const hairdressers = [
  {
    id: 'vanessa',
    name: 'Vanessa (Inhaberin)',
    specialty: 'Schnitt & Farbe',
    image: vanessaLogo,
    description:
      'Erfahrene Friseurin mit über 10 Jahren Berufserfahrung. Spezialisiert auf moderne Schnitte und Farbbehandlungen.'
  }
]

const services = [
  { id: 'cut', name: 'Haarschnitt', duration: '60 min', price: 'ab CHF 45' },
  { id: 'color', name: 'Färben', duration: '120 min', price: 'ab CHF 85' },
  { id: 'highlights', name: 'Strähnen', duration: '150 min', price: 'ab CHF 120' },
  { id: 'wash-blow', name: 'Waschen & Föhnen', duration: '45 min', price: 'ab CHF 35' },
  { id: 'treatment', name: 'Haarkur', duration: '30 min', price: 'ab CHF 25' }
]

export function AppointmentBookingDialog({
  children,
  onBookingSuccess
}: AppointmentBookingDialogProps) {
  const { user } = useAuth()
  
  // Default time slots for fallback
  const timeSlots = [
    '09:00','09:30','10:00','10:30','11:00','11:30',
    '12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30','18:00'
  ]
  
  // Load business settings for validation
  const { settings: businessSettings } = useBusinessSettings()
  const { validateAppointmentTime } = useAppointmentValidation()
  
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'gender' | 'haircut' | 'booking' | 'additional'>('gender')
  const [selectedGender, setSelectedGender] = useState<'women' | 'men' | null>(null)
  const [selectedHaircut, setSelectedHaircut] = useState<unknown>(null)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [selectedHairdresser, setSelectedHairdresser] = useState<string>()
  const [selectedService, setSelectedService] = useState<string>()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showHaircutDialog, setShowHaircutDialog] = useState(false)
  const [showAdditionalDialog, setShowAdditionalDialog] = useState(false)
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)

  // Calculate available dates based on business settings  
  const getAvailableDates = () => {
    if (!businessSettings?.max_advance_booking_days) return undefined
    
    const today = new Date()
    const maxDate = new Date()
    maxDate.setDate(today.getDate() + businessSettings.max_advance_booking_days)
    
    return {
      from: today,
      to: maxDate
    }
  }

  // Check if a date is available based on opening hours
  const isDateAvailable = (date: Date) => {
    if (!businessSettings?.opening_hours) return true
    
    const dayOfWeek = date.getDay()
    const dayHours = businessSettings.opening_hours[dayOfWeek.toString()]
    
    return dayHours?.is_open || false
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !isDateAvailable(date)) {
      toast({
        title: 'Geschlossen',
        description: 'An diesem Tag ist der Salon geschlossen.',
        variant: 'destructive'
      })
      return
    }
    
    setSelectedDate(date)
    if (date) setCalendarOpen(false)
  }

  const handleGenderSelect = (gender: 'women' | 'men') => {
    setSelectedGender(gender)
    setStep('haircut')
    setShowHaircutDialog(true)
  }

  const handleHaircutSelect = (haircutId: string, haircutData: unknown) => {
    setSelectedHaircut(haircutData)
    setShowHaircutDialog(false)
    setStep('booking')
  }

  const handleBookingRequest = () => {
    if (
      !selectedDate ||
      !selectedTime ||
      !selectedHairdresser ||
      !selectedHaircut
    ) {
      toast({
        title: 'Bitte alle Felder ausfüllen',
        description: 'Datum, Zeit, Friseur und Behandlung müssen ausgewählt werden.',
        variant: 'destructive'
      })
      return
    }

    setStep('additional')
    setShowAdditionalDialog(true)
  }

  const handleAdditionalServicesConfirm = async (additionalServices: unknown[]) => {
    if (!user) {
      toast({
        title: 'Anmeldung erforderlich',
        description: 'Bitte melden Sie sich an, um einen Termin zu buchen.',
        variant: 'destructive'
      })
      return
    }

    setSelectedAdditionalServices(additionalServices)
    setShowAdditionalDialog(false)
    setLoading(true)
    
    try {
      const additionalCost = additionalServices.reduce((sum, service) => 
        sum + parseInt(service.price.replace('CHF ', '')), 0
      )

      // Calculate appointment duration (base service + additional services)
      const baseDuration = parseInt(selectedHaircut.duration?.replace(' min', '') || '60')
      const additionalDuration = additionalServices.reduce((sum, service) => 
        sum + parseInt(service.duration?.replace(' min', '') || '0'), 0
      )
      const totalDuration = baseDuration + additionalDuration

      // Create starts_at and ends_at timestamps
      const [hours, minutes] = selectedTime!.split(':').map(Number)
      const startsAt = new Date(selectedDate!)
      startsAt.setHours(hours, minutes, 0, 0)
      
      const endsAt = new Date(startsAt)
      endsAt.setMinutes(endsAt.getMinutes() + totalDuration)

      // Validate appointment timing against business rules
      const validation = validateAppointmentTime(startsAt, endsAt)
      if (!validation.isValid) {
        toast({
          title: 'Ungültige Terminzeit',
          description: validation.error,
          variant: 'destructive'
        })
        setLoading(false)
        return
      }

      // Prepare appointment data
      const appointmentData = {
        user_id: user.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        service_type: selectedGender || 'women',
        service_name: selectedHaircut.name + (additionalServices.length > 0 ? ` + ${additionalServices.map(s => s.name).join(', ')}` : ''),
        hairdresser_name: hairdressers.find(h => h.id === selectedHairdresser)?.name || '',
        price: parseInt(selectedHaircut.price?.replace('ab CHF ', '') || '0') + additionalCost,
        status: 'pending' as const,
        notes: `Zusätzliche Services: ${additionalServices.map(s => s.name).join(', ')}`
      }

      // Create appointment in Supabase
      const { data, error } = await bookingHelpers.createAppointment(appointmentData)

      if (error) {
        console.error('Booking error:', error)
        
        // Check for duplicate booking constraint
        if (error.code === '23505') {
          toast({
            title: 'Termin bereits vergeben',
            description: 'Zu dieser Zeit ist bereits ein Termin gebucht. Bitte wählen Sie eine andere Zeit.',
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'Buchung fehlgeschlagen',
            description: error.message || 'Ein Fehler ist beim Buchen aufgetreten.',
            variant: 'destructive'
          })
        }
        return
      }

      // Success
      toast({
        title: 'Termin erfolgreich gebucht!',
        description: `Ihr Termin am ${format(selectedDate!, 'dd.MM.yyyy')} um ${selectedTime} bei ${appointmentData.hairdresser_name} wurde gebucht.`
      })

      // Reset all states
      resetBooking()
      setOpen(false)

      // Notify parent component of successful booking
      onBookingSuccess?.()

    } catch (error) {
      console.error('Unexpected booking error:', error)
      toast({
        title: 'Buchung fehlgeschlagen',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const resetBooking = () => {
    setStep('gender')
    setSelectedGender(null)
    setSelectedHaircut(null)
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setSelectedHairdresser(undefined)
    setSelectedService(undefined)
    setSelectedAdditionalServices([])
    setLoading(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetBooking()
      }}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Termin buchen</DialogTitle>
            <DialogDescription>
              {step === 'gender' && 'Wählen Sie zuerst die Art des Haarschnitts'}
              {step === 'haircut' && 'Wählen Sie Ihren gewünschten Haarschnitt'}
              {step === 'booking' && 'Wählen Sie Datum, Zeit und Friseur'}
              {step === 'additional' && 'Zusätzliche Leistungen auswählen'}
            </DialogDescription>
          </DialogHeader>

          {step === 'gender' && (
            <div className="space-y-4 py-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Für wen ist der Termin?</h3>
                <p className="text-sm text-muted-foreground">Wählen Sie die passende Kategorie</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className="cursor-pointer hover:shadow-soft transition-elegant border-2 hover:border-primary"
                  onClick={() => handleGenderSelect('women')}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4">
                      <div className="mx-auto w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
                        <Scissors className="h-8 w-8 text-pink-600" />
                      </div>
                    </div>
                    <CardTitle className="text-lg">Damenschnitt</CardTitle>
                    <CardDescription className="mt-2">
                      Individueller Schnitt mit Haarlängen-Auswahl
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-soft transition-elegant border-2 hover:border-primary"
                  onClick={() => handleGenderSelect('men')}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4">
                      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>
                    <CardTitle className="text-lg">Herrenschnitt</CardTitle>
                    <CardDescription className="mt-2">
                      Klassische und moderne Herrenfrisuren
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 'booking' && selectedHaircut && (
            <div className="space-y-6 py-2">
              {/* Selected Service Display */}
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{selectedHaircut.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedHaircut.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{selectedHaircut.price}</p>
                    <p className="text-xs text-muted-foreground">{selectedHaircut.duration}</p>
                  </div>
                </div>
              </div>

              {/* Datum */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Datum</label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !selectedDate && 'text-muted-foreground'
                      )}
                      onClick={() => setCalendarOpen(true)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate
                        ? format(selectedDate, 'dd.MM.yyyy', { locale: de })
                        : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        
                        // Disable past dates
                        if (date < today) return true
                        
                        // Disable dates beyond max advance booking
                        const availableDates = getAvailableDates()
                        if (availableDates && date > availableDates.to) return true
                        
                        // Disable closed days based on business hours
                        return !isDateAvailable(date)
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      locale={de}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Uhrzeit */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Uhrzeit</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Zeit wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTimeSlots().map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Friseur/Stylist */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Friseur/Stylist</label>
                <Select
                  value={selectedHairdresser}
                  onValueChange={setSelectedHairdresser}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          selectedHairdresser
                            ? hairdressers.find(h => h.id === selectedHairdresser)
                                ?.image
                            : hairdressers[0].image
                        }
                        alt={
                          selectedHairdresser
                            ? hairdressers.find(h => h.id === selectedHairdresser)
                                ?.name
                            : hairdressers[0].name
                        }
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      {selectedHairdresser ? (
                        <span>
                          {
                            hairdressers.find(h => h.id === selectedHairdresser)
                              ?.name
                          }
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Friseur wählen
                        </span>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {hairdressers.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        <div className="flex items-center gap-2">
                          <img
                            src={h.image}
                            alt={h.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <div className="flex flex-col">
                            <span>{h.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {h.specialty}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={resetBooking} className="flex-1">
                  Zurück
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !selectedDate ||
                    !selectedTime ||
                    !selectedHairdresser ||
                    loading
                  }
                  onClick={handleBookingRequest}
                >
                  {loading ? 'Buchung läuft...' : 'Termin buchen'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <HaircutLengthDialog
        isOpen={showHaircutDialog}
        onClose={() => setShowHaircutDialog(false)}
        onSelect={handleHaircutSelect}
        genderType={selectedGender || 'women'}
      />

      <AdditionalServicesDialog
        isOpen={showAdditionalDialog}
        onClose={() => setShowAdditionalDialog(false)}
        onConfirm={handleAdditionalServicesConfirm}
        genderType={selectedGender || 'women'}
      />
    </>
  )
}