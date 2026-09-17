import * as amplitude from "@amplitude/analytics-browser";
import type { AuthUser } from "@bookeat/api/client";

/**
 * Amplitude product analytics for the desktop site (book-eat.com).
 *
 * The key is a client-side WRITE key (public by design — it ends up verbatim
 * in the shipped bundle, exactly like NEXT_PUBLIC_API_URL). It gates nothing
 * on the server; it only says which Amplitude project the events land in.
 * Same project as the venue panel and the guest app (deliberate — see
 * `web-amplitude-analytics-20260916.md` §6 🟡1): one `user_id` ties the whole
 * funnel together across site, app and server.
 *
 * Mirrors `apps/admin/src/lib/analytics.ts` (four exports, best-effort,
 * `typeof window` gate) and the event taxonomy of
 * `apps/mobile/src/lib/analytics.web.ts`.
 *
 * Everything here is browser-only and best-effort: if the key is absent the
 * whole module no-ops, and no analytics call is ever allowed to throw into
 * the site.
 */

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

/*
 * SESSION REPLAY IS NOT HERE — DO NOT BRING IT IN WITHOUT A DECISION ON PAPER.
 *
 * The venue panel used to record every staff session as video into the same
 * Amplitude project the guest app writes to — a replay of the booking list
 * is a replay of guests' names and phone numbers, frame by frame. The site
 * has the exact same booking form (name, phone, wishes) in plain DOM text,
 * so the same trap applies here. No plugin is added, ever, without a written
 * decision that covers field masking.
 *
 * ELEMENT-INTERACTIONS AUTOCAPTURE IS OFF FOR THE SAME REASON: the header
 * renders the signed-in guest's name as a link to `/profile`
 * (`SiteHeader.tsx`). Autocapture's "Element Clicked" event ships the
 * element's TEXT — every click on that link would leak the guest's name.
 * See spec §0/§5.3 (owner decision, 16.09.2026, answer A). If this is ever
 * turned back on, it needs `data-amp-mask` on that link first, not after.
 */

let initialized = false;

/** True once Amplitude is live for this page — i.e. we're in the browser and
 * a key was provided. Callers use this to skip work rather than trust that
 * every downstream call is a safe no-op. */
function isEnabled(): boolean {
  return initialized;
}

/**
 * Bring Amplitude up once per page load. Safe to call repeatedly (the second
 * call is a no-op) so a provider effect can invoke it without ordering
 * worries. No-ops with a one-line console note when the key is missing.
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return; // never at build/SSR time
  if (!API_KEY) {
    // Not an error: local dev and any deploy without the key set should run
    // the site exactly as before, just without analytics.
    console.info("[analytics] NEXT_PUBLIC_AMPLITUDE_API_KEY not set — Amplitude disabled");
    return;
  }

  try {
    amplitude.init(API_KEY, {
      autocapture: {
        sessions: true,
        // BookingScreen rewrites ?date/guests/slot on every click — a full
        // page-view on every query change would flood the funnel with fake
        // "new pages".
        pageViews: { trackHistoryChanges: "pathOnly" },
        // Only the form's id/name/action, never field values — the SDK does
        // not send what the guest typed.
        formInteractions: true,
        // Nothing on the site is a download.
        fileDownloads: false,
        // See the comment block above: stays off until masking is decided.
        elementInteractions: false,
        // `attribution` is left at the SDK default (not set here on purpose)
        // — it already turns utm_* into initial_utm_* for free, which is all
        // the QR-code campaigns need.
      },
      // No plugins (no Session Replay). Project is in the US, same as the
      // venue panel — `serverZone` is left at its default.
    });
    initialized = true;
  } catch (err) {
    // A broken analytics init must never take the site down with it.
    console.error("[analytics] init failed", err);
  }
}

/**
 * Attach the current session to a known guest: stable user id plus a single
 * cheap user property. Call on sign-in and on session rehydrate.
 */
export function identifyUser(user: AuthUser): void {
  if (!isEnabled()) return;
  try {
    amplitude.setUserId(user.id);
    const identity = new amplitude.Identify();
    // ONLY city. No name, no phone, no e-mail — an address or a number is a
    // personal identifier in a third-party service, and the user id (an
    // opaque UUID) already says WHICH account without saying WHOSE.
    if (user.city) identity.set("city", user.city);
    amplitude.identify(identity);
  } catch (err) {
    console.error("[analytics] identify failed", err);
  }
}

/** Forget the current user (sign-out): new anonymous device id, no
 * cross-user bleed into the next guest's session on a shared browser. */
export function resetAnalytics(): void {
  if (!isEnabled()) return;
  try {
    amplitude.reset();
  } catch (err) {
    console.error("[analytics] reset failed", err);
  }
}

/** Fire a high-signal explicit event on top of autocapture. Never throws. */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  try {
    amplitude.track(name, props);
  } catch (err) {
    console.error("[analytics] track failed", err);
  }
}
