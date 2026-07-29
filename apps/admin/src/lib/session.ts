import { AdminApiError } from "@bookeat/api/admin";
import type { TokenPair } from "@bookeat/api/admin";

import {
  browserStorage,
  clearTokens,
  readAccessExpiry,
  readAccessToken,
  readRefreshToken,
  storeTokens,
  type TokenStorage,
} from "./token-store";

/**
 * Keeps a working shift signed in.
 *
 * The backend issues access tokens that live 15 minutes
 * (`AUTH_ACCESS_TOKEN_TTL=15m`) and refresh tokens that live 30 days
 * (`AUTH_REFRESH_TOKEN_TTL=720h`). Nothing in the panel used to call
 * `POST /auth/refresh`, so a hostess was signed out mid-service every quarter
 * of an hour. This module is the missing half.
 *
 * Two ways in, one implementation:
 *
 * - BEFORE a request (`accessToken`): if the token dies within RENEW_LEAD_MS it
 *   is renewed first. This also covers a laptop that slept through the expiry —
 *   nothing is scheduled, the check happens when work resumes, so there is no
 *   timer to miss.
 * - AFTER a 401 (`recoverAfterUnauthorized`): covers a clock that is off, a
 *   token revoked out of band, and a request that was already in flight when
 *   the token expired. The request is retried once with the new token.
 *
 * Two hazards the backend forces us to respect (`usecase/auth.facade.Refresh`):
 *
 * 1. REFRESH TOKENS ROTATE AND THE OLD ONE IS REVOKED IMMEDIATELY — there is no
 *    grace window. Two tabs refreshing at the same moment would mean one of
 *    them presents a token that was just revoked and gets a 401, i.e. the whole
 *    venue signed out. Hence the cross-tab mutex (Web Locks) plus a re-read of
 *    storage INSIDE the lock: whoever waited finds the fresh token already
 *    there and never calls the endpoint.
 * 2. A refusal and an outage are not the same thing. Only a refusal (the
 *    backend answering 400/401/422) ends the session. A network error or a
 *    timeout leaves the session alone — signing someone out because the Wi-Fi
 *    blinked would be a worse bug than the one being fixed here.
 */

/** How long before expiry a token is renewed. Comfortably longer than any
 * request this panel makes (the client's own timeout is 12s). */
const RENEW_LEAD_MS = 60_000;

/** Web Locks name. Shared by every tab of this origin — that is the point. */
const REFRESH_LOCK = "bookeat.admin.token-refresh";

export interface AdminSessionDeps {
  /** `POST /auth/refresh`. Kept as a function so the session never imports the
   * api module that constructs it (and so a test needs no HTTP). */
  refresh(refreshToken: string): Promise<TokenPair>;
  /** Called when, and only when, the session is definitively unrecoverable. */
  onSessionLost(): void;
  storage?(): TokenStorage | null;
  now?(): number;
  /** Cross-tab mutex. Defaults to the Web Locks API where it exists. */
  withLock?<T>(run: () => Promise<T>): Promise<T>;
  renewLeadMs?: number;
}

export class AdminSession {
  private readonly deps: AdminSessionDeps;
  /** In-tab single flight: several requests hitting an expiring token at once
   * share ONE refresh, so they cannot rotate each other's token away. */
  private inFlight: Promise<string | null> | null = null;

  constructor(deps: AdminSessionDeps) {
    this.deps = deps;
  }

  /** The token to send with the next request, renewed first if it is about to
   * expire. Null means there is no session (the caller will be redirected). */
  async accessToken(): Promise<string | null> {
    const storage = this.storage();
    const token = readAccessToken(storage);
    if (!token) return null;
    if (!this.isExpiring(storage)) return token;
    return this.renew(token);
  }

  /**
   * A request came back 401. Returns a token to retry it with exactly once, or
   * null if the session is over (in which case the employee is already on the
   * way to the login screen).
   */
  async recoverAfterUnauthorized(usedToken: string | null): Promise<string | null> {
    const storage = this.storage();
    const current = readAccessToken(storage);
    if (!current) {
      // Another tab signed out, or the session was already cleared.
      this.lose();
      return null;
    }
    // Someone else already replaced the token our request was carrying: retry
    // with theirs rather than rotating a perfectly good one away.
    if (usedToken !== null && current !== usedToken) return current;
    return this.renew(current);
  }

  /** Store a pair from login or refresh. */
  store(pair: TokenPair): void {
    storeTokens(this.storage(), pair);
  }

  /** Drop every stored auth artifact (logout). Does not redirect. */
  clear(): void {
    clearTokens(this.storage());
  }

  private storage(): TokenStorage | null {
    return this.deps.storage ? this.deps.storage() : browserStorage();
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  private isExpiring(storage: TokenStorage | null): boolean {
    const expiresAt = readAccessExpiry(storage);
    // Unknown expiry is not "expiring": we simply lose the head start and fall
    // back to recovering after the 401.
    if (expiresAt === null) return false;
    const lead = this.deps.renewLeadMs ?? RENEW_LEAD_MS;
    return expiresAt - this.now() <= lead;
  }

  private renew(staleToken: string): Promise<string | null> {
    if (this.inFlight) return this.inFlight;
    const attempt = this.runRenew(staleToken).finally(() => {
      if (this.inFlight === attempt) this.inFlight = null;
    });
    this.inFlight = attempt;
    return attempt;
  }

  private runRenew(staleToken: string): Promise<string | null> {
    return this.withLock(async () => {
      const storage = this.storage();
      const current = readAccessToken(storage);
      if (!current) {
        this.lose();
        return null;
      }
      // Re-read inside the lock: another tab may have rotated while we queued.
      if (current !== staleToken && !this.isExpiring(storage)) return current;

      const refreshToken = readRefreshToken(storage);
      if (!refreshToken) {
        this.lose();
        return null;
      }

      let pair: TokenPair;
      try {
        pair = await this.deps.refresh(refreshToken);
      } catch (error) {
        if (isRefusal(error)) {
          this.lose();
          return null;
        }
        // Outage, not refusal: keep the session and let the caller show its
        // error state. The next request will try again.
        throw error;
      }
      storeTokens(storage, pair);
      return pair.access_token;
    });
  }

  private withLock<T>(run: () => Promise<T>): Promise<T> {
    if (this.deps.withLock) return this.deps.withLock(run);
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    // No Web Locks (older Safari, non-secure context): in-tab single flight
    // still holds, we only lose the cross-tab guarantee.
    if (!locks) return run();
    return locks.request(REFRESH_LOCK, run);
  }

  private lose(): void {
    clearTokens(this.storage());
    this.deps.onSessionLost();
  }
}

/** The backend said no, as opposed to never answering. Only this ends a
 * session: 401 invalid/expired/reused refresh token, 400/422 a malformed one. */
function isRefusal(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 400 || error.status === 401 || error.status === 422)
  );
}
