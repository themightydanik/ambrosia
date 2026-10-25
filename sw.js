const CACHE = 'ambrosia-shell-sync-v2-2';
const SHELL = [
  "/",
  "/index.html",
  "/css/main.css",
  "/js/app.js",
  "/js/cloud-import.js",
  "/js/cloud-restore.js",
  "/js/config.js",
  "/js/data.js",
  "/js/i18n.js",
  "/js/modal.js",
  "/js/navigation.js",
  "/js/premium.js",
  "/js/screens/ai.js",
  "/js/screens/history.js",
  "/js/screens/home.js",
  "/js/screens/log.js",
  "/js/screens/onboarding.js",
  "/js/screens/settings.js",
  "/js/screens/upgrade.js",
  "/js/state.js",
  "/js/supabase-auth.js",
  "/js/supabase-client.js",
  "/js/sync/copy.js",
  "/js/sync/engine.js",
  "/js/sync/runtime.js",
  "/js/sync/store.js",
  "/js/utils/escape.js"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ambrosia-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // One version of the complete shell per worker; updates activate after old tabs close.
    const saved = await cache.match(url.pathname);
    return saved || fetch(event.request);
  }));
});
