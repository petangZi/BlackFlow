/**
 * Black Flow - Service Worker
 * Offline-first caching for PWA
 */

const CACHE_NAME = 'blackflow-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/js/main.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/router.js',
  '/js/i18n.js',
  '/js/auth.js',
  '/locales/id.json',
  '/locales/en.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (API calls, etc.)
  if (url.origin !== location.origin) {
    // But allow Supabase and known API origins
    const allowedOrigins = [
      'https://*.supabase.co',
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://generativelanguage.googleapis.com',
      'https://api.groq.com',
      'https://openrouter.ai'
    ];
    const isAllowed = allowedOrigins.some(pattern => {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(url.origin);
    });
    if (!isAllowed) return;
  }

  // Network-first for HTML, cache-first for static assets
  const isHTML = request.headers.get('accept')?.includes('text/html');
  const isStaticAsset = request.destination === 'style' || 
                        request.destination === 'script' || 
                        request.destination === 'image' ||
                        request.destination === 'font' ||
                        request.destination === 'manifest';

  if (isHTML) {
    // Network-first for HTML
    event.respondWith(networkFirst(request));
  } else if (isStaticAsset) {
    // Cache-first for static assets
    event.respondWith(cacheFirst(request));
  } else {
    // Network-first for everything else
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return offline page for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineCache = await caches.match('/index.html');
      if (offlineCache) return offlineCache;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Sync pending messages when online
  console.log('[SW] Syncing messages...');
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'close', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow(event.notification.data || '/'));
  }
});