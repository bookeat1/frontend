import { AdminApiClient } from "@bookeat/api/admin";

import { SESSION_EXPIRED_REASON, redirectToLogin } from "./base-path";
import { AdminSession } from "./session";
import { browserStorage, clearTokens } from "./token-store";

/**
 * The app's single AdminApiClient and the session that keeps it authorized.
 *
 * The client no longer reads storage itself: it asks `session` for a token
 * before every request (which renews one that is about to expire) and asks it
 * again if a request still comes back 401 (which retries it once). See
 * ./session.ts for why that is two entry points and not a background timer.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// The client and the session refer to each other (the client asks the session
// for a token; the session refreshes through the client). Both calls happen
// long after module evaluation, so the cycle is harmless at runtime — but the
// types must be written out, or TypeScript infers `any` for both and the
// looseness leaks into every screen that imports the client.
export const apiClient: AdminApiClient = new AdminApiClient({
  baseUrl: API_URL,
  getToken: (): Promise<string | null> => session.accessToken(),
  onUnauthorized: (usedToken): Promise<string | null> =>
    session.recoverAfterUnauthorized(usedToken),
});

export const session: AdminSession = new AdminSession({
  // `apiClient.refresh` sends `auth: false`, so refreshing can never re-enter
  // the session through onUnauthorized.
  refresh: (refreshToken) => apiClient.refresh(refreshToken),
  onSessionLost: () => redirectToLogin(SESSION_EXPIRED_REASON),
});

/** True when NEXT_PUBLIC_API_URL is missing — surfaced in the UI so a
 * misconfigured deploy fails loudly instead of hitting "" and looking broken. */
export const isApiConfigured = API_URL.trim().length > 0;

/** Wipe every stored auth artifact. Used on logout and on an unrecoverable 401. */
export function clearSession(): void {
  clearTokens(browserStorage());
}

export { STORAGE_KEYS } from "./token-store";
