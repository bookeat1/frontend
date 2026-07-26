import { RepositoryError } from "@bookeat/api";
import { QueryClient } from "@tanstack/react-query";

/**
 * Retries only what a retry can actually fix.
 *
 * A transport failure (offline, timeout, DNS) carries no `status` and is worth
 * one more attempt. A 401 is not: the session layer has already spent its one
 * refresh-and-retry inside HttpClient before the error reached here, so a
 * second identical request only delays the screen's signed-out state. 403 /
 * 404 / 409 / 422 are answers, not accidents.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof RepositoryError &&
    error.status !== undefined &&
    [400, 401, 403, 404, 409, 422].includes(error.status)
  ) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
    },
  },
});
