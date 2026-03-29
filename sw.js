// Service Worker für Offline-Funktionalität
const CACHE_NAME = 'callroom-v1';


// Liste der Dateien, die zwischengespeichert werden sollen

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './fencers.xml'
];

/**
 * INSTALL EVENT
 * Wird ausgelöst, wenn der Service Worker zum ersten Mal registriert wird
 * Hier laden wir alle wichtigen Dateien in den Cache
 */
self.addEventListener('install', event => {
    console.log('Service Worker: Install-Event');
    
    // waitUntil: Warte bis dieser Code fertig ist, bevor du den Service Worker aktivierst
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache geöffnet');
                return cache.addAll(urlsToCache);
            })
            // skipWaiting: Aktiviere service worker sofort, nicht erst beim nächsten Seite-Refresh
            .then(() => self.skipWaiting())
    );
});

/**
 * ACTIVATE EVENT
 * Wird ausgelöst, wenn der Service Worker aktiviert wird
 * Hier können wir alte Version-Caches löschen
 */
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
        }).then(() => self.clients.claim()) // Kontrolliere alle Clients sofort
    );
});

/**
 * FETCH EVENT
 * Wird für jeden HTTP-Request ausgelöst (wenn die App Dateien vom Server anfordert)
 * Hier implementieren wir die Strategie: "Network First, Cache Fallback"
 * = Versuche zuerst vom Internet zu laden, bei Fehler nutze Cache
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    
    // Ignoriere Requests von fremden Websites (nur eigen Domain cachen)
    if(!request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        // Versuche den Request übers Netz zu laden
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
                // FEHLER oder OFFLINE: Versuche aus dem Cache zu laden
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
