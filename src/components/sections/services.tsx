import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scissors, Palette, Eye, Sparkles, ShoppingBag, Calendar } from 'lucide-react';
import servicesImage from '@/assets/salon-services.jpg';
import ProductsDialog from '@/components/booking/products-dialog';
import AuthDialog from '@/components/auth/AuthDialog';

const Services = () => {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const services = [
    {
      icon: Scissors,
      title: 'Haarschnitte',
      description: 'Moderne Schnitte für Damen und Herren, individuell angepasst an Ihren Typ',
      features: ['Beratung & Analyse', 'Waschen & Schneiden', 'Styling & Finish'],
      price: 'ab CHF 65'
    },
    {
      icon: Palette,
      title: 'Colorationen',
      description: 'Professionelle Haarfarbe mit hochwertigen Trinity Haircare Produkten',
      features: ['Farbberatung', 'Vollcoloration', 'Ansatzbehandlung'],
      price: 'ab CHF 85'
    },
    {
      icon: Sparkles,
      title: 'Balayage',
      description: 'Natürliche Highlights für einen sun-kissed Look das ganze Jahr über',
      features: ['Freihändige Technik', 'Natürlicher Farbverlauf', 'Toning'],
      price: 'ab CHF 120'
    },
    {
      icon: Eye,
      title: 'Wimpern & Brauen',
      description: 'Perfekte Augenpartie durch professionelle Wimpern- und Augenbrauenbehandlung',
      features: ['Wimpern färben', 'Brauen zupfen', 'Brauen färben'],
      price: 'ab CHF 25'
    }
  ];

  return (
    <section id="services" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-4">
            Unsere Leistungen
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Professionelle Haarpflege und Beauty-Behandlungen mit hochwertigen Trinity Haircare Produkten
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services.map((service, index) => (
                <Card key={index} className="border-border bg-card hover:shadow-soft transition-elegant">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-secondary rounded-lg">
                        <service.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg font-heading">{service.title}</CardTitle>
                        <Badge variant="secondary" className="text-sm font-medium">
                          {service.price}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-sm text-muted-foreground">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <div className="relative">
            <img 
              src={servicesImage} 
              alt="Professionelle Haarbehandlungen im Schnittwerk Salon"
              className="rounded-lg shadow-elegant w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-lg"></div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground mb-6">
            Alle Preise verstehen sich als Richtpreise. Der finale Preis wird nach der persönlichen Beratung festgelegt.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Badge variant="outline" className="text-sm">Trinity Haircare Premium Produkte</Badge>
            <Badge variant="outline" className="text-sm">Professionelle Beratung inklusive</Badge>
            <Badge variant="outline" className="text-sm">Moderne Techniken</Badge>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setShowAuthDialog(true)}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Termin buchen
            </Button>
            <ProductsDialog>
              <Button className="bg-white text-black hover:bg-white/90 border border-gray-300">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Produkte
              </Button>
            </ProductsDialog>
          </div>
        </div>
      </div>

      <AuthDialog 
        isOpen={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)} 
      />
    </section>
  );
};

export default Services;