import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  CalendarDays, 
  Grid3X3, 
  Layout,
  Eye,
  Edit
} from 'lucide-react';
import { AppointmentBookingDialog } from '@/components/booking/appointment-booking-dialog';

const mockAppointments = [
  {
    id: 1,
    date: '2024-01-16',
    time: '14:30',
    service: 'Damenschnitt + Coloring',
    stylist: 'Vanessa',
    duration: '120 min',
    price: 180,
    status: 'confirmed'
  },
  {
    id: 2,
    date: '2024-02-05',
    time: '10:00',
    service: 'Herrenschnitt',
    stylist: 'Marco',
    duration: '45 min',
    price: 45,
    status: 'pending'
  }
];

import { Appointment } from '@/lib/supabase';

interface CustomerCalendarViewProps {
  onAppointmentDetails: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
}

export function CustomerCalendarView({ onAppointmentDetails, onReschedule }: CustomerCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  const navigateDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    switch (viewType) {
      case 'day':
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'year':
        currentDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
        break;
    }
    setSelectedDate(currentDate);
  };

  const formatDateRange = () => {
    const date = new Date(selectedDate);
    switch (viewType) {
      case 'day':
        return date.toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      case 'month':
        return date.toLocaleDateString('de-CH', { year: 'numeric', month: 'long' });
      case 'year':
        return date.getFullYear().toString();
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleQuickBook = () => {
    setShowBookingDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Mein Terminkalender</h2>
          <p className="text-muted-foreground">Verwalten Sie Ihre Termine</p>
        </div>
        
        <div className="flex items-center gap-3">
          <AppointmentBookingDialog>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Neuer Termin
            </Button>
          </AppointmentBookingDialog>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kommende Termine</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Termine gesamt</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Letzter Besuch</p>
                <p className="text-sm font-bold">18.12.2023</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Period Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg">
              {[
                { value: 'day', icon: Calendar, label: 'Tag' },
                { value: 'week', icon: CalendarDays, label: 'Woche' },
                { value: 'month', icon: Grid3X3, label: 'Monat' },
                { value: 'year', icon: Layout, label: 'Jahr' }
              ].map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={viewType === value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewType(value as 'day' | 'week' | 'month' | 'year')}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
            
            <div className="text-center">
              <h3 className="font-semibold">{formatDateRange()}</h3>
              <p className="text-sm text-muted-foreground">{viewType.charAt(0).toUpperCase() + viewType.slice(1)}ansicht</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{viewType.charAt(0).toUpperCase() + viewType.slice(1)}übersicht - {formatDateRange()}</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 bg-primary/20 border border-primary/30 rounded"></div>
              Gebucht
              <div className="w-3 h-3 bg-background border border-dashed border-border rounded ml-4"></div>
              Verfügbar
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-8 gap-1">
            {/* Time Column */}
            <div className="space-y-2">
              <div className="h-12 flex items-center justify-center font-semibold text-sm bg-muted/30 rounded">
                Zeit
              </div>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="h-16 flex items-center justify-center text-sm text-muted-foreground border-r border-border/50">
                  {String(9 + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, dayIndex) => (
              <div key={day} className="space-y-2">
                <div className="h-12 flex items-center justify-center font-semibold bg-muted/50 rounded-lg border">
                  <div className="text-center">
                    <div className="text-sm font-medium">{day}</div>
                    <div className="text-xs text-muted-foreground">{15 + dayIndex}.01</div>
                  </div>
                </div>
                
                {/* Time Slots */}
                {Array.from({ length: 12 }, (_, timeIndex) => {
                  const hasAppointment = mockAppointments.find(apt => {
                    const aptDate = new Date(apt.date);
                    const aptHour = parseInt(apt.time.split(':')[0]);
                    return aptHour === 9 + timeIndex && dayIndex < 5; // Only weekdays have appointments
                  });
                  
                  return (
                    <div
                      key={timeIndex}
                      className={`h-16 rounded border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group relative ${
                        hasAppointment 
                          ? 'bg-primary/10 border-primary/30 border-solid hover:opacity-80' 
                          : 'bg-background border-border/30 hover:bg-muted/20'
                      }`}
                          onClick={() => {
                            if (hasAppointment) {
                              onAppointmentDetails(hasAppointment);
                            } else {
                              setShowBookingDialog(true);
                            }
                          }}
                    >
                      {hasAppointment ? (
                        <div className="p-2 h-full flex flex-col justify-center relative">
                          <div className="text-sm font-medium truncate">
                            Termin
                          </div>
                          <div className="text-xs opacity-70 truncate">
                            {hasAppointment.time}
                          </div>
                          
                          {/* Action buttons overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="h-6 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentDetails(hasAppointment);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="h-6 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onReschedule(hasAppointment);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                     ) : (
                       <div className="p-2 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                         <Plus className="w-4 h-4 text-primary" />
                       </div>
                     )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CustomerCalendarView;