// Bump CACHE when sw.js, an icon or theme-init.js changes: they keep their names and are served cache-first.
const CACHE = "comunisolve-v6"
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/favicon-48.png", "/icons/logo-128.png", "/icons/logo-dark-128.png", "/icons/icon-192.png", "/icons/icon-512.png", "/theme-init.js"]

self.addEventListener("install", (event) => {
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

    // API data is never cached.
    if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
        return
    }

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

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached
            return fetch(request).then((response) => {
                // Vercel answers a missing file with index.html; caching that as .js would blank the page.
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
