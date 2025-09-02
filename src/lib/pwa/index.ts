// PWA utility functions for service worker registration and management

export interface PWAStatus {
  isSupported: boolean;
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  serviceWorkerState: 'installing' | 'waiting' | 'active' | 'none';
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Service Worker registration
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates
    });

    console.log('Service Worker registered successfully:', registration);

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        console.log('New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is installed and ready
            console.log('New service worker installed, prompting for update');
            promptForUpdate(registration);
          }
        });
      }
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Prompt user for service worker update
function promptForUpdate(registration: ServiceWorkerRegistration) {
  // You can integrate this with your toast/notification system
  const updateAvailable = confirm(
    'Eine neue Version der Anwendung ist verfügbar. Möchten Sie aktualisieren?'
  );

  if (updateAvailable && registration.waiting) {
    // Tell the waiting service worker to skip waiting and become active
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Reload the page to get the new version
    window.location.reload();
  }
}

// Check if app is running as PWA
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Get PWA status
export function getPWAStatus(): PWAStatus {
  const isSupported = 'serviceWorker' in navigator && 'caches' in window;
  const isInstalled = isPWA();
  const isOnline = navigator.onLine;
  
  let serviceWorkerState: PWAStatus['serviceWorkerState'] = 'none';
  if (navigator.serviceWorker?.controller) {
    serviceWorkerState = 'active';
  }

  return {
    isSupported,
    isInstalled,
    isInstallable: false, // Will be updated by install prompt handler
    isOnline,
    serviceWorkerState
  };
}

// PWA install prompt management
class PWAInstallManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installPromptShown = false;

  constructor() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA install prompt available');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      this.deferredPrompt = e as BeforeInstallPromptEvent;
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredPrompt = null;
    });
  }

  public canInstall(): boolean {
    return this.deferredPrompt !== null && !this.installPromptShown;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    this.installPromptShown = true;

    try {
      // Show the install prompt
      await this.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`PWA install prompt outcome: ${outcome}`);
      
      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }
}

// Create global instance
export const pwaInstallManager = new PWAInstallManager();

// Network status management
export class NetworkStatus {
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.notifyListeners(true));
    window.addEventListener('offline', () => this.notifyListeners(false));
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }

  public addListener(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(callback => callback(isOnline));
  }
}

export const networkStatus = new NetworkStatus();

// Cache management utilities
export class CacheManager {
  public async clearAppCache(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }

  public async getCacheSize(): Promise<number> {
    if (!('caches' in window)) {
      return 0;
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const cacheManager = new CacheManager();

// Background sync utilities
export function requestBackgroundSync(tag: string): void {
  if ('serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as unknown as { sync?: unknown })) {
    navigator.serviceWorker.ready.then((registration) => {
      const registrationWithSync = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
      return registrationWithSync.sync?.register(tag);
    }).catch((error) => {
      console.error('Background sync registration failed:', error);
    });
  }
}

// Trigger appointment data sync when online
export function syncAppointmentData(): void {
  requestBackgroundSync('background-sync-appointments');
}

// PWA badge utilities (experimental)
export function setBadge(count: number): void {
  if ('setAppBadge' in navigator) {
    const nav = navigator as unknown as { setAppBadge?: (count: number) => Promise<void> };
    nav.setAppBadge?.(count).catch((error: unknown) => {
      console.error('Failed to set app badge:', error);
    });
  }
}

export function clearBadge(): void {
  if ('clearAppBadge' in navigator) {
    const nav = navigator as unknown as { clearAppBadge?: () => Promise<void> };
    nav.clearAppBadge?.().catch((error: unknown) => {
      console.error('Failed to clear app badge:', error);
    });
  }
}

// Initialize PWA features
export async function initializePWA(): Promise<ServiceWorkerRegistration | null> {
  console.log('Initializing PWA features...');
  
  const registration = await registerServiceWorker();
  
  // Log PWA status
  const status = getPWAStatus();
  console.log('PWA Status:', status);
  
  return registration;
}