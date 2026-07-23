import { HttpRestaurantRepository } from "./http-repository";
import { MockRestaurantRepository } from "./mock-repository";
import type { RestaurantRepository } from "./repository";

/**
 * Single switch between the mock and the real backend. If
 * `EXPO_PUBLIC_API_URL` is unset (or blank), the app keeps working exactly as
 * before — the mock repository, no backend required. Set it to point at a
 * running backend-core instance (e.g. "http://localhost:8080/api/v1") to use
 * real data instead.
 */
export function createRestaurantRepository(apiBaseUrl: string | undefined): RestaurantRepository {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) {
    return new MockRestaurantRepository({ latencyMs: 600 });
  }
  return new HttpRestaurantRepository({ baseUrl: trimmed });
}
