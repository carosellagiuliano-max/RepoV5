import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';

const GoogleReviews = () => {
  const reviews = [
    {
      name: "Anna Schmidt",
      rating: 5,
      text: "Absolut fantastischer Service! Mein Haarschnitt ist perfekt geworden und das Team war sehr professionell.",
      date: "vor 2 Wochen"
    },
    {
      name: "Michael Weber",
      rating: 5,
      text: "Beste Entscheidung! Die Beratung war top und das Ergebnis übertrifft alle Erwartungen.",
      date: "vor 1 Monat"
    },
    {
      name: "Sarah Müller",
      rating: 5,
      text: "Sehr zufrieden mit dem Schnitt und der Färbung. Komme definitiv wieder!",
      date: "vor 3 Wochen"
    },
    {
      name: "Thomas Klein",
      rating: 5,
      text: "Moderner Salon mit sehr freundlichem Personal. Preis-Leistung stimmt perfekt.",
      date: "vor 1 Woche"
    }
  ];

  const averageRating = 4.9;
  const totalReviews = 127;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <section className="py-20 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
            Was unsere Kunden sagen
          </h2>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              {renderStars(5)}
            </div>
            <span className="text-xl font-semibold text-primary">{averageRating}</span>
            <span className="text-muted-foreground">({totalReviews} Bewertungen)</span>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unsere Kunden lieben uns! Lesen Sie, was sie über ihre Erfahrungen bei Schnittwerk sagen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((review, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-3">
                  {renderStars(review.rating)}
                </div>
                <div className="mb-4">
                  <Quote className="w-5 h-5 text-primary/60 mb-2" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "{review.text}"
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-primary text-sm">{review.name}</p>
                    <p className="text-xs text-muted-foreground">Google Bewertung</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{review.date}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href="https://www.google.com/maps/place/Schnittwerk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors duration-300"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
              alt="Google"
              className="w-5 h-5"
            />
            Alle Bewertungen auf Google ansehen
          </a>
        </div>
      </div>
    </section>
  );
};

export default GoogleReviews;