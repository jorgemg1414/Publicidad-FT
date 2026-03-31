const CACHE_NAME = 'publicidad-images-v1'
const TIMESTAMPS_CACHE = 'publicidad-timestamps-v1'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 horas en ms

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== TIMESTAMPS_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  const isSupabaseImage =
    url.hostname.includes('supabase') && url.pathname.includes('/storage/')

  if (!isSupabaseImage) return

  event.respondWith(handleImageRequest(request))
})

async function handleImageRequest(request) {
  const [imageCache, tsCache] = await Promise.all([
    caches.open(CACHE_NAME),
    caches.open(TIMESTAMPS_CACHE),
  ])

  const cached = await imageCache.match(request)

  if (cached) {
    const tsResponse = await tsCache.match(request.url)
    const timestamp = tsResponse ? parseInt(await tsResponse.text()) : 0
    const isExpired = Date.now() - timestamp > CACHE_DURATION

    if (!isExpired) {
      // Devolver caché inmediatamente y actualizar en segundo plano
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await imageCache.put(request, response)
            await tsCache.put(request.url, new Response(Date.now().toString()))
          }
        })
        .catch(() => {})
      return cached
    }
  }

  // Sin caché o expirado: traer de la red
  try {
    const response = await fetch(request)
    if (response.ok) {
      await imageCache.put(request, response.clone())
      await tsCache.put(request.url, new Response(Date.now().toString()))
    }
    return response
  } catch {
    if (cached) return cached
    throw new Error('Sin conexión y sin caché disponible')
  }
}
