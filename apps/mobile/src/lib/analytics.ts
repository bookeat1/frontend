import {
  Identify,
  identify as amplitudeIdentify,
  init as amplitudeInit,
  reset as amplitudeReset,
  setUserId as amplitudeSetUserId,
  track as amplitudeTrack,
} from "@amplitude/analytics-react-native";
import type { AuthUser } from "@bookeat/api";

/**
 * Amplitude product analytics for the guest app.
 *
 * The key is a client-side WRITE key (public by design — it is inlined into the
 * shipped bundle by Expo, exactly like EXPO_PUBLIC_API_URL). It gates nothing on
 * the server; it only says which Amplitude project the events land in. Mirrors
 * the venue panel's `apps/admin/src/lib/analytics.ts`, adapted to the React
 * Native SDK.
 *
 * Everything here is best-effort: if the key is absent the whole module no-ops,
 * and no analytics call is ever allowed to throw into the app.
 *
 * NATIVE MODULE: `@amplitude/analytics-react-native` links native code, so a
 * build that adds it must be a fresh EAS build — it cannot ship over OTA.
 * Expo autolinks it; no config plugin is needed for core analytics.
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
  if (!API_KEY) {
    console.info(
      "[analytics] EXPO_PUBLIC_AMPLITUDE_API_KEY not set — Amplitude disabled",
    );
    return;
  }

  try {
    amplitudeInit(API_KEY, undefined, {
      // The RN SDK's autocapture toggle (the equivalent of the browser SDK's
      // `defaultTracking`): let it capture sessions and app foreground/background
      // lifecycle on its own. Network tracking, screen views and element
      // interactions are left off — network capture would record API URLs, and
      // screen views need a navigation integration we are not wiring here.
      autocapture: { sessions: true, appLifecycles: true },
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
    amplitudeSetUserId(user.id);
    const identity = new Identify();
    if (user.city) identity.set("city", user.city);
    amplitudeIdentify(identity);
  } catch (err) {
    console.error("[analytics] identify failed", err);
  }
}

/** Forget the current user (sign-out): new anonymous device id, no cross-user
 * bleed into the next person's session on a shared device. */
export function resetAnalytics(): void {
  if (!isEnabled()) return;
  try {
    amplitudeReset();
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
    amplitudeTrack(name, props);
  } catch (err) {
    console.error("[analytics] track failed", err);
  }
}
