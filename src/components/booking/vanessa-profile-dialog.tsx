import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Heart, Users, Sparkles } from 'lucide-react';
import ownerImage from '@/assets/team-owner.jpg';

interface VanessaProfileDialogProps {
  children: React.ReactNode;
}

export function VanessaProfileDialog({ children }: VanessaProfileDialogProps) {
  const expertise = [
    { icon: Award, title: '8+ Jahre Erfahrung', description: 'Langjährige Expertise im Coiffeur-Handwerk' },
    { icon: Heart, title: 'Leidenschaft für Perfektion', description: 'Jeder Schnitt wird mit Liebe zum Detail ausgeführt' },
    { icon: Users, title: 'Individuelle Beratung', description: 'Persönliche Betreuung für jeden Kundentyp' },
    { icon: Sparkles, title: 'Moderne Techniken', description: 'Neueste Trends und bewährte Klassiker' }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Vanessa Carosella - Inhaberin & Master Stylistin
          </DialogTitle>
          <DialogDescription>
            Moderne Techniken und persönliche Betreuung für Ihren perfekten Look
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-1/3">
              <img 
                src={ownerImage} 
                alt="Vanessa Carosella - Inhaberin Schnittwerk"
                className="w-full rounded-lg shadow-soft"
              />
            </div>
            
            <div className="w-full md:w-2/3 space-y-4">
              <div>
                <h3 className="text-2xl font-heading font-bold text-primary mb-2">
                  Über Vanessa
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Mit über 8 Jahren Leidenschaft im Coiffeur-Handwerk bringe ich moderne Techniken 
                  und zeitlose Eleganz zusammen. Was ich an diesem Beruf am meisten liebe, ist die 
                  Möglichkeit, jedem Kunden zu seinem individuellen Traumlook zu verhelfen.
                </p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-foreground mb-2">Meine Philosophie</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Jeder Kunde ist einzigartig - und so sollte auch sein Haarschnitt sein. Durch 
                  ausführliche Beratungsgespräche verstehe ich Ihre Wünsche und Ihren Lifestyle, 
                  um den perfekten Look zu kreieren, der zu Ihnen passt und sich leicht stylen lässt.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary text-primary-foreground">Trinity Haircare Expertin</Badge>
                <Badge variant="outline">Balayage Spezialistin</Badge>
                <Badge variant="outline">Schnitt-Expertin</Badge>
                <Badge variant="outline">Farbberatung</Badge>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-foreground mb-4">Expertise & Techniken</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expertise.map((item, index) => (
                <Card key={index} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-semibold text-foreground mb-1">{item.title}</h5>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="bg-secondary/30 rounded-lg p-6">
            <h4 className="font-semibold text-foreground mb-2">Warum Schnittwerk?</h4>
            <p className="text-muted-foreground leading-relaxed">
              "Im Schnittwerk vereinen wir Tradition mit Innovation. Durch kontinuitive Weiterbildung 
              und den Einsatz hochwertiger Trinity Haircare Produkte garantiere ich Ihnen nicht nur 
              einen wunderschönen Look, sondern auch die bestmögliche Pflege für Ihr Haar. Jeder 
              Besuch bei uns soll ein Erlebnis sein, bei dem Sie sich wohlfühlen und mit einem 
              Lächeln nach Hause gehen."
            </p>
            <p className="text-sm text-primary font-medium mt-3">- Vanessa Carosella, Inhaberin</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VanessaProfileDialog;