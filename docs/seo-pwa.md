# SEO & PWA Implementation

This document describes the SEO improvements and Progressive Web App (PWA) functionality implemented for Schnittwerk.

## SEO Enhancements

### Meta Tags & Open Graph
- **Enhanced Open Graph tags** with proper salon imagery and descriptions
- **Twitter Card support** for better social media sharing
- **Additional SEO meta tags** including keywords, robots directives, and canonical URLs
- **Properly localized content** for Swiss German market (de_CH)

### Structured Data (JSON-LD)
- **HairSalon schema** implemented according to Schema.org standards
- **Complete business information** including address, phone, opening hours
- **Service catalog** with descriptions of offered services
- **Aggregate rating** data for enhanced search results

### Search Engine Optimization
- **sitemap.xml** with all major pages and proper SEO priorities
- **Enhanced robots.txt** with sitemap reference
- **Canonical URLs** to prevent duplicate content issues

## PWA Implementation

### Core PWA Features
- **manifest.webmanifest** with complete PWA configuration
- **Service Worker** with intelligent caching strategies
- **Offline functionality** for key pages and data
- **Install prompts** for better user engagement
- **Background sync** for data synchronization when connection is restored

### Service Worker Caching Strategy

#### Static Assets
- **Cache-first strategy** for CSS, JS, images, and fonts
- **Long-term caching** with cache busting for updates
- **Fallback handling** for offline scenarios

#### API Endpoints
- **Network-first with cache fallback** for dynamic data
- **Background refresh** when connection is restored
- **Offline fallback responses** for critical API failures

#### Navigation
- **App shell caching** for instant loading
- **SPA route handling** with fallback to cached index.html
- **Offline page** for non-cached routes

### PWA Manager API

```typescript
import { usePWA } from '@/lib/pwa';

function MyComponent() {
  const { isOffline, isInstallable, installApp } = usePWA();
  
  if (isOffline) {
    return <div>Offline mode - cached data available</div>;
  }
  
  if (isInstallable) {
    return <button onClick={installApp}>Install App</button>;
  }
  
  return <div>App content</div>;
}
```

### Available Hooks

#### `usePWA()`
Main hook for PWA functionality:
- `isInstalled` - Whether app is installed
- `isInstallable` - Whether install prompt is available
- `isOffline` - Current online/offline status
- `installApp()` - Show install prompt
- `updateApp()` - Update service worker

#### `useOffline()`
Specialized hook for offline detection:
- `isOffline` - Current offline status
- `wasOffline` - Previous offline status
- `justWentOffline` - Just went offline
- `justCameOnline` - Just came back online

#### `useInstallBanner()`
Hook for managing install banner:
- `showBanner` - Whether to show install banner
- `dismissBanner()` - Dismiss the banner
- `handleInstall()` - Handle installation

## Security Headers

### Content Security Policy (CSP)
- **Strict CSP** allowing only necessary sources
- **Supabase and Mapbox** domains whitelisted
- **Google Fonts** support maintained
- **Inline scripts** restricted to essential functionality

### Additional Security Headers
- **HSTS** with preload for enhanced security
- **X-Frame-Options** for clickjacking protection
- **X-Content-Type-Options** to prevent MIME sniffing
- **Referrer Policy** for privacy protection
- **Permissions Policy** for feature control

## Deployment Configuration

### Netlify Headers
The `public/_headers` file configures:
- **Security headers** for all routes
- **Caching policies** for different asset types
- **Service worker** scope and permissions
- **API endpoint** cache control

### Build Integration
- **Automatic copying** of PWA files to dist directory
- **Service worker** served from root with proper headers
- **Manifest** served with correct MIME type
- **Static assets** with immutable caching

## Testing

### PWA Functionality Tests
- **Service worker registration** and error handling
- **PWA state management** and offline detection
- **Install prompt handling** and app installation
- **Background sync** functionality

### SEO Validation
- **Structured data** schema validation
- **Open Graph** meta tag verification
- **Manifest** structure validation

## Usage Examples

### Basic PWA Integration
```typescript
// App.tsx
import { usePWA } from '@/lib/pwa';

function App() {
  const { isOffline } = usePWA();
  
  return (
    <div>
      {isOffline && <OfflineBanner />}
      <Router>
        {/* Your routes */}
      </Router>
    </div>
  );
}
```

### Install Banner Component
```typescript
// InstallBanner.tsx
import { useInstallBanner } from '@/lib/pwa';

function InstallBanner() {
  const { showBanner, handleInstall, dismissBanner } = useInstallBanner();
  
  if (!showBanner) return null;
  
  return (
    <div className="install-banner">
      <p>Install Schnittwerk for better experience</p>
      <button onClick={handleInstall}>Install</button>
      <button onClick={dismissBanner}>Dismiss</button>
    </div>
  );
}
```

### Offline Indicator
```typescript
// OfflineIndicator.tsx
import { useOffline } from '@/lib/pwa';

function OfflineIndicator() {
  const { isOffline, justCameOnline } = useOffline();
  
  useEffect(() => {
    if (justCameOnline) {
      toast.success('Back online - data synced');
    }
  }, [justCameOnline]);
  
  if (!isOffline) return null;
  
  return (
    <div className="offline-indicator">
      You're offline - using cached data
    </div>
  );
}
```

## Performance Impact

### Benefits
- **Faster loading** through intelligent caching
- **Offline functionality** for better user experience
- **Reduced bandwidth** usage for returning users
- **Better SEO rankings** through structured data and performance

### Metrics
- **First Load** - Initial service worker registration overhead (~50ms)
- **Subsequent Loads** - Cached resources load instantly
- **Offline Usage** - Full functionality for cached data
- **Background Sync** - Automatic data updates when online

## Browser Support

### PWA Features
- **Chrome/Edge** - Full PWA support including install prompts
- **Firefox** - Service worker and manifest support
- **Safari** - Limited PWA support, web app manifest
- **Mobile browsers** - Enhanced mobile web app experience

### Fallback Behavior
- **Non-PWA browsers** - Graceful degradation to standard web app
- **Service worker unsupported** - Normal network requests
- **Install prompt unavailable** - Standard bookmarking

## Maintenance

### Updating Service Worker
When updating the service worker:
1. Increment version numbers in cache names
2. Test offline functionality
3. Verify background sync works
4. Check install/update prompts

### Adding New Routes
To add new routes to offline caching:
1. Add route to `DYNAMIC_ROUTES` in service worker
2. Update sitemap.xml with new pages
3. Test offline functionality for new routes

### Performance Monitoring
Monitor these metrics:
- **Cache hit ratio** for static assets
- **Offline usage** patterns
- **Install conversion** rates
- **Service worker** update frequency