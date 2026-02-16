const CACHE_NAME = 'mtn-queue-v2.2'
const STATIC_CACHE = [
  '/',
  '/static/app.js',
  '/static/style.css',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js'
]

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache ouvert')
      return cache.addAll(STATIC_CACHE).catch(err => {
        console.log('[SW] Erreur cache:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Stratégie de cache : Network First, puis Cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return
  
  // Ignorer les requêtes vers d'autres domaines (sauf CDN)
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin && 
      !url.host.includes('cdn') && 
      !url.host.includes('jsdelivr') && 
      !url.host.includes('cloudflare')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cloner la réponse car elle ne peut être consommée qu'une fois
        const responseClone = response.clone()
        
        // Mettre en cache uniquement les réponses réussies
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        
        return response
      })
      .catch(() => {
        // En cas d'échec réseau, essayer le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          
          // Page hors ligne par défaut
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
          
          return new Response('Contenu non disponible hors ligne', {
            status: 503,
            statusText: 'Service Unavailable'
          })
        })
      })
  )
})

// Gestion des messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
