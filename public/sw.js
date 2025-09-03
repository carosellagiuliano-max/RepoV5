// Service Worker for Schnittwerk PWA
// Provides offline functionality for appointments and key pages

const CACHE_NAME = 'schnittwerk-v1';
const STATIC_CACHE_NAME = 'schnittwerk-static-v1';
const DYNAMIC_CACHE_NAME = 'schnittwerk-dynamic-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  // Core app shell files will be added by build process
];

// Routes to cache dynamically
const DYNAMIC_ROUTES = [
  '/booking',
  '/services', 
  '/gallery',
  '/contact',
  '/about',
  '/products'
];

// API endpoints to cache for offline access
const API_CACHE_PATTERNS = [
  '/netlify/functions/services',
  '/netlify/functions/staff',
  '/netlify/functions/availability'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  // Handle API requests
  if (API_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with cache-first strategy for specific endpoints
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // For read-only API calls, try cache first
    if (url.pathname.includes('/services') || 
        url.pathname.includes('/staff') ||
        url.pathname.includes('/availability')) {
      
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Serve from cache and update in background
        updateCacheInBackground(request);
        return cachedResponse;
      }
    }

    // Fetch from network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] API request failed, trying cache:', error);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for API errors
    return new Response(JSON.stringify({
      error: 'Offline - cached data not available',
      offline: true
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Handle navigation requests with cache-first strategy
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Navigation request failed, trying cache:', error);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to cached index.html for SPA routes
    const fallbackResponse = await caches.match('/index.html');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    
    // Ultimate fallback
    return new Response('Offline - Please check your connection', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network and cache
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Static request failed:', error);
    
    // Try cache again
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Update cache in background
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
  } catch (error) {
    console.log('[SW] Background cache update failed:', error);
  }
}

// Handle sync events for background data sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Sync critical data when connection is restored
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    
    // Update services, staff, and availability data
    const syncPromises = API_CACHE_PATTERNS.map(async (pattern) => {
      try {
        const request = new Request(pattern);
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (error) {
        console.log('[SW] Failed to sync:', pattern, error);
      }
    });
    
    await Promise.allSettled(syncPromises);
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  // TODO: Implement push notifications for appointment reminders
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  // Navigate to app
  event.waitUntil(
    clients.openWindow('/')
  );
});