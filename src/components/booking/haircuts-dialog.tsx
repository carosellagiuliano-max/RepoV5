import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scissors, Users } from 'lucide-react';

interface HaircutsDialogProps {
  children: React.ReactNode;
}

const menHaircuts = [
  { name: 'Klassischer Herrenschnitt', price: 'ab CHF 45', duration: '45 min', description: 'Zeitloser Business-Look' },
  { name: 'Modern Fade', price: 'ab CHF 55', duration: '60 min', description: 'Trendy Übergänge mit Styling' },
  { name: 'Bart trimmen', price: 'ab CHF 25', duration: '30 min', description: 'Professionelle Bartpflege' },
  { name: 'Komplett-Service', price: 'ab CHF 75', duration: '90 min', description: 'Schnitt + Bart + Styling' }
];

const womenHaircuts = [
  { name: 'Damenschnitt', price: 'ab CHF 65', duration: '60 min', description: 'Individueller Schnitt nach Wunsch' },
  { name: 'Bob & Lob', price: 'ab CHF 70', duration: '75 min', description: 'Moderne Bob-Variationen' },
  { name: 'Stufen & Layers', price: 'ab CHF 75', duration: '90 min', description: 'Volumen und Bewegung' },
  { name: 'Langhaarschnitt', price: 'ab CHF 80', duration: '90 min', description: 'Perfekte Form für langes Haar' },
  { name: 'Pony schneiden', price: 'ab CHF 30', duration: '30 min', description: 'Frischer Pony-Look' }
];

export function HaircutsDialog({ children }: HaircutsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Haarschnitte für Damen & Herren
          </DialogTitle>
          <DialogDescription>
            Professionelle Haarschnitte individuell angepasst an Ihre Wünsche
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Damen */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Users className="h-5 w-5 text-pink-600" />
              </div>
              <h3 className="text-xl font-heading font-semibold">Damen</h3>
            </div>
            <div className="space-y-3">
              {womenHaircuts.map((cut, index) => (
                <Card key={index} className="border-border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{cut.name}</CardTitle>
                      <Badge variant="secondary">{cut.price}</Badge>
                    </div>
                    <CardDescription className="text-sm">{cut.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{cut.duration}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Herren */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-heading font-semibold">Herren</h3>
            </div>
            <div className="space-y-3">
              {menHaircuts.map((cut, index) => (
                <Card key={index} className="border-border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{cut.name}</CardTitle>
                      <Badge variant="secondary">{cut.price}</Badge>
                    </div>
                    <CardDescription className="text-sm">{cut.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{cut.duration}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Alle Preise sind Richtpreise. Der finale Preis wird nach persönlicher Beratung festgelegt.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HaircutsDialog;