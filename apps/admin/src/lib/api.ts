import { AdminApiClient } from "@bookeat/api/admin";

/**
 * Single AdminApiClient for the app. The bearer token is read from
 * localStorage on every request via getToken, so a login/logout that updates
 * localStorage is picked up without recreating the client.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const STORAGE_KEYS = {
  accessToken: "bookeat.admin.access_token",
  refreshToken: "bookeat.admin.refresh_token",
  user: "bookeat.admin.user",
  restaurant: "bookeat.admin.restaurant",
} as const;

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEYS.accessToken);
}

export const apiClient = new AdminApiClient({
  baseUrl: API_URL,
  getToken: readToken,
});

/** True when NEXT_PUBLIC_API_URL is missing — surfaced in the UI so a
 * misconfigured deploy fails loudly instead of hitting "" and looking broken. */
export const isApiConfigured = API_URL.trim().length > 0;

/** Wipe every stored auth artifact. Used on logout and on a global 401. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(STORAGE_KEYS)) {
    window.localStorage.removeItem(key);
  }
}
