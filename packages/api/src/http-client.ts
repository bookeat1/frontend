import { RepositoryError } from "./repository";

/** Every backend response is wrapped in this envelope (see response.Envelope
 * in backend-core/internal/transport/rest/response/response.go). */
interface Envelope<T> {
  data?: T;
  /** Human-readable, English, written for developers. Never rendered. */
  error?: string;
  /**
   * Machine-readable failure code, additive since 2026-07-25 — omitted by
   * older server builds, so every consumer must survive its absence. This is
   * the ONLY part of an error body the UI is allowed to branch on: `error`
   * text is not a contract, `code` is.
   */
  code?: string;
}

/** Paginated list envelope (see response.Page[T] in the same file). */
export interface ApiPage<T> {
  items: T[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** `Retry-After` in delta-seconds, or undefined when the header is absent or
 * in the HTTP-date form this API never uses. */
function parseRetryAfter(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds;
}

/** Returns the bearer token to send, or undefined when nobody is signed in.
 * A closure rather than a value so the repository is built once and still
 * sees a token acquired later (sign-in mid-session).
 *
 * May be async: the mobile app's provider refreshes an access token that is
 * about to expire BEFORE the request goes out, so a 15-minute token never
 * turns a healthy screen into "проверьте соединение". A plain synchronous
 * closure (the admin app) still satisfies this type. */
export type TokenProvider = () => string | undefined | Promise<string | undefined>;

/**
 * Last-resort recovery from a 401 on an authenticated request: given the token
 * that was just rejected, return a token to retry with, or undefined to let
 * the 401 stand.
 *
 * The handler owns de-duplication. This client calls it once per request and
 * retries at most once — it never loops — but N requests failing at the same
 * moment call it N times, and the refresh token on this backend is single-use
 * (verified: a second POST /auth/refresh with the same token answers 401), so
 * the handler must be single-flight and must answer the already-refreshed
 * token to whoever arrives late.
 */
export type UnauthorizedHandler = (staleToken: string) => Promise<string | undefined>;

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  getToken?: TokenProvider;
  onUnauthorized?: UnauthorizedHandler;
}

interface RequestOptions {
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
  /** Send the bearer token. Off by default so public reads stay public. */
  auth?: boolean;
}

/**
 * Thin fetch wrapper around the `/api/v1` JSON envelope. Every failure mode
 * (timeout, no network, non-2xx, malformed/empty body) is normalized into a
 * RepositoryError so the caller (HttpRestaurantRepository) never has to deal
 * with fetch's own exception shapes — callers of the repository already
 * handle RepositoryError today (see the existing error/empty screens).
 *
 * The server's `error` string is English and written for developers
 * ("already exists", "validation: guests must be positive"). It is carried on
 * RepositoryError.serverMessage for logs, but the UI must translate by
 * `status` and by the machine-readable `code`, never print it to a guest.
 *
 * `code` is forwarded from the envelope for EVERY endpoint, not just bookings:
 * it is additive and optional, so carrying it costs nothing where nobody reads
 * it yet, and a later consumer does not have to re-plumb the client.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getToken?: TokenProvider;
  private readonly onUnauthorized?: UnauthorizedHandler;

  constructor(options: HttpClientOptions) {
    // Trim a trailing slash so callers can pass either "https://host" or
    // "https://host/".
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.getToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return this.send<T>("GET", url.toString(), path, undefined, options);
  }

  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.send<T>("POST", `${this.baseUrl}${path}`, path, body, options);
  }

  async put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.send<T>("PUT", `${this.baseUrl}${path}`, path, body, options);
  }

  /** DELETE with no request body — the only shape this API uses (favorites). */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.send<T>("DELETE", `${this.baseUrl}${path}`, path, undefined, options);
  }

  /**
   * Resolves the bearer token (refreshing it up front when the provider says
   * so) and, if the server still answers 401, gives the session exactly ONE
   * chance to recover before the failure reaches the caller.
   *
   * Why a retry at all when the token is already refreshed pre-flight: the
   * pre-flight check trusts `expires_at` and the device clock. A phone with a
   * skewed clock, a token revoked server-side, or a request that left just
   * before the boundary all produce a 401 on a session that is still valid —
   * and the guest must not have to restart the app to recover from it.
   */
  private async send<T>(
    method: string,
    url: string,
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    if (!options?.auth) {
      return this.sendOnce<T>(method, url, path, body, options, undefined);
    }

    const token = await this.getToken?.();
    if (!token) {
      // Fail before the round trip: a request that needs a session but has
      // none is a caller bug (or a session that expired between screens),
      // and the UI's answer to both is the same — send the guest to sign in.
      throw new RepositoryError(`Not authenticated for ${path}`, undefined, 401);
    }

    try {
      return await this.sendOnce<T>(method, url, path, body, options, token);
    } catch (error) {
      if (
        !this.onUnauthorized ||
        !(error instanceof RepositoryError) ||
        error.status !== 401
      ) {
        throw error;
      }
      const refreshed = await this.onUnauthorized(token);
      // No new token (refresh rejected → the handler has signed the guest out)
      // or the same one back: the 401 is the truth, report it as such. Never
      // dressed up as a network failure.
      if (!refreshed || refreshed === token) throw error;
      return this.sendOnce<T>(method, url, path, body, options, refreshed);
    }
  }

  /** One round trip with an already-decided token. Never retries. */
  private async sendOnce<T>(
    method: string,
    url: string,
    path: string,
    body: unknown,
    options: RequestOptions | undefined,
    token: string | undefined,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options?.headers ?? {}),
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        // AbortSignal.timeout is available in the Hermes/RN runtime Expo ships
        // today; it turns a hung connection into a rejected fetch instead of
        // an app that spins forever.
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new RepositoryError(`Request to ${path} timed out after ${this.timeoutMs}ms`, cause);
      }
      // Covers "no network", DNS failure, connection refused, etc.
      throw new RepositoryError(`Network error requesting ${path}`, cause);
    }

    // Whole seconds the server itself asked us to wait. Only the rate-limit
    // middleware sends it (429), and it is the ONLY honest source for a
    // "try again in N seconds" line — anything else would be the client
    // guessing at somebody else's window.
    const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));

    let envelope: Envelope<T> | undefined;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      if (!response.ok) {
        throw new RepositoryError(
          `Server error ${response.status} requesting ${path}`,
          cause,
          response.status,
          undefined,
          undefined,
          retryAfter,
        );
      }
      throw new RepositoryError(`Empty or malformed response from ${path}`, cause);
    }

    if (!response.ok) {
      throw new RepositoryError(
        `Server error ${response.status} requesting ${path}: ${envelope?.error ?? "unknown error"}` +
          (envelope?.code ? ` [${envelope.code}]` : ""),
        undefined,
        response.status,
        envelope?.error,
        envelope?.code,
        retryAfter,
      );
    }

    if (envelope?.data === undefined) {
      throw new RepositoryError(`Empty response body from ${path}`);
    }

    return envelope.data;
  }
}
