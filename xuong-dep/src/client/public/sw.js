// Caches the app shell only. Never caches /api, /img or quote pages (/q/).
const CACHE = 'xuong-dep-%VERSION%';
const SHELL = ['/quan-ly', '%CSS%', '%ADMIN_JS%', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/img') || url.pathname.startsWith('/q/')) return;
  if (url.pathname === '/quan-ly') {
    // Network first for the admin page, cached shell when offline. Other pages are not handled here.
    e.respondWith(fetch(e.request).catch(() => caches.match('/quan-ly')));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
