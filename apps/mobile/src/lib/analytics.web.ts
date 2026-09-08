import * as amplitude from "@amplitude/analytics-browser";
import type { AuthUser } from "@bookeat/api";

/**
 * Web (react-native-web) implementation.
 *
 * `@amplitude/analytics-react-native` links native iOS/Android code (see the
 * `.ts` sibling's comment) and has no browser build — importing it on web is
 * exactly the crash this file exists to avoid. `@amplitude/analytics-browser`
 * is the real web equivalent, already used the same way by the venue panel
 * (`apps/admin/src/lib/analytics.ts`, which this mirrors function-for-function
 * so `AnalyticsProvider` and every call site here need to know nothing about
 * which platform they are on).
 *
 * Same public API as `./analytics` (native): `initAnalytics`, `identifyUser`,
 * `resetAnalytics`, `trackEvent`. Metro picks this file automatically on
 * `expo export --platform web` / `expo start --web`.
 */

const API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

let initialized = false;

/** True once Amplitude is live — i.e. a key was provided and init succeeded.
 * Callers use this to skip work rather than trust that every downstream call is
 * a safe no-op. */
function isEnabled(): boolean {
  return initialized;
}

/**
 * Bring Amplitude up once. Idempotent (the second call is a no-op) so a mount
 * effect can invoke it without ordering worries. No-ops with a one-line console
 * note when the key is missing — local dev and any build without the key set
 * should run exactly as before, just without analytics.
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return; // never at export/build time
  if (!API_KEY) {
    console.info(
      "[analytics] EXPO_PUBLIC_AMPLITUDE_API_KEY not set — Amplitude disabled",
    );
    return;
  }

  try {
    amplitude.init(API_KEY, {
      // Page views, element clicks, form interactions, sessions — mirrors the
      // admin panel's baseline. `ScreenViewTracker` (expo-router-aware, names
      // screens by route template) stays the source of screen-view events on
      // both platforms, same reasoning as the native `initAnalytics`.
      autocapture: { pageViews: false, sessions: true, formInteractions: true, fileDownloads: true, elementInteractions: true },
    });
    initialized = true;
  } catch (err) {
    // A broken analytics init must never take the app down with it.
    console.error("[analytics] init failed", err);
  }
}

/**
 * Attach the current session to a known guest: stable user id plus a couple of
 * cheap user properties. Call on sign-in and on rehydrate.
 */
export function identifyUser(user: AuthUser): void {
  if (!isEnabled()) return;
  try {
    amplitude.setUserId(user.id);
    const identity = new amplitude.Identify();
    if (user.city) identity.set("city", user.city);
    amplitude.identify(identity);
  } catch (err) {
    console.error("[analytics] identify failed", err);
  }
}

/** Forget the current user (sign-out): new anonymous device id, no cross-user
 * bleed into the next person's session on a shared device. */
export function resetAnalytics(): void {
  if (!isEnabled()) return;
  try {
    amplitude.reset();
  } catch (err) {
    console.error("[analytics] reset failed", err);
  }
}

/** Fire a high-signal explicit event on top of autocapture. Never throws. */
export function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  if (!isEnabled()) return;
  try {
    amplitude.track(name, props);
  } catch (err) {
    console.error("[analytics] track failed", err);
  }
}
