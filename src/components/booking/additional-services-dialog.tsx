import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles } from 'lucide-react';

interface AdditionalServicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedServices: any[]) => void;
  genderType: 'women' | 'men';
}

const womenAdditionalServices = [
  {
    id: 'eyebrow-pluck',
    name: 'Augenbrauen zupfen',
    description: 'Professionelle Augenbrauenformung',
    price: 'CHF 25',
    duration: '20 min'
  },
  {
    id: 'eyebrow-color',
    name: 'Augenbrauen färben',
    description: 'Natürliche Augenbrauenfarbe',
    price: 'CHF 20',
    duration: '15 min'
  },
  {
    id: 'lash-lifting',
    name: 'Wimpern Lifting',
    description: 'Natürlicher Wimpernaufschlag',
    price: 'CHF 45',
    duration: '45 min'
  },
  {
    id: 'lash-color',
    name: 'Wimpern färben',
    description: 'Intensive Wimpernfarbe',
    price: 'CHF 15',
    duration: '15 min'
  }
];

const menAdditionalServices = [
  {
    id: 'eyebrow-pluck',
    name: 'Augenbrauen zupfen',
    description: 'Gepflegte Augenbrauenform',
    price: 'CHF 20',
    duration: '15 min'
  },
  {
    id: 'beard-wax',
    name: 'Bart wachsen',
    description: 'Professionelle Bartwachsbehandlung',
    price: 'CHF 30',
    duration: '30 min'
  },
  {
    id: 'beard-color',
    name: 'Bart färben',
    description: 'Natürliche Bartfarbe',
    price: 'CHF 35',
    duration: '25 min'
  },
  {
    id: 'beard-trim',
    name: 'Bart trimmen',
    description: 'Professionelle Bartpflege',
    price: 'CHF 25',
    duration: '20 min'
  }
];

export function AdditionalServicesDialog({ isOpen, onClose, onConfirm, genderType }: AdditionalServicesDialogProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  const availableServices = genderType === 'women' ? womenAdditionalServices : menAdditionalServices;
  const title = genderType === 'women' ? 'Zusätzliche Leistungen für Damen' : 'Zusätzliche Leistungen für Herren';

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleConfirm = () => {
    const selected = availableServices.filter(service => 
      selectedServices.includes(service.id)
    );
    onConfirm(selected);
    setSelectedServices([]);
    onClose();
  };

  const totalPrice = availableServices
    .filter(service => selectedServices.includes(service.id))
    .reduce((sum, service) => sum + parseInt(service.price.replace('CHF ', '')), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Wählen Sie zusätzliche Behandlungen zu Ihrem Haarschnitt
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6">
          {availableServices.map((service) => (
            <Card 
              key={service.id} 
              className={`border-border transition-elegant cursor-pointer ${
                selectedServices.includes(service.id) ? 'bg-primary/5 border-primary' : ''
              }`}
              onClick={() => handleServiceToggle(service.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox 
                    checked={selectedServices.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      <Badge variant="secondary">{service.price}</Badge>
                    </div>
                    <CardDescription className="text-sm">{service.description}</CardDescription>
                    <p className="text-xs text-muted-foreground">{service.duration}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedServices.length > 0 && (
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="font-medium">Zusätzliche Kosten:</span>
              <span className="font-bold text-lg">CHF {totalPrice}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Überspringen
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Termin buchen {selectedServices.length > 0 && `(+CHF ${totalPrice})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdditionalServicesDialog;