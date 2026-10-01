// Bump the version whenever this file's caching logic changes; old caches are deleted on activate.
const CACHE = "comunisolve-v2"
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
    // One file failing must not stop the new version from installing.
    event.waitUntil(
        caches.open(CACHE).then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {}))))
    )
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
                // Vercel answers a missing file with index.html (status 200). Caching that under a .js name
                // would serve HTML as JavaScript on every later visit: a blank page.
                const isHtml = (response.headers.get("content-type") || "").includes("text/html")
                if (response.ok && !isHtml && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) {
                    const copy = response.clone()
                    caches.open(CACHE).then((cache) => cache.put(request, copy))
                }
                return response
            })
        })
    )
})
