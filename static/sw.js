// Minimal service worker, mainly to satisfy PWA installability requirements
// (Chrome/Android want an active service worker with a fetch handler).
//
// Deliberately does NOT cache dashboard/history/compare pages or API
// responses: this app shows live sensor readings, and silently serving a
// cached (stale) temperature/CO2 reading while offline would be actively
// misleading, not helpful. If you're offline, you should see that clearly
// rather than an old number that looks current.
//
// Only the static app shell (icons, manifest) gets cached, purely so the
// installed app icon/name render correctly even with a flaky connection.

const CACHE_NAME = 'homepulse-shell-v1';
const SHELL_ASSETS = [
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only intercept the specific shell assets - everything else (pages,
	// /api/* calls) goes straight to the network, untouched, every time.
	if (SHELL_ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => cached || fetch(event.request))
		);
	}
});
