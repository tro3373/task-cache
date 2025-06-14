const CACHE_NAME = 'tasksync-v1';
const urlsToCache = [
  '/',
  '/offline',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Background sync for task updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // Sync logic will be implemented in the app
  console.log('Background sync triggered');
}