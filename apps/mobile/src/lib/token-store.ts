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
