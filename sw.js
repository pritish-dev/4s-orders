// ============================================================
// 4S Interiors Orders — Service Worker  v44
// Cache-first for app shell & CDN assets.
// Apps Script API calls are never proxied — they go straight to the network.
// ============================================================

const CACHE  = '4s-orders-gift902';
const SHELL  = [
  '/4s-orders/',
  '/4s-orders/index.html',
  '/4s-orders/manifest.json',
  '/4s-orders/icon.svg',
];

// CDN assets we want cached for offline use
const CDN = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Force all open tabs to reload so they immediately get the new JS
        return self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.navigate(c.url))
        );
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Google Apps Script API → do NOT proxy. Let every request go straight to
  //    the network with native fetch semantics (no respondWith).
  //
  //    Why: the order-save POST relies on following a cross-origin 302 redirect
  //    (/exec → script.googleusercontent.com) that a service worker cannot
  //    reliably re-issue. The previous handler caught that failure and returned
  //    a FAKE HTTP-200 body { ok:false, error:'offline' }. That fake "success"
  //    fooled apiPost (r.ok was true, so it never threw), which defeated both
  //    its retry loop AND the offline queue, surfaced a bogus "offline" toast,
  //    and — because doSaveOrder then returned null — blocked PDF generation on
  //    submit. Passing these requests through untouched restores the exact
  //    native behaviour apiPost/apiGet expect, so retries and the offline queue
  //    work and a real network failure throws instead of masquerading as a reply.
  if (url.includes('script.google.com')) {
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

  // 4. App shell (HTML, manifest, icons) → network-first so code updates deploy immediately
  if (url.includes(self.location.origin)) {
    e.respondWith(
      fetch(e.request).then(resp => {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => caches.match(e.request))
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
      tag: data.notifId || undefined,
      // Carry the target so a tap can deep-link into the right order (see below).
      data: { orderNo: data.orderNo || '', notifId: data.notifId || '' },
    })
  );
});

// ── Notification click → reopen the app on the relevant order ──────────────
// A tapped OS notification should bring the app to the foreground and jump to
// the order it's about (falling back to the Notifications list). We focus an
// already-open window and postMessage the target to it; if no window is open we
// open one, carrying the order number in the URL hash for a cold start.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const orderNo = data.orderNo != null ? String(data.orderNo) : '';
  const base = self.registration.scope; // e.g. https://…/4s-orders/
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(base) && 'focus' in client) {
        try { await client.focus(); } catch (e) {}
        client.postMessage({ type: '4s-notif-click', orderNo });
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(base + (orderNo ? ('#notif=' + encodeURIComponent(orderNo)) : ''));
    }
  })());
});
