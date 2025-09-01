import React from 'react';
import { Instagram, Phone, MapPin, Clock } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-2xl font-heading font-bold">Schnittwerk</h3>
            <p className="text-primary-foreground/80">
              Dein Look. Dein Schnittwerk.
            </p>
            <p className="text-sm text-primary-foreground/70">
              Moderner Coiffeur im Silberturm St. Gallen für Damen und Herren.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h4 className="font-heading font-semibold">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant">Startseite</a></li>
              <li><a href="/leistungen" className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant">Leistungen & Preise</a></li>
              <li><a href="/team" className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant">Team</a></li>
              <li><a href="/galerie" className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant">Galerie</a></li>
              <li><a href="/shop" className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant">Shop</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading font-semibold">Kontakt</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-primary-foreground/80">
                  Rorschacherstrasse 152<br />9000 St. Gallen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a 
                  href="tel:+41718019265" 
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant"
                >
                  +41 71 801 92 65
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                <a 
                  href="https://www.instagram.com/schnittwerksg?igsh=MXA1NTQzOG90OWU1dw%3D%3D&utm_source=qr" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant"
                >
                  @schnittwerksg
                </a>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v10a2 2 0 002 2z" />
                </svg>
                <a 
                  href="mailto:info@schnittwerksg.ch"
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-elegant"
                >
                  info@schnittwerksg.ch
                </a>
              </div>
            </div>
          </div>

          {/* Opening Hours */}
          <div className="space-y-4">
            <h4 className="font-heading font-semibold">Öffnungszeiten</h4>
            <div className="space-y-1 text-sm text-primary-foreground/80">
              <div className="flex justify-between">
                <span>Mo-Di, Do-Fr:</span>
                <span>09:00-18:30</span>
              </div>
              <div className="flex justify-between">
                <span>Samstag:</span>
                <span>09:00-15:00</span>
              </div>
              <div className="flex justify-between">
                <span>Mi & So:</span>
                <span>Geschlossen</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-primary-foreground/70">
            © 2024 Schnittwerk. Alle Rechte vorbehalten.
          </div>
          <div className="flex gap-6 mt-4 md:mt-0 text-sm">
            <a href="/impressum" className="text-primary-foreground/70 hover:text-primary-foreground transition-elegant">
              Impressum
            </a>
            <a href="/datenschutz" className="text-primary-foreground/70 hover:text-primary-foreground transition-elegant">
              Datenschutz
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;