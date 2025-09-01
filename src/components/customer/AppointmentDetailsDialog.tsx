import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  MapPin, 
  Phone, 
  Euro,
  FileText,
  Star,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AppointmentBookingDialog } from '@/components/booking/appointment-booking-dialog';

interface AppointmentDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  onReschedule: (appointment: any) => void;
}

const AppointmentDetailsDialog = ({ isOpen, onClose, appointment, onReschedule }: AppointmentDetailsDialogProps) => {
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  if (!appointment) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleRescheduleConfirm = () => {
    setShowRescheduleConfirm(false);
    onClose();
    setShowBookingDialog(true);
  };

  const handleReschedule = () => {
    setShowRescheduleConfirm(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Termindetails
            </DialogTitle>
            <DialogDescription>
              Vollständige Informationen zu Ihrem Termin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge className={`${getStatusColor(appointment.status)} px-4 py-2 text-sm font-medium flex items-center gap-2`}>
                {getStatusIcon(appointment.status)}
                {appointment.status === 'confirmed' ? 'Bestätigt' : 
                 appointment.status === 'pending' ? 'Ausstehend' : 'Storniert'}
              </Badge>
            </div>

            {/* Main Appointment Information */}
            <div className="grid gap-6">
              {/* Date & Time */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                  <Calendar className="w-4 h-4" />
                  Datum & Uhrzeit
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Datum:</span>
                    <span className="font-medium">{format(new Date(appointment.date), 'PPPP', { locale: de })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Uhrzeit:</span>
                    <span className="font-medium">{appointment.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Dauer:</span>
                    <span className="font-medium">{appointment.duration || '60 min'}</span>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Service Details
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="font-medium">{appointment.service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Kategorie:</span>
                    <span className="font-medium">{appointment.category || 'Haarschnitt'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Preis:</span>
                    <span className="font-medium text-primary">CHF {appointment.price}</span>
                  </div>
                </div>
              </div>

              {/* Stylist Information */}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Stylist
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{appointment.stylist}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Spezialisierung:</span>
                    <span className="font-medium">Schnitt & Farbe</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Bewertung:</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="text-sm ml-1">(4.9)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Salon Information
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Salon:</span>
                    <span className="font-medium">Schnittwerk</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Adresse:</span>
                    <span className="font-medium">Musterstrasse 123, 8001 Zürich</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-medium">+41 44 123 45 67</span>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              {appointment.notes && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-800">
                    <FileText className="w-4 h-4" />
                    Notizen
                  </h4>
                  <p className="text-sm text-blue-700">{appointment.notes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Schließen
              </Button>
              <Button onClick={handleReschedule} className="flex-1">
                <Clock className="w-4 h-4 mr-2" />
                Verschieben
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Confirmation Dialog */}
      <AlertDialog open={showRescheduleConfirm} onOpenChange={setShowRescheduleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Termin verschieben?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie den Termin am {format(new Date(appointment.date), 'dd.MM.yyyy', { locale: de })} um {appointment.time} verschieben möchten? 
              Der aktuelle Termin wird storniert und Sie können einen neuen Termin buchen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nein, behalten</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRescheduleConfirm}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ja, verschieben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Booking Dialog for Rescheduling */}
      {showBookingDialog && (
        <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <AppointmentBookingDialog>
              <div />
            </AppointmentBookingDialog>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AppointmentDetailsDialog;