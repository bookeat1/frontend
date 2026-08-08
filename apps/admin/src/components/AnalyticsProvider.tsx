"use client";

import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { identifyUser, initAnalytics, resetAnalytics } from "@/lib/analytics";

/**
 * Mounts inside <AuthProvider> so it can read the signed-in staff member.
 * Responsibilities:
 *   1. Bring Amplitude up once in the browser (SSR/static-export-safe).
 *   2. Keep the analytics identity in sync with the auth session — set the user
 *      on login/rehydrate, reset on logout.
 *
 * It renders its children untouched; it exists purely for the effect.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { hydrated, user } = useAuth();

  useEffect(() => {
    // Idempotent — safe to call on every dependency change.
    initAnalytics();
    // Wait until localStorage has been read, otherwise the first render (user
    // still null) would reset a session that is about to become authenticated.
    if (!hydrated) return;
    if (user) {
      identifyUser(user);
    } else {
      resetAnalytics();
    }
  }, [hydrated, user]);

  return <>{children}</>;
}
