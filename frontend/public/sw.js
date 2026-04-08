// Service Worker Kill Switch
// This script replaces the existing service worker to immediately unregister itself
// and clean up any caching issues affecting development.

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Unregister this service worker
  event.waitUntil(
    self.registration.unregister().then(() => {
      console.log('Service Worker: Unregistered successfully (Kill Switch Action)');
    })
  );
});

// Pass through all fetches to network (no interception)
self.addEventListener('fetch', (event) => {
  // Do nothing, let browser handle network
});