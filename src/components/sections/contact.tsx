import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Clock, Instagram, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Contact = () => {
  const navigate = useNavigate();
  
  const openingHours = [
    { day: 'Montag', hours: '09:00 - 18:30' },
    { day: 'Dienstag', hours: '09:00 - 18:30' },
    { day: 'Mittwoch', hours: 'Geschlossen' },
    { day: 'Donnerstag', hours: '09:00 - 18:30' },
    { day: 'Freitag', hours: '09:00 - 18:30' },
    { day: 'Samstag', hours: '09:00 - 15:00' },
    { day: 'Sonntag', hours: 'Geschlossen' },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-4">
            Kontakt & Standort
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Besuchen Sie uns im Silberturm St. Gallen oder vereinbaren Sie bequem einen Termin
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Contact Info */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-heading">
                <MapPin className="h-6 w-6 text-primary" />
                Standort
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-semibold text-foreground">Schnittwerk</p>
                <p className="text-muted-foreground">Rorschacherstrasse 152</p>
                <p className="text-muted-foreground">9000 St. Gallen</p>
                <p className="text-muted-foreground">Schweiz</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://maps.google.com/?q=Rorschacherstrasse+152,+9000+St.+Gallen', '_blank')}
              >
                Auf Karte anzeigen
              </Button>
            </CardContent>
          </Card>

          {/* Opening Hours */}
          <Card className="border-border bg-card cursor-pointer hover:shadow-soft transition-elegant" onClick={() => navigate('/kontakt')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-heading">
                <Clock className="h-6 w-6 text-primary" />
                Öffnungszeiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openingHours.map((schedule, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-foreground font-medium">{schedule.day}</span>
                    <span className="text-muted-foreground">{schedule.hours}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground text-center">
                  Klicken für vollständige Kontaktinformationen
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Methods */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-heading">
                <Phone className="h-6 w-6 text-primary" />
                Kontakt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <a 
                    href="tel:+41718019265" 
                    className="text-foreground hover:text-primary transition-elegant"
                  >
                    +41 71 801 92 65
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Instagram className="h-5 w-5 text-muted-foreground" />
                  <a 
                    href="https://www.instagram.com/schnittwerksg?igsh=MXA1NTQzOG90OWU1dw%3D%3D&utm_source=qr" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-foreground hover:text-primary transition-elegant"
                  >
                    @schnittwerksg
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a 
                    href="mailto:info@schnittwerksg.ch"
                    className="text-foreground hover:text-primary transition-elegant"
                  >
                    info@schnittwerksg.ch
                  </a>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open('tel:+41718019265', '_self')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Anrufen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="relative h-64 md:h-96 overflow-hidden rounded-lg">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2712.8947162344837!2d9.375838815563567!3d47.42271997917442!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x479b1ed65b8b0b0b%3A0x0!2sRorschacherstrasse%20152%2C%209000%20St.%20Gallen%2C%20Switzerland!5e0!3m2!1sen!2sch!4v1643723456789!5m2!1sen!2sch"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Schnittwerk Standort"
              ></iframe>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Contact;