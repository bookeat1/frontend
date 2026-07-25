import type { TokenProvider } from "./http-client";
import { HttpAuthRepository, HttpRestaurantRepository } from "./http-repository";
import { MockAuthRepository, MockRestaurantRepository } from "./mock-repository";
import type { AuthRepository, RestaurantRepository } from "./repository";

export interface RepositoryFactoryOptions {
  /** Supplies the bearer token for the authenticated booking calls. Reads the
   * live session on every request, so a repository built at app start still
   * sees a token acquired at the sign-in gate later. */
  getToken?: TokenProvider;
}

/**
 * Single switch between the mock and the real backend. If
 * `EXPO_PUBLIC_API_URL` is unset (or blank), the app keeps working exactly as
 * before — the mock repository, no backend required. Set it to point at a
 * running backend-core instance (e.g. "http://localhost:8080/api/v1") to use
 * real data instead.
 */
export function createRestaurantRepository(
  apiBaseUrl: string | undefined,
  options: RepositoryFactoryOptions = {},
): RestaurantRepository {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) {
    return new MockRestaurantRepository({ latencyMs: 600 });
  }
  return new HttpRestaurantRepository({ baseUrl: trimmed, getToken: options.getToken });
}

/** Same switch, for the auth API. Kept beside the catalog factory so both
 * implementations are chosen by the one environment variable. */
export function createAuthRepository(
  apiBaseUrl: string | undefined,
  options: RepositoryFactoryOptions = {},
): AuthRepository {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) {
    return new MockAuthRepository({ latencyMs: 600 });
  }
  return new HttpAuthRepository({ baseUrl: trimmed, getToken: options.getToken });
}
