var CACHE_NAME = 'v1';
var cacheFiles = [
    './',
    './index.html',
    './css/styles.css',
    './manifest.json',
    './js/app.js',
    './img/furina.jpg',
    './img/icono.ico',
    './img/logo.png',
    './img/sticker_5.png'
];

//metodo de instalacion del sw e inicia la cache y muestra los archivos que no se pudieron instalar
self.addEventListener('install', function(e) {
    console.log('Service Worker: Instalando...');
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(async function(cache) {
                console.log('Service Worker: Caché abierto', CACHE_NAME);
                return Promise.all(
                    cacheFiles.map(async (file) => {
                        try {
                            const response = await fetch(file);
                            if (!response.ok) throw new Error('Error ${response.status} en ${file}');
                            await cache.put(file, response);
                            console.log('Cacheado: ${file}');
                        } catch (error) {
                            console.error('No se pudo cachear: ${file}', error);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Todos los archivos procesados');
                self.skipWaiting();
            })
            .catch(err => {
                console.error('Service Worker: Error al abrir la caché', err);
            })
    );
});

//metodo para activar el sw y elimina las cache antiguas
self.addEventListener('activate', function(e) {
    console.log('Service Worker: Activado');
    e.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(thisCacheName) {
                    if (thisCacheName !== CACHE_NAME) {
                        console.log('Service Worker: Cache viejo eliminado', thisCacheName);
                        return caches.delete(thisCacheName);
                    }
                })
            );
        })
    );
});

//recibe las solicitudes y las responde desde la cache
self.addEventListener('fetch', function(e) {
    console.log('Service Worker: Fetching', e.request.url);

    e.respondWith(
        caches.match(e.request).then(function(response) {
            if (response) {
                console.log('Cache encontrada', e.request.url);
                return response;
            }
            return fetch(e.request).then(function(networkResponse) {
                return caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(e.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(function(err) {
                console.log('Error al hacer fetch', err);
            });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification("Furina's Melodic Waves", {
    body: "¡El gran juicio musical de Fontaine ha comenzado! ¿Estás listo para el espectáculo?",
            icon: "./img/sticker_5.png"
        });
    }
});