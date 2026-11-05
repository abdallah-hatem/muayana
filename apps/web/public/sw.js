/*
 * Muayana service worker: keeps the app shell so /capture opens with no signal (business §5.1).
 * It caches pages' HTML (network first) and Next's hashed static files (cache first) — never API
 * data: /api/* always goes to the network. Offline, any page falls back to the cached /capture.
 */
const VERSION = 'v1';
const SHELL_CACHE = `muayana-shell-${VERSION}`;
const STATIC_CACHE = `muayana-static-${VERSION}`;
const OFFLINE_PAGE = '/capture';
const PRECACHE = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const sameOrigin = (url) => url.origin === self.location.origin;
const isStatic = (url) => url.pathname.startsWith('/_next/static/');
const isApi = (url) => url.pathname.startsWith('/api/');
/** RSC payloads of client-side navigations: never cached (they change with the session). */
const isRsc = (request, url) =>
  request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');

/** A response we may keep: a real 200 for this URL, not the login page we were redirected to. */
const cacheable = (response) =>
  response && response.ok && !response.redirected && response.type === 'basic';

async function cacheStaticUrls(urls) {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetch(url);
        if (cacheable(response)) await cache.put(url, response);
      } catch {
        // Offline or gone: the next online visit fills it in.
      }
    }),
  );
}

/** Fetches /capture and the static files its HTML points at. */
async function precacheCapture() {
  try {
    const response = await fetch(OFFLINE_PAGE, { credentials: 'same-origin' });
    if (!cacheable(response)) return;
    const html = await response.clone().text();
    await (await caches.open(SHELL_CACHE)).put(OFFLINE_PAGE, response);
    const urls = [
      ...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []),
    ];
    await cacheStaticUrls(urls);
  } catch {
    // Signed out or offline at install: cached on the next online visit to /capture.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      );
      await precacheCapture();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      for (const key of await caches.keys())
        if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      cacheStaticUrls(event.data.urls.filter((u) => typeof u === 'string')),
    );
  }
});

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (url.pathname === OFFLINE_PAGE && cacheable(response)) {
      await (
        await caches.open(SHELL_CACHE)
      ).put(OFFLINE_PAGE, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_PAGE)) ?? Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function shellFile(request) {
  try {
    return await fetch(request);
  } catch {
    return (
      (await (await caches.open(SHELL_CACHE)).match(request)) ??
      Response.error()
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameOrigin(url) || isApi(url) || isRsc(request, url)) return;

  if (request.mode === 'navigate') event.respondWith(networkFirstPage(request));
  else if (isStatic(url)) event.respondWith(cacheFirstStatic(request));
  else if (PRECACHE.includes(url.pathname))
    event.respondWith(shellFile(request));
});
