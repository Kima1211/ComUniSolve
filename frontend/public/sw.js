// Bump the version whenever this file's caching logic changes; old caches are deleted on activate.
const CACHE = "comunisolve-v1"
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
    self.skipWaiting()
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    )
    self.clients.claim()
})

self.addEventListener("fetch", (event) => {
    const request = event.request
    const url = new URL(request.url)

    // Only same-origin GETs. API data is never cached, so users always see live problems and solutions.
    if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
        return
    }

    // Pages: try the network first so a new deploy shows immediately; fall back to the cached app when offline.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone()
                    caches.open(CACHE).then((cache) => cache.put("/", copy))
                    return response
                })
                .catch(() => caches.match("/"))
        )
        return
    }

    // Built files have a content hash in their name, so a cached copy is always the right one.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached
            return fetch(request).then((response) => {
                if (response.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) {
                    const copy = response.clone()
                    caches.open(CACHE).then((cache) => cache.put(request, copy))
                }
                return response
            })
        })
    )
})
