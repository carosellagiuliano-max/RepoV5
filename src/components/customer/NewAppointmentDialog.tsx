import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Clock, Scissors, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const NewAppointmentDialog = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedStylist, setSelectedStylist] = useState('');
  const [notes, setNotes] = useState('');

  const availableTimes = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  const services = [
    { id: 'haarschnitt', name: 'Haarschnitt', duration: '45 Min', price: '65€' },
    { id: 'haarschnitt-waschen', name: 'Haarschnitt + Waschen', duration: '60 Min', price: '75€' },
    { id: 'faerbung', name: 'Färbung', duration: '120 Min', price: '120€' },
    { id: 'straehnen', name: 'Strähnchen', duration: '150 Min', price: '140€' },
    { id: 'styling', name: 'Styling', duration: '30 Min', price: '45€' },
    { id: 'behandlung', name: 'Haarkur', duration: '45 Min', price: '55€' }
  ];

  const stylists = [
    { id: 'vanessa', name: 'Vanessa (Inhaberin)', available: true },
    { id: 'maria', name: 'Maria', available: true },
    { id: 'sarah', name: 'Sarah', available: false }
  ];

  const handleBookAppointment = () => {
    console.log('Booking appointment:', {
      date: selectedDate,
      time: selectedTime,
      service: selectedService,
      stylist: selectedStylist,
      notes
    });
    alert('Termin wurde erfolgreich gebucht!');
  };

  const getSelectedService = () => {
    return services.find(s => s.id === selectedService);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Neuen Termin buchen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-primary flex items-center">
            <Scissors className="h-6 w-6 mr-2" />
            Neuen Termin buchen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Service auswählen</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie einen Service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex justify-between items-center w-full">
                      <span>{service.name}</span>
                      <span className="text-sm text-muted-foreground ml-4">
                        {service.duration} • {service.price}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getSelectedService() && (
              <div className="text-sm text-muted-foreground">
                Dauer: {getSelectedService()?.duration} • Preis: {getSelectedService()?.price}
              </div>
            )}
          </div>

          {/* Stylist Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Stylist auswählen</Label>
            <Select value={selectedStylist} onValueChange={setSelectedStylist}>
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie einen Stylist" />
              </SelectTrigger>
              <SelectContent>
                {stylists.map((stylist) => (
                  <SelectItem 
                    key={stylist.id} 
                    value={stylist.id}
                    disabled={!stylist.available}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{stylist.name}</span>
                      {!stylist.available && (
                        <span className="text-xs text-red-500 ml-2">Nicht verfügbar</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Datum auswählen</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPPP", { locale: de })
                  ) : (
                    "Datum auswählen"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Uhrzeit auswählen</Label>
              <div className="grid grid-cols-4 gap-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                    className="text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Besondere Wünsche (optional)</Label>
            <Textarea
              placeholder="Beschreiben Sie Ihre Wünsche oder besondere Anmerkungen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Summary */}
          {selectedService && selectedDate && selectedTime && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Terminübersicht:</h4>
              <div className="text-sm space-y-1">
                <div>Service: {getSelectedService()?.name}</div>
                <div>Datum: {format(selectedDate, "PPPP", { locale: de })}</div>
                <div>Uhrzeit: {selectedTime}</div>
                {selectedStylist && (
                  <div>Stylist: {stylists.find(s => s.id === selectedStylist)?.name}</div>
                )}
                <div className="font-semibold pt-2 border-t">
                  Gesamtpreis: {getSelectedService()?.price}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button 
              onClick={handleBookAppointment}
              className="flex-1"
              disabled={!selectedService || !selectedDate || !selectedTime || !selectedStylist}
            >
              Termin buchen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewAppointmentDialog;