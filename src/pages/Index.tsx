import React from 'react';
import Navigation from '@/components/ui/navigation';
import Hero from '@/components/sections/hero';
import Services from '@/components/sections/services';
import About from '@/components/sections/about';
import Contact from '@/components/sections/contact';
import GoogleReviews from '@/components/sections/google-reviews';
import Footer from '@/components/sections/footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <Services />
      <About />
      <Contact />
      <GoogleReviews />
      <Footer />
    </div>
  );
};

export default Index;
