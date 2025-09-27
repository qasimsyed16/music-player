/**
 * Service Worker for My Music Player
 * Provides offline functionality and caching for better performance
 */

const CACHE_NAME = 'music-player-v1.0.0';
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install event');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Failed to cache static assets', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activate event');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old cache versions
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Old caches cleaned up');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match('/')
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request);
                })
                .catch(() => {
                    // Return offline page if available
                    return caches.match('/');
                })
        );
        return;
    }
    
    // Handle static assets (CSS, JS, images)
    if (STATIC_CACHE_URLS.some(cachedUrl => request.url.includes(cachedUrl))) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log('Service Worker: Serving cached asset:', request.url);
                        return cachedResponse;
                    }
                    
                    // If not in cache, fetch and cache it
                    return fetch(request)
                        .then((response) => {
                            // Only cache successful responses
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(request, responseClone);
                                    });
                            }
                            return response;
                        })
                        .catch((error) => {
                            console.error('Service Worker: Failed to fetch asset:', request.url, error);
                        });
                })
        );
        return;
    }
    
    // Handle music files - use cache-first strategy for better performance
    // Support API streaming endpoint and direct file URLs
    if (request.url.includes('/api/music/file') ||
        request.url.includes('/storage/shared/Music/') || 
        request.url.includes('.mp3') || 
        request.url.includes('.flac') || 
        request.url.includes('.wav') ||
        request.url.includes('.m4a') ||
        request.url.includes('.ogg')) {
        
        event.respondWith(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                console.log('Service Worker: Serving cached music file:', request.url);
                                return cachedResponse;
                            }
                            
                            // If not cached, fetch it
                            return fetch(request)
                                .then((response) => {
                                    // Cache music files for offline playback
                                    // Note: Only cache if response is successful and not too large
                                    const lenHeader = response.headers.get('content-length')
                                    const sizeOk = !lenHeader || parseInt(lenHeader, 10) <= 50 * 1024 * 1024
                                    if (response.status === 200 && sizeOk) { // ~50MB limit when known
                                        const responseClone = response.clone();
                                        cache.put(request, responseClone);
                                    }
                                    return response;
                                })
                                .catch((error) => {
                                    console.error('Service Worker: Failed to fetch music file:', error);
                                    throw error;
                                });
                        });
                })
        );
        return;
    }
    
    // Handle API requests
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful API responses for offline access
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached API response if available
                    return caches.match(request);
                })
        );
        return;
    }
    
    // For all other requests, use network-first strategy
    event.respondWith(
        fetch(request)
            .catch(() => {
                return caches.match(request);
            })
    );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync event', event.tag);
    
    if (event.tag === 'playlist-sync') {
        event.waitUntil(
            syncPlaylists()
        );
    }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New music available!',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [200, 100, 200],
        tag: 'music-notification',
        actions: [
            {
                action: 'play',
                title: 'Play',
                icon: '/play-icon.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('My Music Player', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event.action);
    
    event.notification.close();
    
    if (event.action === 'play') {
        // Open the app and start playing
        event.waitUntil(
            clients.openWindow('/?action=play')
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle message events from the main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'CACHE_MUSIC':
                cacheMusicFile(event.data.url);
                break;
            case 'CLEAR_CACHE':
                clearCache();
                break;
            case 'GET_CACHE_SIZE':
                getCacheSize().then(size => {
                    event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
                });
                break;
        }
    }
});

/**
 * Sync playlists when back online
 */
async function syncPlaylists() {
    try {
        console.log('Service Worker: Syncing playlists...');
        
        // Get stored sync data
        const cache = await caches.open(CACHE_NAME);
        const syncData = await cache.match('/sync-data');
        
        if (syncData) {
            const data = await syncData.json();
            
            // Send sync data to server
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                // Remove sync data after successful sync
                await cache.delete('/sync-data');
                console.log('Service Worker: Playlist sync completed successfully');
            }
        }
    } catch (error) {
        console.error('Service Worker: Playlist sync failed', error);
    }
}

/**
 * Cache a specific music file
 */
async function cacheMusicFile(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(url);
        
        if (response.ok) {
            await cache.put(url, response);
            console.log('Service Worker: Music file cached successfully', url);
        }
    } catch (error) {
        console.error('Service Worker: Failed to cache music file', url, error);
    }
}

/**
 * Clear all cached data
 */
async function clearCache() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Service Worker: All caches cleared');
    } catch (error) {
        console.error('Service Worker: Failed to clear cache', error);
    }
}

/**
 * Get total cache size
 */
async function getCacheSize() {
    try {
        let totalSize = 0;
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
        
        return totalSize;
    } catch (error) {
        console.error('Service Worker: Failed to calculate cache size', error);
        return 0;
    }
}

/**
 * Periodic background tasks
 */
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync event', event.tag);
    
    if (event.tag === 'music-library-update') {
        event.waitUntil(updateMusicLibrary());
    }
});

/**
 * Update music library in background
 */
async function updateMusicLibrary() {
    try {
        console.log('Service Worker: Updating music library...');
        
        const response = await fetch('/api/music/scan');
        if (response.ok) {
            const newSongs = await response.json();
            
            // Send update to all open tabs
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'LIBRARY_UPDATED',
                    songs: newSongs
                });
            });
            
            console.log('Service Worker: Music library updated successfully');
        }
    } catch (error) {
        console.error('Service Worker: Failed to update music library', error);
    }
}