import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Star } from 'lucide-react';
import { AppointmentBookingDialog } from '@/components/booking/appointment-booking-dialog';
import ProductsDialog from '@/components/booking/products-dialog';
import OpeningHoursDialog from '@/components/ui/opening-hours-dialog';
import AuthDialog from '@/components/auth/AuthDialog';
import { Link } from 'react-router-dom';
import heroImage from '@/assets/salon-hero.jpg';

const Hero = () => {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/60 to-primary/40"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight text-white">
                SCHNITTWERK
              </h1>
              <p className="text-lg md:text-xl font-nunito text-white/90 tracking-wide text-center mt-2">
                BY VANESSA CAROSELLA
              </p>
            </div>
            <p className="text-2xl md:text-3xl font-heading font-medium text-white/90">
              Dein Look. Dein Schnittwerk.
            </p>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              Moderner Coiffeur im Silberturm St. Gallen für Damen und Herren. 
              Hochwertige Behandlungen mit Trinity Haircare Produkten.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <a 
              href="https://www.google.com/maps/search/?api=1&query=Rorschacherstrasse+152,+9000+St.+Gallen"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105"
            >
              <MapPin className="h-8 w-8 text-white mb-3 mx-auto" />
              <h3 className="font-heading font-semibold text-lg mb-2">Standort</h3>
              <p className="text-white/80 text-sm">
                Rorschacherstrasse 152<br />
                9000 St. Gallen
              </p>
            </a>
            
            <OpeningHoursDialog>
              <div className="block bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105">
                <Clock className="h-8 w-8 text-white mb-3 mx-auto" />
                <h3 className="font-heading font-semibold text-lg mb-2">Öffnungszeiten</h3>
                <p className="text-white/80 text-sm">
                  Mo-Di, Do-Fr: 09:00-18:30<br />
                  Sa: 09:00-15:00
                </p>
              </div>
            </OpeningHoursDialog>
            
            <Link 
              to="/leistungen"
              className="block bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105"
            >
              <Star className="h-8 w-8 text-white mb-3 mx-auto" />
              <h3 className="font-heading font-semibold text-lg mb-2">Services</h3>
              <p className="text-white/80 text-sm">
                Schnitte, Colorationen<br />
                Balayage, Wimpern & Brauen
              </p>
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
            <Button 
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-medium px-8 py-4 text-lg"
              onClick={() => setShowAuthDialog(true)}
            >
              Termin buchen
            </Button>
            <ProductsDialog>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white text-black hover:bg-white/90 border-white font-medium px-8 py-4 text-lg"
              >
                Produkte
              </Button>
            </ProductsDialog>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>

      <AuthDialog 
        isOpen={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)} 
      />
    </section>
  );
};

export default Hero;