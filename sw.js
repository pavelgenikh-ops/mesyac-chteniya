/* Месяц чтения — работа без интернета. Версия приходит из адреса регистрации sw.js?v=…;
   страницы — сначала из сети (новая версия доходит сразу), остальное — из кэша. Сам sw.js не кэшируется. */
const V = new URL(self.location).searchParams.get('v') || 'y5jyfx';
const CORE = 'mesyac-' + V;
const FILES = [
  './', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './kompakt-style.css?v=' + V, './app.css?v=' + V,
  './js/data.js?v=' + V, './js/lessons.js?v=' + V, './js/zip.js?v=' + V, './js/books.js?v=' + V, './js/app.js?v=' + V,
  './шрифты/manrope-cyrillic-wght-normal.woff2', './шрифты/manrope-latin-wght-normal.woff2',
  './шрифты/lora-cyrillic-wght-italic.woff2', './шрифты/lora-latin-wght-italic.woff2',
  './шрифты/jetbrains-mono-cyrillic-wght-normal.woff2', './шрифты/jetbrains-mono-latin-wght-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    await Promise.allSettled(FILES.map(f => c.add(new Request(f, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  e.respondWith((async () => {
    const cache = await caches.open(CORE);
    if (isPage) {
      try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
      catch (err) { return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error(); }
    }
    const hit = await cache.match(req);
    if (hit) return hit;
    try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
    catch (err) { return (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
  })());
});
