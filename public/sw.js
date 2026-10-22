const STATIC_CACHE = 'photobooth-static-v3'

// Caches created by this app, including the pre-rebrand name, so activation can
// drop stale artwork without touching other caches on the same github.io origin.
const OWN_CACHE_PREFIXES = ['photobooth-static-', 'btmt-photobooth-static-']

const PRECACHE_ASSETS = [
  'images/illustrations/camera.svg',
  'images/layouts/preview-grid-2x2.svg',
  'images/layouts/preview-stack-4.svg',
  'images/layouts/preview-grid-2x3.svg',
  'images/logos/photobooth-mark.svg',
]

function getScopedAssetUrl(path) {
  return new URL(path, self.registration.scope).toString()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_ASSETS.map((path) => cache.add(getScopedAssetUrl(path))),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== STATIC_CACHE &&
                OWN_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  const isStaticImageAsset =
    /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(url.pathname)

  if (!isStaticImageAsset) {
    return
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(request, { ignoreSearch: true })

      if (cachedResponse) {
        return cachedResponse
      }

      const networkResponse = await fetch(request)

      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }

      return networkResponse
    }),
  )
})
