import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Users, Clock, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import transformationImage from '@/assets/hair-transformation.jpg';
import ProductsDialog from '@/components/booking/products-dialog';
import HaircutsDialog from '@/components/booking/haircuts-dialog';
import VanessaProfileDialog from '@/components/booking/vanessa-profile-dialog';

const About = () => {
  const highlights = [
    {
      icon: Award,
      title: 'Premium Qualität',
      description: 'Hochwertige Trinity Haircare Produkte für beste Ergebnisse'
    },
    {
      icon: Users,
      title: 'Erfahrenes Team',
      description: 'Professionelle Coiffeure mit langjähriger Erfahrung'
    },
    {
      icon: Clock,
      title: 'Flexible Termine',
      description: 'Online-Buchung und individuelle Terminvereinbarung'
    },
    {
      icon: Heart,
      title: 'Persönlicher Service',
      description: 'Individuelle Beratung für Ihren perfekten Look'
    }
  ];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-6">
                Willkommen im Schnittwerk
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Im Herzen von St. Gallen, im modernen Silberturm, finden Sie unser elegantes 
                Hairstudio. Wir sind spezialisiert auf individuelle Haarschnitte, moderne 
                Colorationen und professionelle Beauty-Behandlungen.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Unser erfahrenes Team arbeitet ausschließlich mit hochwertigen Trinity Haircare 
                Produkten und modernsten Techniken, um Ihnen den perfekten Look zu verleihen.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-heading font-semibold text-primary">
                Was uns auszeichnet
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {highlights.map((highlight, index) => (
                  <Card key={index} className="border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
                          <highlight.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">
                            {highlight.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {highlight.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-elegant">
              <img 
                src={transformationImage} 
                alt="Professionelle Haartransformation im Schnittwerk"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"></div>
              
              {/* Floating Stats */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/95 backdrop-blur-md rounded-lg p-6 border border-white/20">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-heading font-bold text-primary">10+</div>
                      <div className="text-sm text-muted-foreground">Jahre Erfahrung</div>
                    </div>
                    <div>
                      <div className="text-2xl font-heading font-bold text-primary">500+</div>
                      <div className="text-sm text-muted-foreground">Zufriedene Kunden</div>
                    </div>
                    <div>
                      <div className="text-2xl font-heading font-bold text-primary">100%</div>
                      <div className="text-sm text-muted-foreground">Trinity Haircare</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;