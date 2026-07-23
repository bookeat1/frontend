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

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

/**
 * Thin fetch wrapper around the `/api/v1` JSON envelope. Every failure mode
 * (timeout, no network, non-2xx, malformed/empty body) is normalized into a
 * RepositoryError so the caller (HttpRestaurantRepository) never has to deal
 * with fetch's own exception shapes — callers of the repository already
 * handle RepositoryError today (see the existing error/empty screens).
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: HttpClientOptions) {
    // Trim a trailing slash so callers can pass either "https://host" or
    // "https://host/".
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
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

    let body: Envelope<T> | undefined;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch (cause) {
      if (!response.ok) {
        throw new RepositoryError(`Server error ${response.status} requesting ${path}`, cause);
      }
      throw new RepositoryError(`Empty or malformed response from ${path}`, cause);
    }

    if (!response.ok) {
      throw new RepositoryError(
        `Server error ${response.status} requesting ${path}: ${body?.error ?? "unknown error"}`,
      );
    }

    if (body?.data === undefined) {
      throw new RepositoryError(`Empty response body from ${path}`);
    }

    return body.data;
  }
}
