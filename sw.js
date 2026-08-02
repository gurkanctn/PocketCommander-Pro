/* Pocket Commander — service worker (offline play)
 * Strategy: precache the single-file app + manifest + icons on install.
 * Navigation requests: network-first, fall back to cached index.html.
 * Static asset requests: cache-first, then network with runtime caching.
 * Versioned cache name so future updates can evict stale caches on activate.
 */
const CACHE = 'pc-rts-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon.svg',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;

    // Navigations: try network (fresh HTML), fall back to cached app for offline play
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put('./index.html', copy));
                    return res;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Static assets: cache-first with runtime backfill
    e.respondWith(
        caches.match(req).then((hit) => hit || fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
        }).catch(() => caches.match('./index.html')))
    );
});
