import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CartProvider } from './contexts/cart-context'
import { pwaManager } from './lib/pwa'

console.log('Schnittwerk App is starting...');

// Initialize PWA functionality
if (typeof window !== 'undefined') {
  // PWA manager will auto-initialize
  console.log('PWA Manager initialized');
}

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
