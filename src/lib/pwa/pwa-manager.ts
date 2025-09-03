/**
 * PWA Registration and Management Utilities
 * Handles service worker registration, installation prompts, and offline detection
 */

export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  installPrompt: PWAInstallPrompt | null;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
}

class PWAManager {
  private state: PWAState = {
    isInstalled: false,
    isInstallable: false,
    isOffline: !navigator.onLine,
    installPrompt: null,
    serviceWorkerRegistration: null,
  };

  private listeners: ((state: PWAState) => void)[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Only initialize in browser environment
    if (typeof window === 'undefined') return;
    
    // Register service worker
    await this.registerServiceWorker();
    
    // Setup install prompt handling
    this.setupInstallPrompt();
    
    // Setup offline detection
    this.setupOfflineDetection();
    
    // Check if app is already installed
    this.checkInstallationStatus();
    
    // Initial state notification
    this.notifyStateChange();
  }

  /**
   * Register the service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported');
      return;
    }

    try {
      console.log('[PWA] Registering service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      this.state.serviceWorkerRegistration = registration;

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        console.log('[PWA] Service worker update found');
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker installed, reload recommended');
              this.notifyNewVersion();
            }
          });
        }
      });

      // Handle service worker ready
      const readyRegistration = await navigator.serviceWorker.ready;
      console.log('[PWA] Service worker ready:', readyRegistration);

      // Setup background sync if supported
      if ('sync' in window.ServiceWorkerRegistration.prototype) {
        console.log('[PWA] Background sync supported');
      }

    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }

  /**
   * Setup install prompt handling
   */
  private setupInstallPrompt(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[PWA] Install prompt available');
      
      // Prevent automatic prompt
      event.preventDefault();
      
      // Store the prompt for later use
      this.state.installPrompt = event as PWAInstallPrompt;
      this.state.isInstallable = true;
      this.notifyStateChange();
    });

    // Handle app installation
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      this.state.isInstalled = true;
      this.state.isInstallable = false;
      this.state.installPrompt = null;
      this.notifyStateChange();
    });
  }

  /**
   * Setup offline detection
   */
  private setupOfflineDetection(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    const updateOnlineStatus = () => {
      const wasOffline = this.state.isOffline;
      this.state.isOffline = !navigator.onLine;
      
      if (wasOffline && !this.state.isOffline) {
        console.log('[PWA] Back online - triggering background sync');
        this.triggerBackgroundSync();
      }
      
      this.notifyStateChange();
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  /**
   * Check if the app is already installed
   */
  private checkInstallationStatus(): void {
    // Check if running in browser environment
    if (typeof window === 'undefined') return;
    
    // Check if running in standalone mode (installed PWA)
    if (typeof window.matchMedia === 'function') {
      try {
        if (window.matchMedia('(display-mode: standalone)').matches) {
          this.state.isInstalled = true;
          console.log('[PWA] App is installed (standalone mode)');
        }
      } catch (error) {
        console.log('[PWA] matchMedia not available:', error);
      }
    }

    // Check iOS standalone mode
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) {
      this.state.isInstalled = true;
      console.log('[PWA] App is installed (iOS standalone)');
    }
  }

  /**
   * Trigger background sync
   */
  private async triggerBackgroundSync(): Promise<void> {
    if (!this.state.serviceWorkerRegistration) return;

    try {
      if ('sync' in window.ServiceWorkerRegistration.prototype) {
        await this.state.serviceWorkerRegistration.sync.register('background-sync');
        console.log('[PWA] Background sync registered');
      }
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }

  /**
   * Notify about new service worker version
   */
  private notifyNewVersion(): void {
    // Could emit custom event or use toast notification
    const event = new CustomEvent('pwa:newversion', {
      detail: { registration: this.state.serviceWorkerRegistration }
    });
    window.dispatchEvent(event);
  }

  /**
   * Notify state change to listeners
   */
  private notifyStateChange(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  /**
   * Subscribe to PWA state changes
   */
  public subscribe(listener: (state: PWAState) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener({ ...this.state });
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current PWA state
   */
  public getState(): PWAState {
    return { ...this.state };
  }

  /**
   * Show install prompt to user
   */
  public async showInstallPrompt(): Promise<boolean> {
    if (!this.state.installPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await this.state.installPrompt.prompt();
      const { outcome } = await this.state.installPrompt.userChoice;
      
      console.log('[PWA] Install prompt result:', outcome);
      
      if (outcome === 'accepted') {
        this.state.isInstallable = false;
        this.state.installPrompt = null;
        this.notifyStateChange();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error);
      return false;
    }
  }

  /**
   * Update service worker
   */
  public async updateServiceWorker(): Promise<void> {
    if (!this.state.serviceWorkerRegistration) return;

    try {
      await this.state.serviceWorkerRegistration.update();
      console.log('[PWA] Service worker update triggered');
    } catch (error) {
      console.error('[PWA] Service worker update failed:', error);
    }
  }

  /**
   * Unregister service worker (for cleanup)
   */
  public async unregister(): Promise<boolean> {
    if (!this.state.serviceWorkerRegistration) return false;

    try {
      const result = await this.state.serviceWorkerRegistration.unregister();
      console.log('[PWA] Service worker unregistered:', result);
      return result;
    } catch (error) {
      console.error('[PWA] Service worker unregister failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Export types
export type { PWAState };