const CACHE_NAME = '300-challenge-v41';
const urlsToCache = [
  './challenge-tracker.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/stories-data.js',
  './js/charts.js',
  './icon-192.png',
  './icon-512.png',
  // Кешируем внешние зависимости для офлайн и быстрого старта
  'https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css'
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

  // Игнорируем запросы к service worker
  if (url.pathname.includes('service-worker.js')) {
    return;
  }

  // Игнорируем внешние запросы (кроме CDN с ресурсами)
  const isCDNResource = url.hostname.includes('cdn.jsdelivr.net') ||
                        url.hostname.includes('unpkg.com');

  if (!url.origin.includes(self.location.origin) && !isCDNResource) {
    return;
  }

  // СТРАТЕГИЯ: Cache First с фоновым обновлением (stale-while-revalidate)
  // Мгновенная загрузка из кеша + обновление в фоне
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Запускаем фоновое обновление
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Обновляем кеш свежей версией в фоне
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => null); // Игнорируем ошибки сети в фоновом режиме

        // Возвращаем кеш СРАЗУ (если есть), иначе ждем сеть
        return cachedResponse || fetchPromise;
      })
  );
});
