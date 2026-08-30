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

const CACHE = 'auctionbook-v14';

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
  'assets/js/avatars.js',
  'assets/js/competitions.js',
  'assets/js/judging.js',
  'assets/js/ownerpack.js',
  'assets/js/auctioneer.js',
  'assets/js/flex.js',
  'assets/js/qrsheet.js',
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
  // Deliberately no clients.claim(): a page that already loaded its modules
  // from the previous version must not have a newer worker take over
  // mid-session, or it ends up running a mix of two builds. The new worker
  // takes charge on the next load, when everything comes from one version.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
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

      // The page itself goes network-first. Serving a cached index.html while
      // the modules beside it were refreshed is how you end up running half of
      // one build and half of another; the page is small, so the round trip is
      // cheap, and offline still falls through to the cache below.
      if (req.mode === 'navigate') {
        const fresh = await network;
        if (fresh) return fresh;
        if (cached) return cached;
      } else if (cached) {
        return cached;                               // instant, then refreshed above
      }

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
