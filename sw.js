// StonesCamperApp Service Worker
// Version hochzählen bei jedem Deploy um Cache zu invalidieren
var CACHE_NAME = 'stonescamperapp-v1';
var CACHE_FILES = [
  './',
  './index.html',
  './favicon.png'
];

// Installation: App-Shell cachen
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_FILES);
    })
  );
});

// Aktivierung: Alten Cache löschen
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network First für index.html, Cache First für den Rest
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Firebase und GitHub API immer frisch laden (kein Cache)
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('api.github.com') ||
      url.hostname.includes('cdnjs')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // index.html: Network First (immer neueste Version)
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          // Neue Version cachen
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(function() {
          // Offline: Cache verwenden
          return caches.match(e.request);
        })
    );
    return;
  }

  // PDFs und andere Dateien: Cache First
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return response;
      });
    })
  );
});

// skipWaiting auf Nachricht vom Client
self.addEventListener('message', function(e) {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
