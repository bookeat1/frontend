import { RepositoryError } from "./repository";

/** Every backend response is wrapped in this envelope (see response.Envelope
 * in backend-core/internal/transport/rest/response/response.go). */
interface Envelope<T> {
  data?: T;
  error?: string;
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

/** Returns the bearer token to send, or undefined when nobody is signed in.
 * A closure rather than a value so the repository is built once and still
 * sees a token acquired later (sign-in mid-session). */
export type TokenProvider = () => string | undefined;

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  getToken?: TokenProvider;
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
 * `status`, never print it to a guest.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getToken?: TokenProvider;

  constructor(options: HttpClientOptions) {
    // Trim a trailing slash so callers can pass either "https://host" or
    // "https://host/".
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.getToken = options.getToken;
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

  private async send<T>(
    method: string,
    url: string,
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options?.headers ?? {}),
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options?.auth) {
      const token = this.getToken?.();
      if (!token) {
        // Fail before the round trip: a request that needs a session but has
        // none is a caller bug (or a session that expired between screens),
        // and the UI's answer to both is the same — send the guest to sign in.
        throw new RepositoryError(`Not authenticated for ${path}`, undefined, 401);
      }
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

    let envelope: Envelope<T> | undefined;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      if (!response.ok) {
        throw new RepositoryError(
          `Server error ${response.status} requesting ${path}`,
          cause,
          response.status,
        );
      }
      throw new RepositoryError(`Empty or malformed response from ${path}`, cause);
    }

    if (!response.ok) {
      throw new RepositoryError(
        `Server error ${response.status} requesting ${path}: ${envelope?.error ?? "unknown error"}`,
        undefined,
        response.status,
        envelope?.error,
      );
    }

    if (envelope?.data === undefined) {
      throw new RepositoryError(`Empty response body from ${path}`);
    }

    return envelope.data;
  }
}
