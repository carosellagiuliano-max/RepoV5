import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, Eye } from 'lucide-react';
import Navigation from '@/components/ui/navigation';
import gallery1 from '@/assets/gallery-1.jpg';
import gallery2 from '@/assets/gallery-2.jpg';
import gallery3 from '@/assets/gallery-3.jpg';

const Gallery = () => {
  const [selectedCategory, setSelectedCategory] = useState('alle');

  const galleryItems = [
    {
      id: 1,
      image: gallery1,
      title: 'Balayage Transformation Frau',
      category: 'haarschnitt-frauen',
      gender: 'frauen',
      description: 'Natürliche Highlights für einen sun-kissed Look',
      before: 'Dunkelbraunes Haar',
      after: 'Warme Balayage Highlights'
    },
    {
      id: 2,
      image: gallery2,
      title: 'Ombré Coloration',
      category: 'colors',
      gender: 'frauen',
      description: 'Sanfter Farbverlauf von dunkel zu hell',
      before: 'Einfarbig braun',
      after: 'Ombré Blond-Braun'
    },
    {
      id: 3,
      image: gallery3,
      title: 'Moderner Herrenschnitt',
      category: 'haarschnitt-maenner',
      gender: 'maenner',
      description: 'Zeitgemäßer Cut mit perfektem Styling',
      before: 'Lange, ungepflegte Haare',
      after: 'Moderner, strukturierter Schnitt'
    },
    {
      id: 4,
      image: gallery1,
      title: 'Komplette Typveränderung',
      category: 'colors',
      gender: 'frauen',
      description: 'Von dunkel zu strahlendem Blond',
      before: 'Dunkelbraune Grundfarbe',
      after: 'Platinblonde Traumfarbe'
    },
    {
      id: 5,
      image: gallery2,
      title: 'Eleganter Damenschnitt',
      category: 'haarschnitt-frauen',
      gender: 'frauen',
      description: 'Moderner Bob mit perfekten Konturen',
      before: 'Lange, schwere Haare',
      after: 'Frischer, eleganter Bob'
    },
    {
      id: 6,
      image: gallery3,
      title: 'Business Look Mann',
      category: 'haarschnitt-maenner',
      gender: 'maenner',
      description: 'Professioneller Herrenschnitt',
      before: 'Unordentliche Frisur',
      after: 'Gepflegter Business-Look'
    },
    {
      id: 7,
      image: gallery1,
      title: 'Herren Color Transformation',
      category: 'colors',
      gender: 'maenner',
      description: 'Natürliche Grauabdeckung mit modernen Akzenten',
      before: 'Graue Ansätze',
      after: 'Natürlich wirkende Farbe'
    },
    {
      id: 8,
      image: gallery2,
      title: 'Undercut Styling',
      category: 'haarschnitt-maenner',
      gender: 'maenner',
      description: 'Moderner Undercut mit Übergang',
      before: 'Alte Frisur',
      after: 'Stylischer Undercut'
    },
    {
      id: 9,
      image: gallery1,
      title: 'Perfekte Wimpern',
      category: 'beauty',
      gender: 'frauen',
      description: 'Wimpernextensions für natürliche Fülle',
      before: 'Kurze, dünne Wimpern',
      after: 'Voluminöse, natürliche Extensions'
    },
    {
      id: 10,
      image: gallery2,
      title: 'Augenbrauen Styling',
      category: 'beauty',
      gender: 'frauen',
      description: 'Perfekt geformte Augenbrauen',
      before: 'Ungepflegte Brauen',
      after: 'Professionell geformte Brauen'
    },
    {
      id: 11,
      image: gallery3,
      title: 'Wimpern Lifting',
      category: 'beauty',
      gender: 'frauen',
      description: 'Natürliche Wimpernverlängerung ohne Extensions',
      before: 'Gerade, kurze Wimpern',
      after: 'Geschwungene, voluminöse Wimpern'
    }
  ];

  const categories = [
    { id: 'alle', label: 'Alle Arbeiten' },
    { id: 'haarschnitt-maenner', label: 'Haarschnitt Männer' },
    { id: 'haarschnitt-frauen', label: 'Haarschnitt Frauen' },
    { id: 'colors', label: 'Colors' },
    { id: 'beauty', label: 'Beauty' }
  ];

  const filteredItems = selectedCategory === 'alle' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-4">
            Galerie
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Entdecken Sie unsere schönsten Arbeiten - Vorher-Nachher Vergleiche zeigen die Transformation unserer Kunden
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              className="transition-elegant"
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item) => (
            <Card key={item.id} className="border-border bg-card hover:shadow-soft transition-elegant overflow-hidden">
              <div className="relative group">
                <img 
                  src={item.image}
                  alt={item.title}
                  className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Eye className="h-4 w-4" />
                      Vorher-Nachher Vergleich
                    </div>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-heading font-semibold text-foreground">{item.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {categories.find(cat => cat.id === item.category)?.label}
                  </Badge>
                </div>
                
                <p className="text-muted-foreground text-sm mb-4">
                  {item.description}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vorher:</span>
                    <span className="text-foreground">{item.before}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nachher:</span>
                    <span className="text-primary font-medium">{item.after}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Instagram CTA */}
        <div className="mt-16 text-center">
          <div className="bg-card border border-border rounded-lg p-8">
            <Instagram className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-heading font-bold text-primary mb-4">
              Mehr auf Instagram
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Folgen Sie uns auf Instagram für tägliche Inspiration, Behind-the-Scenes Einblicke 
              und die neuesten Transformationen unserer Kunden.
            </p>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.open('https://www.instagram.com/schnittwerksg?igsh=MXA1NTQzOG90OWU1dw%3D%3D&utm_source=qr', '_blank')}
            >
              @schnittwerksg folgen
            </Button>
          </div>
        </div>

        {/* Work Process */}
        <div className="mt-16">
          <h3 className="text-2xl font-heading font-bold text-center text-primary mb-8">
            Unser Arbeitsablauf
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Beratung', desc: 'Ausführliche Analyse und Beratung' },
              { step: '2', title: 'Planung', desc: 'Individueller Behandlungsplan' },
              { step: '3', title: 'Umsetzung', desc: 'Professionelle Durchführung' },
              { step: '4', title: 'Styling', desc: 'Perfektes Finish und Styling-Tipps' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gallery;