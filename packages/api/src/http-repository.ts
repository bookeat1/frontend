import { HttpClient, type ApiPage } from "./http-client";
import {
  mapCategoryToCuisine,
  mapRestaurantDetail,
  mapRestaurantSummary,
  type ApiCategory,
  type ApiRestaurant,
  type CategoryLookup,
} from "./http-mapping";
import { RepositoryError, type RestaurantRepository } from "./repository";
import { stubPopularSearches, stubRecentSearches } from "./unknown-data";
import type { Cuisine, Restaurant, RestaurantSummary, SearchQuery, SearchResult } from "./types";

export interface HttpRepositoryOptions {
  baseUrl: string;
  timeoutMs?: number;
}

const POPULAR_PAGE_SIZE = 20;
/** Backend caps per_page at 100 (domain.RestaurantFilter.PerPage doc
 * comment); used as the working page for client-side filters (multi-cuisine,
 * open-now) the server doesn't support — see searchRestaurants below. */
const SEARCH_PAGE_SIZE = 100;

/**
 * HTTP-backed RestaurantRepository over `/api/v1`. See http-mapping.ts for
 * the DTO -> UI-type conversion and unknown-data.ts for the fields the API
 * doesn't have yet.
 */
export class HttpRestaurantRepository implements RestaurantRepository {
  private readonly client: HttpClient;
  private categoriesPromise: Promise<CategoryLookup> | null = null;

  constructor(options: HttpRepositoryOptions) {
    this.client = new HttpClient({ baseUrl: options.baseUrl, timeoutMs: options.timeoutMs });
  }

  /** Cached for the process lifetime — categories change rarely and every
   * restaurant mapping needs the lookup. Cleared only on failure so a bad
   * network blip doesn't wedge the app into always-failing category lookups. */
  private async getCategoryLookup(): Promise<CategoryLookup> {
    if (!this.categoriesPromise) {
      this.categoriesPromise = this.client
        .get<ApiCategory[]>("/restaurant-categories")
        .then((cats) => ({ byId: new Map(cats.map((c) => [c.id, mapCategoryToCuisine(c)])) }))
        .catch((err) => {
          this.categoriesPromise = null;
          throw err;
        });
    }
    return this.categoriesPromise;
  }

  async getRestaurant(id: string): Promise<Restaurant> {
    const categories = await this.getCategoryLookup();
    const api = await this.client.get<ApiRestaurant>(`/restaurants/${encodeURIComponent(id)}`);
    return mapRestaurantDetail(api, categories);
  }

  async getPopularRestaurants(): Promise<RestaurantSummary[]> {
    const categories = await this.getCategoryLookup();
    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants", {
      is_popular: true,
      page: 1,
      per_page: POPULAR_PAGE_SIZE,
    });
    return page.items.map((item) => mapRestaurantSummary(item, categories));
  }

  /**
   * Server-side support, verified against
   * internal/transport/rest/restaurants/handler.go + the ILIKE query in
   * internal/infrastructure/postgres/restaurant/repository.go:
   *   - `search` — ILIKE on restaurant NAME ONLY (does not match cuisine_type)
   *   - `category` — a single category UUID
   * Not supported server-side at all: matching by cuisine when more than one
   * is selected, minRating (no rating field exists), openNowOnly (no
   * is_open_now field/query param — isOpenNow is itself a client-derived
   * value, see http-mapping.ts).
   *
   * So: text search always goes to the server. If exactly one cuisine is
   * selected we also push it server-side as `category`. Everything else
   * (multi-cuisine, openNowOnly) is filtered client-side over the fetched
   * page. This does NOT scale to the full catalog once it's larger than one
   * page (SEARCH_PAGE_SIZE) — that's a known limitation to revisit once
   * multi-category/open-now filtering is worth pushing to the backend.
   */
  async searchRestaurants(query: SearchQuery): Promise<SearchResult> {
    const categories = await this.getCategoryLookup();
    const singleCategoryId =
      query.filters.cuisineIds.length === 1 ? query.filters.cuisineIds[0] : undefined;

    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants", {
      search: query.text.trim() || undefined,
      category: singleCategoryId,
      page: 1,
      per_page: SEARCH_PAGE_SIZE,
    });

    let items = page.items.map((item) => mapRestaurantSummary(item, categories));

    // Client-side fallback for multi-select cuisine (server only takes one
    // category id at a time).
    if (query.filters.cuisineIds.length > 1) {
      const wanted = new Set(query.filters.cuisineIds);
      items = items.filter((r) => r.cuisines.some((c) => wanted.has(c.id)));
    }

    // minRating has no meaning against the stubbed rating field today, but
    // honor it if a future screen sets it, rather than ignore it silently.
    if (query.filters.minRating !== undefined) {
      items = items.filter((r) => r.rating >= query.filters.minRating!);
    }

    if (query.filters.openNowOnly) {
      items = items.filter((r) => r.isOpenNow);
    }

    return { query, items, total: items.length };
  }

  async getCuisines(): Promise<Cuisine[]> {
    const categories = await this.getCategoryLookup();
    return Array.from(categories.byId.values());
  }

  /** STUB: no recent/popular search-term endpoint exists — see
   * unknown-data.ts. Not simulated as a network call since there is nothing
   * to fetch. */
  async getRecentSearches(): Promise<string[]> {
    return stubRecentSearches();
  }

  async getPopularSearches(): Promise<string[]> {
    return stubPopularSearches();
  }
}

export { RepositoryError };
