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
import HaircutLengthDialog from './haircut-length-dialog'
import AdditionalServicesDialog from './additional-services-dialog'

// Using existing team owner image for Vanessa
import vanessaLogo from '@/assets/team-owner.jpg'

interface AppointmentBookingDialogProps {
  children: React.ReactNode
}

const timeSlots = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00'
]

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
  children
}: AppointmentBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'gender' | 'haircut' | 'booking' | 'additional'>('gender')
  const [selectedGender, setSelectedGender] = useState<'women' | 'men' | null>(null)
  const [selectedHaircut, setSelectedHaircut] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [selectedHairdresser, setSelectedHairdresser] = useState<string>()
  const [selectedService, setSelectedService] = useState<string>()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showHaircutDialog, setShowHaircutDialog] = useState(false)
  const [showAdditionalDialog, setShowAdditionalDialog] = useState(false)
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<any[]>([])

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) setCalendarOpen(false)
  }

  const handleGenderSelect = (gender: 'women' | 'men') => {
    setSelectedGender(gender)
    setStep('haircut')
    setShowHaircutDialog(true)
  }

  const handleHaircutSelect = (haircutId: string, haircutData: any) => {
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

  const handleAdditionalServicesConfirm = (additionalServices: any[]) => {
    setSelectedAdditionalServices(additionalServices)
    setShowAdditionalDialog(false)
    
    const additionalCost = additionalServices.reduce((sum, service) => 
      sum + parseInt(service.price.replace('CHF ', '')), 0
    )

    const bookingDetails = {
      date: format(selectedDate!, 'dd.MM.yyyy'),
      time: selectedTime,
      hairdresser: hairdressers.find(h => h.id === selectedHairdresser)?.name ?? '',
      haircut: selectedHaircut?.name ?? '',
      additionalServices: additionalServices.map(s => s.name).join(', '),
      totalAdditionalCost: additionalCost
    }

    toast({
      title: 'Termin erfolgreich gebucht!',
      description: `Ihr Termin am ${bookingDetails.date} um ${bookingDetails.time} bei ${bookingDetails.hairdresser} wurde gebucht.`
    })

    // Reset all states
    setStep('gender')
    setSelectedGender(null)
    setSelectedHaircut(null)
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setSelectedHairdresser(undefined)
    setSelectedService(undefined)
    setSelectedAdditionalServices([])
    setOpen(false)
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
                      disabled={date => date < new Date() || date.getDay() === 0}
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
                    {timeSlots.map(time => (
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
                    !selectedHairdresser
                  }
                  onClick={handleBookingRequest}
                >
                  Termin buchen
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