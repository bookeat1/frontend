import {
  cuisines,
  popularSearches,
  recentSearches,
  restaurants,
  toSummary,
} from "./mock-data";
import { RepositoryError, type RestaurantRepository } from "./repository";
import type { Cuisine, Restaurant, RestaurantSummary, SearchQuery, SearchResult } from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesQuery(r: Restaurant, query: SearchQuery): boolean {
  const text = query.text.trim().toLowerCase();
  const textMatches =
    text.length === 0 ||
    r.name.toLowerCase().includes(text) ||
    r.cuisines.some((c) => c.name.toLowerCase().includes(text));

  const cuisineMatches =
    query.filters.cuisineIds.length === 0 ||
    r.cuisines.some((c) => query.filters.cuisineIds.includes(c.id));

  const ratingMatches =
    query.filters.minRating === undefined || r.rating >= query.filters.minRating;

  const openMatches = !query.filters.openNowOnly || r.isOpenNow;

  const cityMatches = query.filters.city === undefined || r.city === query.filters.city;

  const priceMatches =
    query.filters.priceLevel === undefined || r.priceLevel === query.filters.priceLevel;

  return (
    textMatches && cuisineMatches && ratingMatches && openMatches && cityMatches && priceMatches
  );
}

export interface MockRepositoryOptions {
  /** Simulated network latency in ms. */
  latencyMs?: number;
  /** If true, every call rejects with RepositoryError (for testing the error state). */
  forceError?: boolean;
}

/**
 * In-memory implementation of RestaurantRepository. Swapping to a real
 * backend later means writing a sibling class (e.g. HttpRestaurantRepository)
 * that implements the same interface — no caller code changes.
 */
export class MockRestaurantRepository implements RestaurantRepository {
  constructor(private readonly options: MockRepositoryOptions = {}) {}

  private async simulateNetwork(): Promise<void> {
    await delay(this.options.latencyMs ?? 500);
    if (this.options.forceError) {
      throw new RepositoryError("Simulated network failure");
    }
  }

  async getRestaurant(id: string): Promise<Restaurant> {
    await this.simulateNetwork();
    const found = restaurants.find((r) => r.id === id);
    if (!found) {
      throw new RepositoryError(`Restaurant ${id} not found`);
    }
    return found;
  }

  async getPopularRestaurants(): Promise<RestaurantSummary[]> {
    await this.simulateNetwork();
    return restaurants.map(toSummary);
  }

  async searchRestaurants(query: SearchQuery): Promise<SearchResult> {
    await this.simulateNetwork();
    const items = restaurants.filter((r) => matchesQuery(r, query)).map(toSummary);
    return { query, items, total: items.length };
  }

  async getCuisines(): Promise<Cuisine[]> {
    await this.simulateNetwork();
    return cuisines;
  }

  /** Derived from the fixtures rather than hard-coded, so the mock's city
   * filter can never offer a city no fixture is in. */
  async getCities(): Promise<string[]> {
    await this.simulateNetwork();
    return Array.from(new Set(restaurants.map((r) => r.city))).sort((a, b) =>
      a.localeCompare(b, "ru-RU"),
    );
  }

  async getRecentSearches(): Promise<string[]> {
    await this.simulateNetwork();
    return recentSearches;
  }

  async getPopularSearches(): Promise<string[]> {
    await this.simulateNetwork();
    return popularSearches;
  }
}
