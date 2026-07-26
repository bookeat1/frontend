/**
 * The one place the live access token lives for synchronous readers.
 *
 * `HttpClient` needs the token at request time, synchronously, from a
 * repository object built once at app start (see RepositoryProvider). React
 * context can't serve that: the repository would have to be rebuilt on every
 * sign-in, invalidating every in-flight query. So the token is held in a tiny
 * module-scoped cell that `AuthProvider` writes and the repository reads.
 *
 * Deliberately NOT persistent — persistence is the AuthProvider's job (secure
 * storage). This cell is process memory only, so nothing here survives a
 * reload and no token is ever written to a JS-readable store.
 */
let accessToken: string | undefined;

export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}

export function getAccessToken(): string | undefined {
  return accessToken;
}

/**
 * The session operations the repositories need but that live in React state
 * (AuthProvider owns the refresh token, the persistence and the sign-out).
 *
 * Registered once by AuthProvider into this same module-scoped cell, for the
 * same reason the raw token is: the repository is built ONCE at app start, so
 * it cannot close over a React context value — it closes over this module.
 */
export interface SessionTokenGateway {
  /** A token good for at least the next minute, refreshing it first if it is
   * about to expire; null when there is no session. */
  ensureFreshToken(): Promise<string | null>;
  /** The server rejected `staleToken` with a 401: return the token to retry
   * with, or null when the session is really gone. Single-flight. */
  refreshAfterUnauthorized(staleToken: string): Promise<string | null>;
}

let gateway: SessionTokenGateway | null = null;

export function setSessionTokenGateway(next: SessionTokenGateway | null): void {
  gateway = next;
}

/**
 * What the repositories pass as `getToken`. Proactive: every authenticated
 * request — reads included — goes out with a token that has at least a minute
 * left on it, which is what stops a 15-minute access token from turning
 * «Бронь» / «Избранные» / «Профиль» into a fake network error.
 *
 * Before AuthProvider has mounted there is no gateway yet; the raw cell is the
 * honest answer (undefined ⇒ the client fails fast with a 401 and the screens
 * show their signed-out state).
 */
export async function getFreshAccessToken(): Promise<string | undefined> {
  if (!gateway) return accessToken;
  return (await gateway.ensureFreshToken()) ?? undefined;
}

/** What the repositories pass as `onUnauthorized`. */
export async function refreshAfterUnauthorized(staleToken: string): Promise<string | undefined> {
  if (!gateway) return undefined;
  return (await gateway.refreshAfterUnauthorized(staleToken)) ?? undefined;
}
