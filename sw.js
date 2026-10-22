/* ============================================================
   Service Worker — تحقیق‌یار (PWA)
   آدرس سایت:
   https://mehradkhaliliparsa6490-max.github.io/tahgig/
   
   ⚠️ هر بار که index.html را تغییر دادی، VERSION را عوض کن:
   مثلاً v1.0.0 → v1.0.1
============================================================ */

const VERSION = 'v1.0.0';
const STATIC_CACHE  = 'tahgig-static-'  + VERSION;
const RUNTIME_CACHE = 'tahgig-runtime-' + VERSION;

/* فایل‌هایی که همیشه باید آفلاین در دسترس باشند */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  /* CDN ها */
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

/* دامنه‌هایی که فقط آنلاین جواب می‌دهند (آفلاین کار نمی‌کنند) */
const NETWORK_ONLY_HOSTS = [
  'fa.wikipedia.org',
  'en.wikipedia.org',
  'api.duckduckgo.com',
  'api.mymemory.translated.net',
  'api.allorigins.win',
  'html.duckduckgo.com'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) => {
          const req = new Request(url, { cache: 'reload' });
          return cache.add(req).catch((err) => {
            console.warn('[SW] precache failed:', url, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k.startsWith('tahgig-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // فقط GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // فقط http/https
  if (!url.protocol.startsWith('http')) return;

  /* ۱) Navigation (بارگذاری صفحه) — network-first */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached ||
            caches.match('./index.html') ||
            caches.match('./')
          )
        )
    );
    return;
  }

  /* ۲) API ها — فقط آنلاین */
  if (NETWORK_ONLY_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  /* ۳) بقیه فایل‌های استاتیک — cache-first + آپدیت پس‌زمینه */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // آپدیت پس‌زمینه (best-effort)
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, res)).catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch((err) => {
          // فونت‌ها در آفلاین نباید کل صفحه را بشکنند
          if (req.destination === 'font') {
            return new Response('', { status: 204 });
          }
          throw err;
        });
    })
  );
});

/* ---------- MESSAGE (برای آپدیت دستی) ---------- */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
});