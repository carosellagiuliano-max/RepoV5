import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Clock } from 'lucide-react';

interface OpeningHoursDialogProps {
  children: React.ReactNode;
}

const OpeningHoursDialog = ({ children }: OpeningHoursDialogProps) => {
  const openingHours = [
    { day: 'Montag', hours: '09:00 - 18:30', isOpen: true },
    { day: 'Dienstag', hours: '09:00 - 18:30', isOpen: true },
    { day: 'Mittwoch', hours: 'Geschlossen', isOpen: false },
    { day: 'Donnerstag', hours: '09:00 - 18:30', isOpen: true },
    { day: 'Freitag', hours: '09:00 - 18:30', isOpen: true },
    { day: 'Samstag', hours: '09:00 - 15:00', isOpen: true },
    { day: 'Sonntag', hours: 'Geschlossen', isOpen: false }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-primary flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Öffnungszeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            {openingHours.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
                <span className="font-medium text-foreground">{item.day}</span>
                <span className={`font-medium ${item.isOpen ? 'text-primary' : 'text-muted-foreground'}`}>
                  {item.hours}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Termine sind auch außerhalb der Öffnungszeiten nach Vereinbarung möglich.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpeningHoursDialog;