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
import { Scissors } from 'lucide-react';

interface HaircutLengthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (length: string, service: any) => void;
  genderType: 'women' | 'men';
}

const womenHaircutLengths = [
  {
    id: 'short',
    name: 'Kurze Haare',
    description: 'Bis zum Kinn',
    price: 'ab CHF 65',
    duration: '60 min',
    image: '/lovable-uploads/649dd588-36e8-40e1-8a4f-aad980227833.png'
  },
  {
    id: 'medium',
    name: 'Mittlere Haare',
    description: 'Bis zur Schulter',
    price: 'ab CHF 75',
    duration: '75 min',
    image: '/lovable-uploads/a3a940fe-fcd9-42f4-b927-3990a05935a2.png'
  },
  {
    id: 'long',
    name: 'Lange Haare',
    description: 'Länger als Schultern',
    price: 'ab CHF 85',
    duration: '90 min',
    image: '/lovable-uploads/81accc89-bea5-48c6-85a8-37d7383b67dd.png'
  }
];

const menHaircuts = [
  {
    id: 'classic',
    name: 'Klassischer Herrenschnitt',
    description: 'Zeitloser Business-Look',
    price: 'ab CHF 45',
    duration: '45 min',
    image: '/lovable-uploads/68112270-fe51-4780-9c52-5674b8425057.png'
  },
  {
    id: 'modern',
    name: 'Modern Fade',
    description: 'Trendy Übergänge mit Styling',
    price: 'ab CHF 55',
    duration: '60 min',
    image: '/lovable-uploads/43b745a4-5725-45a9-89e2-bdb8c914d3e6.png'
  },
  {
    id: 'complete',
    name: 'Komplett-Service',
    description: 'Schnitt + Bart + Styling',
    price: 'ab CHF 75',
    duration: '90 min',
    image: '/lovable-uploads/97af9a7c-ff67-464d-9d9c-6f78d27f6471.png'
  }
];

export function HaircutLengthDialog({ isOpen, onClose, onSelect, genderType }: HaircutLengthDialogProps) {
  const haircutOptions = genderType === 'women' ? womenHaircutLengths : menHaircuts;
  const title = genderType === 'women' ? 'Damenschnitt - Haarlänge wählen' : 'Herrenschnitt wählen';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {genderType === 'women' 
              ? 'Wählen Sie Ihre Haarlänge für den passenden Preis' 
              : 'Wählen Sie Ihren gewünschten Herrenschnitt'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 mt-6">
          {haircutOptions.map((option) => (
            <Card 
              key={option.id} 
              className="border-border hover:shadow-soft transition-elegant cursor-pointer"
              onClick={() => onSelect(option.id, option)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={option.image} 
                      alt={option.name}
                      className="w-24 h-24 object-cover rounded-md border border-border"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{option.name}</CardTitle>
                      <Badge variant="secondary">{option.price}</Badge>
                    </div>
                    <CardDescription className="text-sm">{option.description}</CardDescription>
                    <p className="text-sm text-muted-foreground">{option.duration}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            {genderType === 'women' 
              ? 'Die Preise variieren je nach Haarlänge und Aufwand. Finale Preise werden nach persönlicher Beratung festgelegt.'
              : 'Alle Preise sind Richtpreise. Der finale Preis wird nach persönlicher Beratung festgelegt.'
            }
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HaircutLengthDialog;