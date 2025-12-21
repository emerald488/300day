const CACHE_NAME = '300-challenge-v1';
const urlsToCache = [
  './challenge-tracker.html',
  './manifest.json'
];

// Установка Service Worker и кеширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кеш открыт');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляем старый кеш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов и работа с кешем
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем из кеша если есть, иначе делаем сетевой запрос
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
