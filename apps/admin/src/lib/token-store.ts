import type { TokenPair } from "@bookeat/api/admin";

/**
 * Everything the panel keeps about a session, and the only place that reads or
 * writes it. `localStorage` (not memory) because a venue's staff reload the
 * panel constantly and share the machine between shifts.
 */

export const STORAGE_KEYS = {
  accessToken: "bookeat.admin.access_token",
  refreshToken: "bookeat.admin.refresh_token",
  /** RFC3339 expiry of the access token, straight from the server's token pair.
   * Written since 2026-07-27; a session created before that has none, and the
   * expiry is then read out of the JWT itself (see readAccessExpiry). */
  expiresAt: "bookeat.admin.access_expires_at",
  user: "bookeat.admin.user",
  restaurant: "bookeat.admin.restaurant",
} as const;

/** The subset of `Storage` this module needs, so a test can hand in a plain
 * object instead of standing up jsdom's localStorage. */
export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's localStorage, or null on the server / when storage is blocked
 * (Safari private mode throws on access rather than returning null). */
export function browserStorage(): TokenStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAccessToken(storage: TokenStorage | null): string | null {
  return storage?.getItem(STORAGE_KEYS.accessToken) ?? null;
}

export function readRefreshToken(storage: TokenStorage | null): string | null {
  return storage?.getItem(STORAGE_KEYS.refreshToken) ?? null;
}

/**
 * When the current access token dies, in epoch ms, or null if that cannot be
 * established. Prefers the server's own `expires_at`; falls back to the `exp`
 * claim of the JWT so a session that predates this code is still refreshed
 * ahead of time instead of dying at the next request.
 *
 * A null here is not an error — it only means the panel loses the PROACTIVE
 * refresh and falls back to refreshing after a 401.
 */
export function readAccessExpiry(storage: TokenStorage | null): number | null {
  const stored = storage?.getItem(STORAGE_KEYS.expiresAt);
  if (stored) {
    const parsed = Date.parse(stored);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const token = readAccessToken(storage);
  return token ? jwtExpiryMs(token) : null;
}

/** `exp` (seconds) out of a JWT payload, as epoch ms. Null for anything that is
 * not a readable JWT — this is a best-effort optimisation, never a check. */
export function jwtExpiryMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== "object" || claims === null) return null;
    const exp = (claims as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Persist a freshly issued pair. Written together so no reader can ever see a
 * new access token next to the refresh token it replaced. */
export function storeTokens(storage: TokenStorage | null, pair: TokenPair): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEYS.accessToken, pair.access_token);
  storage.setItem(STORAGE_KEYS.refreshToken, pair.refresh_token);
  if (pair.expires_at) storage.setItem(STORAGE_KEYS.expiresAt, pair.expires_at);
  else storage.removeItem(STORAGE_KEYS.expiresAt);
}

/** Wipe every stored auth artifact. Used on logout and on an unrecoverable 401. */
export function clearTokens(storage: TokenStorage | null): void {
  if (!storage) return;
  for (const key of Object.values(STORAGE_KEYS)) storage.removeItem(key);
}
