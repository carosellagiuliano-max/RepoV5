import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  CalendarDays,
  Eye,
  CheckCircle,
  XCircle,
  Plus,
  Grid3X3,
  Layout,
  Scissors
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears, isSameDay, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { AppointmentBookingDialog } from '@/components/booking/appointment-booking-dialog';
import { toast } from 'sonner';

type ViewType = 'day' | 'week' | 'month' | 'year';

interface AppointmentSlot {
  id: string;
  time: string;
  available: boolean;
  stylist?: string;
  service?: string;
  duration?: string;
}

const EnhancedCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('week');
  const [activeTab, setActiveTab] = useState('calendar');
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  // Mock data for available/booked slots
  const getAppointmentsForDate = (date: Date): AppointmentSlot[] => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return []; // Sonntag geschlossen
    
    return [
      { id: '1', time: '09:00', available: true, stylist: 'Vanessa' },
      { id: '2', time: '09:30', available: false, stylist: 'Maria', service: 'Haarschnitt' },
      { id: '3', time: '10:00', available: true, stylist: 'Vanessa' },
      { id: '4', time: '10:30', available: true, stylist: 'Sarah' },
      { id: '5', time: '11:00', available: false, stylist: 'Vanessa', service: 'Färbung' },
      { id: '6', time: '11:30', available: true, stylist: 'Maria' },
      { id: '7', time: '14:00', available: true, stylist: 'Vanessa' },
      { id: '8', time: '14:30', available: false, stylist: 'Sarah', service: 'Styling' },
      { id: '9', time: '15:00', available: true, stylist: 'Maria' },
      { id: '10', time: '15:30', available: true, stylist: 'Vanessa' },
    ];
  };

  const handleBookSlot = (slot: AppointmentSlot, date: Date) => {
    console.log('Booking slot:', slot, 'for date:', date);
    setShowBookingDialog(true);
  };

  const handleQuickBook = () => {
    setShowBookingDialog(true);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    switch (viewType) {
      case 'day':
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1));
        break;
    }
  };

  const getDateTitle = () => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'PPPP', { locale: de });
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'dd.MM')} - ${format(weekEnd, 'dd.MM.yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: de });
      case 'year':
        return format(currentDate, 'yyyy');
      default:
        return '';
    }
  };

  const renderDayView = () => {
    const appointments = getAppointmentsForDate(currentDate);
    
    return (
      <div className="space-y-3">
        {appointments.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-lg">
            <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Geschlossen oder keine Termine verfügbar</p>
          </div>
        ) : (
          appointments.map((slot) => (
            <div 
              key={slot.id} 
              className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 hover-scale ${
                slot.available 
                  ? 'border-green-200 bg-green-50/50 hover:bg-green-50' 
                  : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-full ${slot.available ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Clock className={`h-4 w-4 ${slot.available ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-lg">{slot.time}</span>
                    <Badge 
                      variant={slot.available ? "default" : "secondary"}
                      className={slot.available ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                    >
                      {slot.available ? (
                        <><CheckCircle className="h-3 w-3 mr-1" />Verfügbar</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" />Belegt</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>Mit {slot.stylist}</span>
                    </div>
                    {slot.service && (
                      <span className="px-2 py-1 bg-muted rounded text-xs">{slot.service}</span>
                    )}
                  </div>
                </div>
              </div>
              {slot.available && (
                <Button 
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200"
                  onClick={() => handleBookSlot(slot, currentDate)}
                >
                  Jetzt buchen
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(currentDate, { weekStartsOn: 1 })
    });

    return (
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const appointments = getAppointmentsForDate(day);
          const availableCount = appointments.filter(a => a.available).length;
          const bookedCount = appointments.filter(a => !a.available).length;
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card 
              key={day.toISOString()} 
              className={`hover-scale transition-all duration-200 ${
                isToday ? 'ring-2 ring-primary bg-primary/5' : ''
              } ${day.getDay() === 0 ? 'opacity-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm text-center ${isToday ? 'text-primary' : ''}`}>
                  {format(day, 'EEE', { locale: de })}
                  <br />
                  <span className={`text-xl font-bold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {day.getDay() === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-4">
                    🚫 Geschlossen
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="text-center">
                        <Badge 
                          variant="default" 
                          className={`text-xs ${availableCount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {availableCount} frei
                        </Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          {bookedCount} belegt
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full text-xs h-8 hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                      onClick={() => {
                        setCurrentDate(day);
                        setViewType('day');
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Details anzeigen
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    // Get proper month calendar
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - monthStart.getDay() + 1); // Start from Monday
    
    const calendarDays = [];
    const currentDay = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      calendarDays.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return (
      <div className="space-y-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="text-center text-sm font-semibold p-3 text-muted-foreground bg-muted/20 rounded-lg">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            const appointments = getAppointmentsForDate(day);
            const availableCount = appointments.filter(a => a.available).length;
            const bookedCount = appointments.filter(a => !a.available).length;
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = isSameDay(day, new Date());
            const isClosed = day.getDay() === 0; // Sunday
            
            return (
              <Card
                key={index}
                className={`
                  h-24 cursor-pointer transition-all duration-200 hover-scale
                  ${isToday ? 'ring-2 ring-primary bg-primary/5' : ''}
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isClosed ? 'bg-gray-50' : ''}
                  ${availableCount > 0 && !isClosed ? 'hover:bg-green-50 border-green-200' : ''}
                `}
                onClick={() => {
                  if (isCurrentMonth && !isClosed) {
                    setCurrentDate(day);
                    setViewType('day');
                  }
                }}
              >
                <CardContent className="p-2 h-full flex flex-col">
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {isClosed ? (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Geschlossen</span>
                    </div>
                  ) : isCurrentMonth ? (
                    <div className="flex-1 space-y-1">
                      {availableCount > 0 && (
                        <div className="text-xs bg-green-100 text-green-800 px-1 rounded text-center">
                          {availableCount} frei
                        </div>
                      )}
                      {bookedCount > 0 && (
                        <div className="text-xs bg-gray-100 text-gray-800 px-1 rounded text-center">
                          {bookedCount} belegt
                        </div>
                      )}
                      {availableCount === 0 && bookedCount === 0 && (
                        <div className="text-xs text-gray-400 text-center">Keine Termine</div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex justify-center space-x-6 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span>Freie Termine</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
            <span>Belegt</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
            <span>Geschlossen</span>
          </div>
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1));
    
    return (
      <div className="grid grid-cols-3 gap-4">
        {months.map((month) => (
          <Button
            key={month.toISOString()}
            variant="outline"
            className="h-20 flex flex-col"
            onClick={() => {
              setCurrentDate(month);
              setViewType('month');
            }}
          >
            <span className="font-medium">{format(month, 'MMM', { locale: de })}</span>
            <span className="text-xs text-muted-foreground">Verfügbar</span>
          </Button>
        ))}
      </div>
    );
  };

  const renderCurrentView = () => {
    switch (viewType) {
      case 'day':
        return renderDayView();
      case 'week':
        return renderWeekView();
      case 'month':
        return renderMonthView();
      case 'year':
        return renderYearView();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Simple Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Terminkalender</h2>
          <p className="text-muted-foreground">Ihre Termine und freie Zeitslots</p>
        </div>
        
        <Button onClick={handleQuickBook} className="gap-2">
          <Plus className="w-4 h-4" />
          Neuer Termin
        </Button>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nächster Termin</p>
                <p className="text-sm font-bold">Morgen 14:30</p>
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
                <p className="text-sm text-muted-foreground">Freie Slots heute</p>
                <p className="text-2xl font-bold">3</p>
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
                <p className="text-sm text-muted-foreground">Bevorzugter Stylist</p>
                <p className="text-sm font-bold">Vanessa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Scissors className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Termine diesen Monat</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Calendar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Terminkalender
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {/* Time Period Selection */}
          <Card className="mb-4">
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
                      onClick={() => setViewType(value as any)}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Button>
                  ))}
                </div>
                
                <div className="text-center">
                  <h3 className="font-semibold">{getDateTitle()}</h3>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{viewType.charAt(0).toUpperCase() + viewType.slice(1)}übersicht - {getDateTitle()}</span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                  Verfügbar
                  <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded ml-4"></div>
                  Belegt
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {renderCurrentView()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AppointmentBookingDialog>
        <div />
      </AppointmentBookingDialog>
      {showBookingDialog && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setShowBookingDialog(false)}>
          <div className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
            <AppointmentBookingDialog>
              <Button onClick={() => setShowBookingDialog(false)} className="hidden" />
            </AppointmentBookingDialog>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCalendar;