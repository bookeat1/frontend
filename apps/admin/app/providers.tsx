"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { AdminApiError } from "@bookeat/api/admin";

import { AuthProvider } from "@/lib/auth-context";
import { clearSession } from "@/lib/api";
import { SESSION_EXPIRED_REASON, redirectToLogin } from "@/lib/base-path";

/**
 * Last resort. A 401 that gets this far has already survived the session's own
 * renew-and-retry (see lib/session.ts), so the session really is over: drop it
 * and bounce to login. A full navigation re-hydrates AuthProvider as
 * unauthenticated.
 *
 * `redirectToLogin` prefixes the panel's basePath. The old code sent the
 * browser to a bare "/login", which on the test deploy (panel under
 * /admin-preview) is a path Caddy proxies into the Go API — the employee got
 * `404 page not found` instead of a sign-in form.
 */
function onUnauthorized(error: unknown) {
  if (error instanceof AdminApiError && error.status === 401) {
    clearSession();
    redirectToLogin(SESSION_EXPIRED_REASON);
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: onUnauthorized }),
        mutationCache: new MutationCache({ onError: onUnauthorized }),
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
