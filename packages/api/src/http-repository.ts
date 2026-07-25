import { HttpClient, type ApiPage } from "./http-client";
import {
  cuisineIdFor,
  mapRestaurantDetail,
  mapRestaurantSummary,
  priceLevelToPriceCategory,
  type ApiMenuItem,
  type ApiPromo,
  type ApiRestaurant,
  type ApiReviewSummary,
} from "./http-mapping";
import { RepositoryError, type RestaurantRepository } from "./repository";
import { stubPopularSearches, stubRecentSearches } from "./unknown-data";
import type { Cuisine, Restaurant, RestaurantSummary, SearchQuery, SearchResult } from "./types";

export interface HttpRepositoryOptions {
  baseUrl: string;
  timeoutMs?: number;
}

const POPULAR_PAGE_SIZE = 20;
/** Promos render as a short horizontal strip; one page of this size is all it
 * can show. */
const PROMO_PAGE_SIZE = 8;
/** Backend caps per_page at 100 (domain.RestaurantFilter.PerPage doc
 * comment); used as the working page for the search screen and for building
 * the cuisine list out of the catalog. The live catalog is 29 venues, so one
 * page still covers it — revisit (real pagination) before it passes 100. */
const SEARCH_PAGE_SIZE = 100;

/** The chip label plus every exact spelling of that cuisine present in the
 * catalog. The server's cuisine filter is a case-sensitive
 * `cuisine_type = ANY($1)`, and the data really does contain both
 * "Европейская" and "европейская", so one chip has to send both. */
interface CuisineCatalog {
  list: Cuisine[];
  variantsById: Map<string, string[]>;
}

/**
 * HTTP-backed RestaurantRepository over `/api/v1`. See http-mapping.ts for
 * the DTO -> UI-type conversion and unknown-data.ts for the fields the API
 * doesn't have yet.
 */
export class HttpRestaurantRepository implements RestaurantRepository {
  private readonly client: HttpClient;
  private cuisinesPromise: Promise<CuisineCatalog> | null = null;

  constructor(options: HttpRepositoryOptions) {
    this.client = new HttpClient({ baseUrl: options.baseUrl, timeoutMs: options.timeoutMs });
  }

  /**
   * There is no cuisines endpoint: GET /restaurant-categories exists but is
   * empty on the live catalog and no restaurant carries a category_id, while
   * the dimension search actually filters on is the free-text `cuisine_type`
   * column (see cuisineIdFor in http-mapping.ts). So the cuisine list is
   * derived from one page of the catalog and cached for the process lifetime
   * — cleared on failure so a network blip doesn't wedge the filter row.
   */
  private async getCuisineCatalog(): Promise<CuisineCatalog> {
    if (!this.cuisinesPromise) {
      this.cuisinesPromise = this.client
        .get<ApiPage<ApiRestaurant>>("/restaurants", { page: 1, per_page: SEARCH_PAGE_SIZE })
        .then((page) => buildCuisineCatalog(page.items ?? []))
        .catch((err) => {
          this.cuisinesPromise = null;
          throw err;
        });
    }
    return this.cuisinesPromise;
  }

  /**
   * The venue screen needs four endpoints. They run in parallel, and only the
   * catalog read is allowed to fail the screen: a broken menu, promo or
   * review request degrades its own section (empty strip, no rating) instead
   * of turning the whole venue into an error state.
   */
  async getRestaurant(id: string): Promise<Restaurant> {
    const encoded = encodeURIComponent(id);
    const [api, reviews, menu, promos] = await Promise.all([
      this.client.get<ApiRestaurant>(`/restaurants/${encoded}`),
      optional(this.client.get<ApiReviewSummary>(`/restaurants/${encoded}/reviews/summary`)),
      optional(this.client.get<ApiMenuItem[]>(`/restaurants/${encoded}/menu`)),
      optional(
        this.client
          .get<ApiPage<ApiPromo>>(`/restaurants/${encoded}/promos`, {
            page: 1,
            per_page: PROMO_PAGE_SIZE,
          })
          .then((page) => page.items ?? []),
      ),
    ]);
    return mapRestaurantDetail(api, { reviews, menu, promos });
  }

  async getPopularRestaurants(): Promise<RestaurantSummary[]> {
    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants", {
      is_popular: true,
      page: 1,
      per_page: POPULAR_PAGE_SIZE,
    });
    return (page.items ?? []).map(mapRestaurantSummary);
  }

  /**
   * Runs on GET /restaurants/search, the dedicated catalog-search route
   * (internal/transport/rest/restaurants/handler.go: search), not on the
   * frozen listing route. Verified server-side query surface:
   *   - `q`        — Postgres FTS + trigram over the venue's searchable text
   *   - `cuisine`  — repeatable or comma-separated, OR-set, exact
   *                  `cuisine_type = ANY(...)` (case-sensitive)
   *   - `city`     — equality on the city enum value
   *   - `price`    — equality on the price_category tier string
   * Filters with no server-side counterpart stay client-side over the fetched
   * page: `openNowOnly` (isOpenNow is itself derived from the free-text
   * opening_hours, see http-mapping.ts) and `minRating` (the listing carries
   * no rating).
   */
  async searchRestaurants(query: SearchQuery): Promise<SearchResult> {
    const cuisines = await this.cuisineVariants(query.filters.cuisineIds);

    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants/search", {
      q: query.text.trim() || undefined,
      cuisine: cuisines.length > 0 ? cuisines.join(",") : undefined,
      city: query.filters.city,
      price: query.filters.priceLevel
        ? priceLevelToPriceCategory(query.filters.priceLevel)
        : undefined,
      page: 1,
      per_page: SEARCH_PAGE_SIZE,
    });

    const fetched = (page.items ?? []).map(mapRestaurantSummary);
    let items = fetched;

    if (query.filters.minRating !== undefined) {
      items = items.filter((r) => r.rating >= query.filters.minRating!);
    }

    if (query.filters.openNowOnly) {
      items = items.filter((r) => r.isOpenNow);
    }

    // `page.total` counts every match across pages; once a client-side filter
    // has removed rows, that number no longer describes what the user sees.
    const total = items.length === fetched.length ? (page.total ?? items.length) : items.length;
    return { query, items, total };
  }

  /** Expands the selected chips into the exact `cuisine_type` spellings the
   * server compares against. An id we've never seen (stale filter state after
   * the catalog changed) is passed through rather than dropped, so the user
   * gets an honest empty result instead of a silently wider one. */
  private async cuisineVariants(cuisineIds: string[]): Promise<string[]> {
    if (cuisineIds.length === 0) return [];
    const catalog = await this.getCuisineCatalog();
    return cuisineIds.flatMap((id) => catalog.variantsById.get(id) ?? [id]);
  }

  async getCuisines(): Promise<Cuisine[]> {
    const catalog = await this.getCuisineCatalog();
    return catalog.list;
  }

  /** GET /cities returns a bare array of city names (the domain's city enum),
   * not objects with ids — the search filter matches on the name itself. */
  async getCities(): Promise<string[]> {
    return this.client.get<string[]>("/cities");
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

/** Resolves to undefined instead of rejecting — for the venue screen's
 * secondary sections, see getRestaurant. */
async function optional<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

function buildCuisineCatalog(items: ApiRestaurant[]): CuisineCatalog {
  const list: Cuisine[] = [];
  const variantsById = new Map<string, string[]>();
  for (const item of items) {
    const name = (item.cuisine_type ?? "").trim();
    if (!name) continue;
    const id = cuisineIdFor(name);
    const variants = variantsById.get(id);
    if (!variants) {
      // The first spelling seen becomes the chip label.
      list.push({ id, name });
      variantsById.set(id, [name]);
    } else if (!variants.includes(name)) {
      variants.push(name);
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
  return { list, variantsById };
}

export { RepositoryError };
