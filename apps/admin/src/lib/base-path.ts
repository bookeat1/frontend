/**
 * The single source of truth for the prefix the panel is served under.
 *
 * The panel runs at the root in dev and under `/admin-preview` on test. Next
 * prefixes what IT routes (`<Link>`, `router.replace`) with `basePath`, but it
 * does not touch a string we hand to `window.location` — that is exactly how a
 * staff member ended up at `https://<host>/login`, a path Caddy proxies into
 * the Go API, which answers a bare `404 page not found`.
 *
 * `NEXT_PUBLIC_BASE_PATH` is read here AND by `next.config.mjs`, which feeds it
 * to `basePath`. One env var, one prefix — nothing to keep in sync by hand.
 */

/** Prefix without a trailing slash; "" when the panel is served at the root. */
export function basePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
}

/** Absolute in-site path for a Next route, e.g. "/login" -> "/admin-preview/login". */
export function withBasePath(route: string): string {
  const suffix = route.startsWith("/") ? route : `/${route}`;
  return `${basePath()}${suffix}`;
}

/** Why the panel is sending someone back to the sign-in screen. Carried in the
 * URL so the login screen can say it out loud instead of silently appearing. */
export const SESSION_EXPIRED_REASON = "session-expired";

/**
 * Where a bounced-out employee must land. `reason` makes the login screen
 * explain itself rather than looking like a random logout.
 *
 * The trailing slash is not cosmetic: next.config sets `trailingSlash: true`,
 * so the static export writes `login/index.html` and Caddy serves the
 * directory. Asking for `/login` instead costs a 301 on a page a person is
 * already waiting for.
 */
export function loginUrl(reason?: string): string {
  const path = `${withBasePath("/login")}/`;
  return reason ? `${path}?reason=${encodeURIComponent(reason)}` : path;
}

/** True when the browser is already showing the login screen — with or without
 * the trailing slash a static export's directory listing adds. */
export function isOnLoginRoute(pathname: string): boolean {
  const login = withBasePath("/login");
  return pathname === login || pathname === `${login}/`;
}

/**
 * Leave the SPA for the login screen. `replace`, not `href`: the page we are
 * leaving cannot be re-entered with the Back button (its session is gone), and
 * a history entry pointing at it is just another way to show a broken screen.
 */
export function redirectToLogin(reason?: string): void {
  if (typeof window === "undefined") return;
  if (isOnLoginRoute(window.location.pathname)) return;
  window.location.replace(loginUrl(reason));
}
