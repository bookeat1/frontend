/*
 * BookEat admin panel — service worker for web-push notifications.
 *
 * Deliberately plain, framework-agnostic JS: the admin app ships as a Next.js
 * static export (`output: 'export'`), so there is no server runtime to generate
 * a worker. This file lives in `public/` and is copied verbatim into the export
 * (`out/sw.js`), then served under the deploy base path (see below).
 *
 * Base-path handling (the classic web-push-under-subpath gotcha):
 *   The panel is served under `/admin-preview/` on test. The client registers
 *   this worker at `<basePath>/sw.js` with an explicit scope of `<basePath>/`,
 *   so the worker only ever controls pages inside the panel. Here in the worker
 *   itself we never hard-code that prefix — `self.registration.scope` already is
 *   the absolute URL of the scope (e.g. `https://host/admin-preview/`), so
 *   resolving `new URL('bookings', scope)` lands on the right screen under ANY
 *   base path (root in dev, `/admin-preview/` on test). No env, no build step.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // Backend always sends JSON, but degrade to the raw text just in case.
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Новая бронь";
  const options = {
    body: payload.body || "Поступила новая бронь",
    icon: payload.icon || undefined,
    badge: payload.badge || undefined,
    tag: payload.tag || "bookeat-booking",
    // Where notificationclick should navigate. Relative to the scope, so it
    // stays correct under the base path.
    data: { path: payload.path || "bookings" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const relative = (event.notification.data && event.notification.data.path) || "bookings";
  const target = new URL(relative, self.registration.scope).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an already-open panel tab if there is one, else open a new one.
        for (const client of clients) {
          if (client.url.startsWith(self.registration.scope) && "focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
        return undefined;
      }),
  );
});
