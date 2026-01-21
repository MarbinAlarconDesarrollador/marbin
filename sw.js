const CACHE_NAME = 'mahjong-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './img/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos un bucle para que si un archivo falla, no rompa todo
      return Promise.all(
        ASSETS.map(url => {
          return cache.add(url).catch(err => console.log("Fallo al cargar:", url));
        })
      );
    })
  );
});