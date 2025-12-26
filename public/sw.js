self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('mc-store').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/src/main.ts',
      '/src/style.css',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
