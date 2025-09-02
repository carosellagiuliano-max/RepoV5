import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CartProvider } from './contexts/cart-context'
import { initializePWA } from './lib/pwa/index'

console.log('Schnittwerk App is starting...');

// Initialize PWA features
if (typeof window !== 'undefined') {
  initializePWA().then((registration) => {
    if (registration) {
      console.log('PWA features initialized successfully');
    } else {
      console.log('PWA features not available on this browser');
    }
  }).catch((error) => {
    console.error('Failed to initialize PWA features:', error);
  });
}

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
