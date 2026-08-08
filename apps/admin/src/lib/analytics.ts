"use client";

import * as amplitude from "@amplitude/analytics-browser";
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser";
import type { AuthUser } from "@bookeat/api/admin";

/**
 * Amplitude product analytics for the venue panel.
 *
 * The key is a client-side WRITE key (public by design — it ends up verbatim in
 * the shipped bundle, exactly like NEXT_PUBLIC_API_URL). It gates nothing on the
 * server; it only says which Amplitude project the events land in.
 *
 * Everything here is browser-only and best-effort: if the key is absent the
 * whole module no-ops, and no analytics call is ever allowed to throw into the
 * app. This is a static export (`output: "export"`) with no Node process, so
 * `init` must run in the browser (from a "use client" effect), never at build
 * time.
 */

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

/** Fraction of sessions Session Replay records. 1 = every session; lower this
 * (e.g. 0.5) if the test project's replay quota becomes a concern. */
const SESSION_REPLAY_SAMPLE_RATE = 1;

let initialized = false;

/** True once Amplitude is live for this page — i.e. we're in the browser and a
 * key was provided. Callers use this to skip work rather than trust that every
 * downstream call is a safe no-op. */
function isEnabled(): boolean {
  return initialized;
}

/**
 * Bring Amplitude up once per page load. Safe to call repeatedly (the second
 * call is a no-op) so a provider effect can invoke it without ordering worries.
 * No-ops with a one-line console note when the key is missing.
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return; // never at build/SSR time
  if (!API_KEY) {
    // Not an error: local dev and any deploy without the key set should run the
    // panel exactly as before, just without analytics.
    console.info("[analytics] NEXT_PUBLIC_AMPLITUDE_API_KEY not set — Amplitude disabled");
    return;
  }

  try {
    // Add the Session Replay plugin before init so the very first session on the
    // page is eligible for capture (the documented order).
    amplitude.add(sessionReplayPlugin({ sampleRate: SESSION_REPLAY_SAMPLE_RATE }));
    amplitude.init(API_KEY, {
      // Page views, element clicks, form interactions, sessions — no manual
      // instrumentation needed for the baseline funnel.
      autocapture: true,
    });
    initialized = true;
  } catch (err) {
    // A broken analytics init must never take the panel down with it.
    console.error("[analytics] init failed", err);
  }
}

/**
 * Attach the current session to a known staff member: stable user id plus their
 * global role as a user property. Call on login and on rehydrate.
 */
export function identifyUser(user: AuthUser): void {
  if (!isEnabled()) return;
  try {
    amplitude.setUserId(user.id);
    const identity = new amplitude.Identify();
    identity.set("role", user.role);
    if (user.email) identity.set("email", user.email);
    amplitude.identify(identity);
  } catch (err) {
    console.error("[analytics] identify failed", err);
  }
}

/** Forget the current user (logout). New anonymous device id, no cross-user
 * bleed into the next person's session on a shared machine. */
export function resetAnalytics(): void {
  if (!isEnabled()) return;
  try {
    amplitude.reset();
  } catch (err) {
    console.error("[analytics] reset failed", err);
  }
}

/** Fire a high-signal explicit event on top of autocapture. */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  try {
    amplitude.track(name, props);
  } catch (err) {
    console.error("[analytics] track failed", err);
  }
}
