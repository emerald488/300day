const CACHE_NAME = '300-challenge-v11';
const urlsToCache = [
  './challenge-tracker.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './icon-192.png',
  './icon-512.png'
];

// Установка Service Worker и кеширование файлов
self.addEventListener('install', event => {
  // Сразу активируем новую версию
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кеш открыт, новая версия установлена');
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
    }).then(() => {
      // Берем контроль над всеми открытыми страницами
      return self.clients.claim();
    })
  );
});

// Перехват запросов и работа с кешем
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Для HTML, CSS, JS используем Network First (всегда пытаемся получить свежую версию)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Обновляем кеш свежей версией
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Если сеть недоступна, используем кеш
          return caches.match(event.request);
        })
    );
  } else {
    // Для остальных файлов (картинки, шрифты) используем Cache First
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          });
        })
    );
  }
});
