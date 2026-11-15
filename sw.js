const CACHE = 'ambrosia-shell-v3-ari-phase1-1';
const SHELL = [
  "/",
  "/index.html",
  "/css/main.css",
  "/css/product.css",
  "/css/design-system.css",
  "/css/onboarding.css",
  "/js/ui/ari-assets.js",
  "/js/ui/components.js",
  "/js/ui/illustration.js",
  "/js/ui/theme.js",
  "/js/onboarding/copy.js",
  "/js/account-access.js",
  "/js/platform.js",
  "/js/download.js",
  "/js/billing/client.js",
  "/js/billing/model.js",
  "/js/billing/copy.js",
  "/js/account-management.js",
  "/js/app.js",
  "/js/cloud-import.js",
  "/js/cloud-restore.js",
  "/js/companion/store.js",
  "/js/companion/ui.js",
  "/js/config.js",
  "/js/data.js",
  "/js/i18n.js",
  "/js/modal.js",
  "/js/navigation.js",
  "/js/premium.js",
  "/js/screens/ai.js",
  "/js/screens/checkin.js",
  "/js/screens/episode.js",
  "/js/screens/history.js",
  "/js/screens/home.js",
  "/js/screens/log.js",
  "/js/screens/onboarding.js",
  "/js/screens/settings.js",
  "/js/screens/upgrade.js",
  "/js/security-copy.js",
  "/js/state.js",
  "/js/supabase-auth.js",
  "/js/supabase-client.js",
  "/js/sync/copy.js",
  "/js/sync/engine.js",
  "/js/sync/runtime.js",
  "/js/sync/store.js",
  "/js/utils/escape.js",
  "/js/wellness/charts.js",
  "/js/wellness/context.js",
  "/js/wellness/copy.js",
  "/js/wellness/dom.js",
  "/js/wellness/model.js"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ambrosia-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const art=/^\/assets\/brand\/ari\/v1\/illustrations\/ill-[a-z0-9-]+\.png$/.test(url.pathname);
  const font=/^\/assets\/fonts\/nunito-sans-[a-z-]+\.woff2$/.test(url.pathname);
  if(event.request.method==='GET' && url.origin===self.location.origin && (art||font)){
    // Cache only art/fonts actually requested by a visible screen, never all PNGs at install.
    event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(event.request);if(saved)return saved;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}));return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // One version of the complete shell per worker; updates activate after old tabs close.
    const saved = await cache.match(url.pathname);
    return saved || fetch(event.request);
  }));
});
