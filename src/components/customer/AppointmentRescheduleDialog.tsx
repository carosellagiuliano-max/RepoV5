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
import { Calendar, CalendarIcon, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { AppointmentBookingDialog } from '@/components/booking/appointment-booking-dialog';
import { Appointment } from '@/lib/supabase';

interface AppointmentRescheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
}

const AppointmentRescheduleDialog = ({ isOpen, onClose, appointment }: AppointmentRescheduleDialogProps) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  const handleCancel = () => {
    toast.success('Termin wurde erfolgreich storniert');
    setShowCancelConfirm(false);
    onClose();
  };

  const handleRescheduleConfirm = () => {
    setShowRescheduleConfirm(false);
    onClose();
    setShowBookingDialog(true);
  };

  const handleReschedule = () => {
    setShowRescheduleConfirm(true);
  };

  if (!appointment) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Termin verwalten
            </DialogTitle>
            <DialogDescription>
              Möchten Sie Ihren Termin verschieben oder absagen?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Appointment Details */}
            <div className="p-4 bg-muted/20 rounded-lg border">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Aktueller Termin
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Datum:</span>
                  <span className="font-medium">{format(new Date(appointment.date), 'PPPP', { locale: de })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zeit:</span>
                  <span className="font-medium">{appointment.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium">{appointment.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stylist:</span>
                  <span className="font-medium">{appointment.stylist}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleReschedule}
                className="w-full"
              >
                <Clock className="w-4 h-4 mr-2" />
                Verschieben
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                className="w-full"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Absagen
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Bei einer Terminverschiebung wird der aktuelle Termin automatisch storniert und Sie können einen neuen Termin buchen.
            </p>
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Termin wirklich absagen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie den Termin am {format(new Date(appointment.date), 'dd.MM.yyyy', { locale: de })} um {appointment.time} absagen möchten? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nein, behalten</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ja, absagen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Booking Dialog */}
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

export default AppointmentRescheduleDialog;