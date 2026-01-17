// Service Worker für Offline-Funktionalität
const CACHE_NAME = 'callroom-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './fencers.xml'
];

// Install: Cache alle wichtigen Dateien
self.addEventListener('install', event => {
    console.log('Service Worker: Install-Event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache geöffnet');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: Alte Caches löschen und Claims
self.addEventListener('activate', event => {
    console.log('Service Worker: Activate-Event');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if(cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Alte Cache gelöscht:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-first, dann Cache fallback
self.addEventListener('fetch', event => {
    const { request } = event;
    
    // Ignoriere fremde Requests
    if(!request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        fetch(request)
            .then(response => {
                // Erfolgreiche Response: In Cache speichern
                if(response.ok) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fehler/Offline: Aus Cache laden
                return caches.match(request)
                    .then(response => {
                        if(response) {
                            console.log('Service Worker: Cache hit für', request.url);
                            return response;
                        }
                        // Fallback für nicht gecachte Seiten
                        if(request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});
