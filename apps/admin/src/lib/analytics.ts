"use client";

import * as amplitude from "@amplitude/analytics-browser";
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

/*
 * SESSION REPLAY IS GONE — DO NOT BRING IT BACK WITHOUT A DECISION ON PAPER.
 *
 * It used to run here with `sampleRate: 1`, i.e. EVERY session of every staff
 * member was recorded as video and shipped to the same Amplitude project the
 * guest app writes to. A replay of this panel is a replay of the booking list:
 * guests' names and phone numbers, on screen, frame by frame. The masking
 * defaults do not cover plain text, and nobody chose that trade-off.
 *
 * The plugin is REMOVED rather than set to `sampleRate: 0`: a zero sample rate
 * still loads and starts the replay SDK, so one config edit (or a default
 * change upstream) is all that stands between the panel and recording again.
 * No plugin, no recording — and the change is visible in the diff, not in a
 * number.
 */

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
    // NO EMAIL, and no name/phone either. The user id is an opaque UUID — it
    // says WHICH account without saying WHOSE, which is all analytics needs;
    // an address is a personal identifier in a third-party service, and it was
    // landing in the same project the guest app writes to.
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
