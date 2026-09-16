"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useAuth } from "@web/lib/auth";
import { identifyUser, initAnalytics, resetAnalytics, trackEvent } from "@web/lib/analytics";

/**
 * Mounts inside `AuthProvider` (see `app/providers.tsx`) so it can read the
 * signed-in guest. Responsibilities:
 *   1. Bring Amplitude up once in the browser (SSR-safe).
 *   2. Keep the analytics identity in sync with the auth session — identify
 *      on login/rehydrate, reset on sign-out.
 *   3. Fire `deep_link_attributed` once the campaign mark from `?promo=` has
 *      actually been captured — see the comment on `campaignId` below for
 *      why this has to live here rather than next to the capture itself.
 *
 * It renders its children untouched; it exists purely for the effects.
 */
export function AnalyticsProvider({
  campaignId,
  children,
}: {
  /** Campaign id just captured from the URL by `CampaignAttributionCapture`
   * in `app/providers.tsx`, or `null` if nothing new was captured. */
  campaignId: string | null;
  children: ReactNode;
}) {
  const { isLoading, signedIn, user } = useAuth();

  useEffect(() => {
    // Idempotent — safe to call on every dependency change.
    initAnalytics();
    // Wait until localStorage has been read, otherwise the first render
    // (signed out) would reset a session that is about to become
    // authenticated.
    if (isLoading) return;
    if (user) {
      identifyUser(user);
    } else if (!signedIn) {
      resetAnalytics();
    }
    // `signedIn && !user`: session tokens are there, profile hasn't come
    // back yet — nothing to do, the next render with `user` set will
    // identify.
  }, [isLoading, signedIn, user]);

  /**
   * `CampaignAttributionCapture` (a sibling of `AuthProvider`, mounted
   * earlier in the same commit — see `app/providers.tsx`) writes the mark to
   * `sessionStorage` and lifts the captured id up to `Providers`, which
   * passes it down here as a prop. Doing the actual `trackEvent` HERE,
   * rather than in the capture effect itself, is deliberate: this component
   * is a descendant of `AuthProvider`, so its effects always run after
   * `initAnalytics()` above has had a chance to flip `isEnabled()` to true.
   * Firing straight from the capture effect would race `initAnalytics()` and
   * silently lose the event on the very first page load — exactly the
   * ordering bug called out in the spec.
   */
  const reportedCampaignId = useRef<string | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    if (reportedCampaignId.current === campaignId) return;
    initAnalytics(); // idempotent; defensive in case effect order ever changes
    trackEvent("deep_link_attributed", { campaign_id: campaignId, link_type: "web_query" });
    reportedCampaignId.current = campaignId;
  }, [campaignId]);

  return <>{children}</>;
}
