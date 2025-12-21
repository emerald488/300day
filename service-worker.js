const CACHE_NAME = '300-challenge-v2';
const urlsToCache = [
  './challenge-tracker.html',
  './manifest.json'
];

// Установка Service Worker и кеширование файлов
self.addEventListener('install', event => {
  // Пропускаем ожидание и сразу активируемся
  self.skipWaiting();
  
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
    }).then(() => {
      // Берем контроль над всеми открытыми страницами
      return self.clients.claim();
    })
  );
});

// Перехват запросов и работа с кешем
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Запрашиваем свежую версию с сервера
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Если получили ответ, обновляем кеш
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Если сеть недоступна, используем кеш
          return response;
        });
        
        // Возвращаем из кеша если есть, иначе ждем сетевой запрос
        return response || fetchPromise;
      })
  );
});

// Уведомление клиентов о доступном обновлении
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
