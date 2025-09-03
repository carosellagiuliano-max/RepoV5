import { useEffect, useState } from 'react';
import { pwaManager, type PWAState } from './pwa-manager';

/**
 * React hook for PWA functionality
 * Provides access to PWA state and actions
 */
export function usePWA() {
  const [pwaState, setPWAState] = useState<PWAState>(() => pwaManager.getState());

  useEffect(() => {
    // Subscribe to PWA state changes
    const unsubscribe = pwaManager.subscribe(setPWAState);
    
    // Cleanup subscription
    return unsubscribe;
  }, []);

  const installApp = async (): Promise<boolean> => {
    return await pwaManager.showInstallPrompt();
  };

  const updateApp = async (): Promise<void> => {
    await pwaManager.updateServiceWorker();
  };

  return {
    // State
    isInstalled: pwaState.isInstalled,
    isInstallable: pwaState.isInstallable,
    isOffline: pwaState.isOffline,
    
    // Actions
    installApp,
    updateApp,
    
    // Full state for advanced usage
    pwaState,
  };
}

/**
 * Hook for offline detection with additional functionality
 */
export function useOffline() {
  const { isOffline } = usePWA();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline && !wasOffline) {
      // Just went offline
      setWasOffline(true);
    } else if (!isOffline && wasOffline) {
      // Just came back online
      setWasOffline(false);
    }
  }, [isOffline, wasOffline]);

  return {
    isOffline,
    wasOffline,
    justWentOffline: isOffline && !wasOffline,
    justCameOnline: !isOffline && wasOffline,
  };
}

/**
 * Hook for PWA install banner management
 */
export function useInstallBanner() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    // Check if user previously dismissed the banner
    return localStorage.getItem('pwa-banner-dismissed') === 'true';
  });

  const showBanner = isInstallable && !isInstalled && !bannerDismissed;

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const resetBannerState = () => {
    setBannerDismissed(false);
    localStorage.removeItem('pwa-banner-dismissed');
  };

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setBannerDismissed(true);
    }
    return success;
  };

  return {
    showBanner,
    dismissBanner,
    resetBannerState,
    handleInstall,
    isInstallable,
    isInstalled,
  };
}