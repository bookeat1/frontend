import React, { useEffect } from "react";
import { identifyUser, initAnalytics, resetAnalytics } from "./analytics";
import { useAuth } from "./auth";

/**
 * Mounts inside <AuthProvider> so it can read the signed-in guest. Mirrors the
 * venue panel's AnalyticsProvider:
 *   1. Bring Amplitude up once on mount (idempotent, safe no-op without a key).
 *   2. Keep the analytics identity in sync with the auth session — identify on
 *      sign-in / rehydrate, reset on sign-out.
 *
 * It renders its children untouched; it exists purely for the effect. The
 * explicit `login` event is NOT fired here — it lives in the auth context's
 * `signInWithCode`, so a cold-start rehydrate (which also lands on "signed-in")
 * is not mistaken for a fresh login.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  useEffect(() => {
    // Idempotent — safe to call on every dependency change.
    initAnalytics();
    // Wait until the session has been hydrated, otherwise the first render
    // (status "loading") would reset a session that is about to become
    // authenticated.
    if (status === "loading") return;
    if (user) {
      identifyUser(user);
    } else if (status === "signed-out") {
      resetAnalytics();
    }
    // A "signed-in" status with a null user (the /users/me read has not answered
    // yet) intentionally does nothing: identify fires the moment the user lands.
  }, [status, user]);

  return <>{children}</>;
}
