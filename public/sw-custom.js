/**
 * MamiApp PWA service worker — v16
 *
 * Strategii de caching:
 *
 * - Install: skipWaiting() imediat → SW preia controlul fără să aștepte
 * - Activate: curăță doar cache-urile mamiapp-*, claimează clienții, trimite SW_ACTIVATED
 * - JS bundle-uri → network-first cu validare Content-Type (502/504 la eroare)
 * - Assets statice → cache-first immutable
 * - HTML navigare → network-first (mereu fresh)
 *
 * Fluxul de actualizare (automat, silențios):
 *   1. Browser detectează sw-custom.js nou (updateViaCache: 'none')
 *   2. Noul SW instalează → skipWaiting() → activează imediat
 *   3. Cache-urile vechi sunt șterse, v15 create
 *   4. SW trimite SW_ACTIVATED → _layout.tsx reîncarcă pagina (cu dedup 60s)
 *   5. Utilizatorul vede versiunea nouă fără să facă nimic
 */

const CACHE_VERSION = 'v16';
const STATIC_CACHE  = `mamiapp-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mamiapp-runtime-${CACHE_VERSION}`;


const JS_BUNDLE_RE       = /\.js(\?.*)?$/i;
const IMMUTABLE_ASSET_RE = /\/(?:assets\/).*\.(?:png|jpg|jpeg|webp|svg|woff2?|ico)$/i;
const IMMUTABLE_EXPO_RE  = /\/_expo\/static\/(?:css|media|fonts)\//i;

let firebaseMessaging = null;

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey:            'YOUR_FIREBASE_WEB_API_KEY',
    authDomain:        'your-firebase-project.firebaseapp.com',
    projectId:         'your-firebase-project',
    storageBucket:     'your-firebase-project.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId:             '1:000000000000:web:YOUR_WEB_APP_ID',
  };
  // Configure these placeholders for your own Firebase project.
  if (firebaseConfig.apiKey === 'YOUR_FIREBASE_WEB_API_KEY') throw new Error('Firebase push is not configured');
  firebase.initializeApp(firebaseConfig);

  firebaseMessaging = firebase.messaging();
} catch (error) {
  console.warn('[MamiApp SW] Firebase Messaging unavailable:', error);
}

// ─── Install: activare imediată ───────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());

async function clearMamiCaches() {
  const names = await caches.keys();
  await Promise.all(
    names.map((name) => {
      if (name.startsWith('mamiapp-')) return caches.delete(name);
      return undefined;
    })
  );
}

// ─── Mesaje din aplicație ─────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(clearMamiCaches());
    return;
  }
  if (event.data.type === 'GET_SW_VERSION') {
    const payload = { type: 'SW_VERSION', version: CACHE_VERSION };
    if (event.ports?.[0]) {
      event.ports[0].postMessage(payload);
      return;
    }
    event.source?.postMessage?.(payload);
  }
});

// ─── Activate: curăță cache-urile vechi, notifică app ────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Șterge doar cache-urile acestei aplicații (prefix mamiapp-) care nu mai sunt necesare
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(
      names.map((n) => {
        if (n.startsWith('mamiapp-') && !keep.has(n)) return caches.delete(n);
        return undefined;
      })
    );

    // Preia controlul paginilor deschise
    await self.clients.claim();

    // Notifică și reîncarcă toate tab-urile/PWA-urile controlate ca să primească bundle-ul nou.
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map(async (c) => {
      c.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
      c.postMessage({ type: 'MAMI_NEW_BUILD', version: CACHE_VERSION });
      try {
        await c.navigate(c.url);
      } catch { /* client may not support navigate */ }
    }));
  })());
});

// ─── Strategii de caching ─────────────────────────────────────────────────────

function isJavaScriptResponse(response) {
  const ct = response.headers.get('Content-Type') || '';
  return ct.includes('javascript') || ct.includes('octet-stream');
}

/** Network-first pentru HTML (mereu fresh) */
async function networkFirstHTML(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      return response;
    }
  } catch { /* fall through to cache */ }

  const cached = await cache.match(request);
  if (cached) return cached;

  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>MamiApp</title></head>' +
    '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
    'min-height:100vh;background:#FDF6F0;margin:0;flex-direction:column;gap:16px;">' +
    '<div style="font-size:48px">🌸</div>' +
    '<p style="font-size:18px;font-weight:700;color:#1E2A4A">Ești offline</p>' +
    '<p style="font-size:14px;color:#888">Conectează-te la internet și reîncarcă pagina.</p>' +
    '</body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** Network-first pentru JS cu validare Content-Type */
async function networkFirstJS(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && isJavaScriptResponse(response)) {
      await cache.put(request, response.clone());
      return response;
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', {
      status: 502,
      statusText: 'Invalid JavaScript response',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', {
      status: 504,
      statusText: 'JavaScript bundle unavailable offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Network-first generic */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Offline — nu există cached response pentru: ' + request.url);
  }
}

/** Cache-first pentru assets immutable */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// ─── Fetch handler ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstHTML(request, RUNTIME_CACHE));
    return;
  }

  if (JS_BUNDLE_RE.test(url.pathname) && request.destination !== 'document') {
    event.respondWith(networkFirstJS(request, RUNTIME_CACHE));
    return;
  }

  if (
    IMMUTABLE_ASSET_RE.test(url.pathname) ||
    IMMUTABLE_EXPO_RE.test(url.pathname) ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// ─── Notificări push ──────────────────────────────────────────────────────────

function getFirebaseActions(type) {
  switch (type) {
    case 'vaccine_reminder':
      return [{ action: 'open_vaccines', title: 'Vezi calendar' }];
    case 'daily_summary':
      return [{ action: 'open_home', title: 'Vezi rezumatul' }];
    case 'admin_campaign':
      return [{ action: 'open_app', title: 'Deschide MamiApp' }];
    case 'community_reply':
      return [{ action: 'open_community', title: 'Vezi raspunsul' }];
    default:
      return [];
  }
}

if (firebaseMessaging) {
  firebaseMessaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    // Serverul trimite mesaje data-only (title/body în `data`) ca browserul să nu
    // afișeze automat o a doua notificare — SW-ul e singurul care o afișează.
    // payload.notification rămâne ca fallback pentru mesaje vechi aflate în tranzit.
    const title = data.title || (payload.notification && payload.notification.title);
    const body = data.body || (payload.notification && payload.notification.body);

    self.registration.showNotification(title || 'MamiApp', {
      body: body || '',
      icon: '/assets/pwa-icon-512.png',
      badge: '/assets/notification-icon.png',
      tag: data.type || 'mamiapp',
      renotify: true,
      data,
      actions: getFirebaseActions(data.type),
      vibrate: [200, 100, 200],
    });
  });
}

function getFirebaseTargetPath(action, data) {
  if (action === 'open_vaccines' || data.screen === '/modules/vaccines') {
    return '/modules/vaccines';
  }
  if (action === 'open_home' || data.type === 'daily_summary') {
    return '/';
  }
  if (action === 'open_community' || data.type === 'community_reply') {
    return data.postId ? `/modules/community/post/${data.postId}` : '/modules/community';
  }
  if (data.screen) return data.screen;
  return '/';
}

async function focusOrOpenClient(message, targetPath) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientList) {
    client.postMessage(message);
    if ('focus' in client) await client.focus();
    return;
  }

  if (self.clients.openWindow) {
    // Fereastră nouă: main thread-ul nu are încă listener de postMessage montat
    // (pagina abia pornește să se încarce) — mesajul s-ar pierde. Trimitem logId
    // și prin query string, citit la boot de _layout.tsx, ca fallback fiabil.
    const logId = message.data && message.data.logId;
    const url = logId
      ? `${targetPath}${targetPath.includes('?') ? '&' : '?'}notif_log=${encodeURIComponent(logId)}`
      : targetPath;
    const client = await self.clients.openWindow(url);
    client?.postMessage?.(message);
  }
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  const action = event.action || 'open';
  event.notification.close();

  event.waitUntil((async () => {
    if (data.timerId || data.timerType || action.startsWith('MAMI_TIMER_')) {
      await focusOrOpenClient({
        type: 'MAMI_TIMER_NOTIFICATION_ACTION',
        action,
        timerId: data.timerId,
        timerType: data.timerType,
      }, '/');
      return;
    }

    const targetPath = getFirebaseTargetPath(action, data);
    await focusOrOpenClient({ type: 'MAMI_PUSH_NAVIGATE', path: targetPath, data }, targetPath);
  })());
});
