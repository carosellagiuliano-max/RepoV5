// Service Worker for Schnittwerk Your Style PWA
const CACHE_NAME = 'schnittwerk-v1';
const STATIC_CACHE_NAME = 'schnittwerk-static-v1';
const DYNAMIC_CACHE_NAME = 'schnittwerk-dynamic-v1';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  // Add main application shell assets
  '/assets/index.css',
  '/assets/index.js',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@300;400;500;600&family=Nunito:wght@300;400;500;600;700;800&display=swap',
];

// Route patterns for different caching strategies
const ROUTE_PATTERNS = {
  // Static assets - Cache First
  static: /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
  
  // API calls - Network First with fallback
  api: /^\/_netlify\/functions\//,
  
  // Appointment data - Network First (critical for freshness)
  appointments: /\/api\/appointments|\/functions\/availability/,
  
  // Services and staff - Stale While Revalidate (semi-static)
  services: /\/functions\/(services|staff)/,
  
  // Images - Cache First
  images: /\.(png|jpg|jpeg|gif|svg|webp)$/,
  
  // Navigation - Network First
  navigation: /^\/(about|services|gallery|contact|booking|customer|admin)/
};

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Static assets cached successfully');
      self.skipWaiting(); // Take control immediately
    }).catch((error) => {
      console.error('[SW] Failed to cache static assets:', error);
    })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      self.clients.claim(); // Take control of all pages
    })
  );
});

// Fetch event - Handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

// Main request handler with different strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Static assets - Cache First
    if (ROUTE_PATTERNS.static.test(url.pathname) || ROUTE_PATTERNS.images.test(url.pathname)) {
      return await cacheFirst(request, STATIC_CACHE_NAME);
    }
    
    // API endpoints (critical data) - Network First
    if (ROUTE_PATTERNS.api.test(url.pathname) || ROUTE_PATTERNS.appointments.test(url.pathname)) {
      return await networkFirst(request, DYNAMIC_CACHE_NAME);
    }
    
    // Services/Staff data - Stale While Revalidate
    if (ROUTE_PATTERNS.services.test(url.pathname)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE_NAME);
    }
    
    // Navigation requests - Network First with offline fallback
    if (request.mode === 'navigate') {
      return await handleNavigation(request);
    }
    
    // Default strategy - Network First
    return await networkFirst(request, DYNAMIC_CACHE_NAME);
    
  } catch (error) {
    console.error('[SW] Error handling request:', error);
    return await getOfflineFallback(request);
  }
}

// Cache First strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First fallback failed:', error);
    throw error;
  }
}

// Network First strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch in background to update cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.log('[SW] Background fetch failed:', error);
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return await fetchPromise;
}

// Navigation handler with offline page
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation network failed, trying cache');
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page or root
    return await cache.match('/') || await getOfflineFallback(request);
  }
}

// Offline fallback
async function getOfflineFallback(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Try to return a cached version of the root page
  const rootPage = await cache.match('/');
  if (rootPage) {
    return rootPage;
  }
  
  // If nothing is cached, return a minimal offline response
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Schnittwerk - Offline</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh; 
            margin: 0;
            background: #f3f4f6;
            color: #374151;
          }
          .container { 
            text-align: center; 
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          h1 { color: #1f2937; margin-bottom: 1rem; }
          p { margin-bottom: 1.5rem; color: #6b7280; }
          .retry-btn {
            background: #1f2937;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          }
          .retry-btn:hover { background: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔌 Offline</h1>
          <p>Sie sind momentan offline. Bitte prüfen Sie Ihre Internetverbindung.</p>
          <button class="retry-btn" onclick="window.location.reload()">
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

// Background sync for appointment data when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-appointments') {
    console.log('[SW] Background sync triggered for appointments');
    event.waitUntil(syncAppointmentData());
  }
});

// Sync appointment data in background
async function syncAppointmentData() {
  try {
    // Clear old appointment cache to force fresh data
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (ROUTE_PATTERNS.appointments.test(request.url)) {
        await cache.delete(request);
      }
    }
    
    console.log('[SW] Appointment cache cleared for fresh sync');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service worker script loaded');