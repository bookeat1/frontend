"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { AdminApiError } from "@bookeat/api/admin";

import { AuthProvider } from "@/lib/auth-context";
import { clearSession } from "@/lib/api";

/** On any 401 (expired/invalid token), drop the local session and bounce to
 * login. A full navigation re-hydrates AuthProvider as unauthenticated. */
function onUnauthorized(error: unknown) {
  if (error instanceof AdminApiError && error.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
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
