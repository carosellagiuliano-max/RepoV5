import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LocationDialogProps {
  children: React.ReactNode;
}

const LocationDialog = ({ children }: LocationDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-primary">
            Standort - Schnittwerk
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium">Bahnhofstrasse 16</p>
            <p className="text-lg font-medium">9000 St. Gallen</p>
            <p className="text-muted-foreground mt-2">
              Direkt beim Hauptbahnhof St. Gallen
            </p>
          </div>
          
          <div className="w-full h-96 rounded-lg overflow-hidden border border-border">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2712.5!2d9.3767!3d47.4233!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x479b0b0b0b0b0b0b%3A0x0!2sBarhnhofstrasse%2016%2C%209000%20St.%20Gallen!5e0!3m2!1sde!2sch!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Schnittwerk Standort"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationDialog;