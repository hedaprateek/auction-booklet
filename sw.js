// Offline support. The tool is entirely static, so everything it needs can be
// cached on first visit — after that it opens with no connection at all, which
// is what you want at a ground with no signal.
//
// Strategy: stale-while-revalidate. A cached response is served immediately and
// refreshed in the background, so the app is instant and still picks up new
// versions on the next load.
//
// scripts/selftest.mjs asserts this list covers every asset the page loads, so
// a new module can't quietly break offline mode.

const CACHE = 'auctionbook-v3';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/css/booklet.css',
  'assets/js/main.js',
  'assets/js/parse.js',
  'assets/js/mapping.js',
  'assets/js/presets.js',
  'assets/js/render.js',
  'assets/js/export.js',
  'assets/js/images.js',
  'assets/js/format.js',
  'assets/js/teams.js',
  'assets/js/formbuilder.js',
  'assets/js/liveboard.js',
  'assets/js/sample-data.js',
  'assets/vendor/xlsx.full.min.js',
  'assets/vendor/qrcode.mjs',
  'sample/sample-cricket.xlsx',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll is all-or-nothing; one 404 would leave the app with no cache at
      // all, so each file is added on its own and failures are tolerated.
      .then(cache => Promise.all(PRECACHE.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch third parties

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) return cached;                     // instant, then refreshed above
      const fresh = await network;
      if (fresh) return fresh;

      // Offline and never cached: for a page request, fall back to the app shell.
      if (req.mode === 'navigate') {
        return (await cache.match('index.html')) || (await cache.match('./'))
          || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});
