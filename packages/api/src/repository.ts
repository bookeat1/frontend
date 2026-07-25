import type {
  Cuisine,
  Restaurant,
  RestaurantSummary,
  SearchQuery,
  SearchResult,
} from "./types";

/**
 * Data-access boundary. UI code and TanStack Query hooks must depend only on
 * this interface, never on a concrete implementation, so swapping the mock
 * for the real backend later is a one-file change (see MockRestaurantRepository).
 */
export interface RestaurantRepository {
  getRestaurant(id: string): Promise<Restaurant>;
  getPopularRestaurants(): Promise<RestaurantSummary[]>;
  searchRestaurants(query: SearchQuery): Promise<SearchResult>;
  getCuisines(): Promise<Cuisine[]>;
  /** Cities the catalog actually has venues in, for the city filter. */
  getCities(): Promise<string[]>;
  getRecentSearches(): Promise<string[]>;
  getPopularSearches(): Promise<string[]>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
