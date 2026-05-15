// ============================================================
// 4S Interiors Orders — Service Worker
// Cache-first for app shell & CDN assets.
// Network-first for API calls to Google Apps Script.
// ============================================================

const CACHE  = '4s-orders-v4';
const SHELL  = [
  '/4s-orders/',
  '/4s-orders/index.html',
  '/4s-orders/manifest.json',
  '/4s-orders/icon.svg',
];

// CDN assets we want cached for offline use
const CDN = [
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache shell + CDN (ignore individual CDN failures so install succeeds offline too)
      return cache.addAll(SHELL).then(() =>
        Promise.allSettled(CDN.map(url => cache.add(url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Google Apps Script API → network-first (always fresh data)
  if (url.includes('script.google.com')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // 2. Google Fonts requests → cache-first (they change rarely)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  // 3. CDN scripts → cache-first (versioned URLs, safe to cache forever)
  if (url.includes('unpkg.com') || url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // 4. App shell (HTML, manifest, icons) → cache-first, update in background
  if (url.includes(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        const fetchPromise = fetch(e.request).then(resp => {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        });
        return hit || fetchPromise;
      })
    );
    return;
  }

  // 5. Everything else → network only
  e.respondWith(fetch(e.request));
});

// ── Push Notifications (future) ────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || '4S Orders', {
      body: data.body || '',
      icon: '/4s-orders/icon.svg',
      badge: '/4s-orders/icon.svg',
      vibrate: [200, 100, 200],
    })
  );
});
