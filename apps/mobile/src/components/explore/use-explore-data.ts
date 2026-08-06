import type { Cuisine, EventPage, EventSummary, RestaurantSummary } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../../lib/repository";
import {
  PLACEHOLDER_ARTICLES,
  PLACEHOLDER_PROMOTIONS,
  type ArticleCardData,
  type PromoStripItem,
} from "./placeholder";

/**
 * Data seam of the Home screen. Every section reads from here, so it is
 * visible at a glance which ones are live and which are still placeholders —
 * and switching a placeholder to a real query means editing ONE function here,
 * never a component.
 *
 * NOTE ON PLACEMENT: hooks normally live in `src/hooks/`. These sit next to
 * their components because the Home work was scoped to `components/explore/**`;
 * move them to `src/hooks/useHome.ts` when the shared folders are free.
 */

/** Party size the Home selector defaults to. Matches the design's "2 гостя"
 * pill and the booking draft's own default of 2. */
export const EXPLORE_DEFAULT_GUESTS = 2;

/** How many venues «Выбрали для вас» shows. The endpoint returns up to 20; the
 * strip is capped rather than mounting a long horizontal list. */
const RECOMMENDED_LIMIT = 8;

/** How many events «Афиша» asks for. The vertical list stays short on the home
 * screen; a dedicated events screen would paginate. */
const EXPLORE_EVENTS_LIMIT = 12;

/**
 * REAL DATA — «Выбрали для вас».
 * GET /restaurants?is_popular=true (RestaurantRepository.getPopularRestaurants).
 */
export function useRecommendedRestaurants() {
  const repository = useRepository();
  return useQuery<RestaurantSummary[]>({
    queryKey: ["popular-restaurants"],
    queryFn: async () => (await repository.getPopularRestaurants()).slice(0, RECOMMENDED_LIMIT),
    // The catalog changes on an editorial timescale, not a per-minute one, and
    // this is the first screen after a cold start on a phone connection.
    staleTime: 5 * 60_000,
  });
}

/**
 * REAL DATA — «Выберите кухню».
 * GET /restaurants/cuisines (RestaurantRepository.getCuisines). The list is the
 * distinct `cuisine_type` values of the live catalog, each id being
 * casefold(cuisine_type) — exactly what the search filter matches on (see
 * conventions/bookeat-frontend.md, "Кухни — это cuisine_type").
 */
export function useExploreCuisines() {
  const repository = useRepository();
  return useQuery<Cuisine[]>({
    queryKey: ["cuisines"],
    queryFn: () => repository.getCuisines(),
    staleTime: 5 * 60_000,
  });
}

/**
 * REAL DATA — «Афиша».
 * GET /events (RestaurantRepository.listUpcomingEvents).
 *
 * `from` is deliberately NOT sent: the server already excludes finished
 * events, and pinning a client clock into the filter would drop events that
 * started earlier today and are still running on a device whose time is off.
 *
 * An empty page is a legitimate answer (nothing is scheduled), so the section
 * renders its empty state rather than treating it as a failure.
 */
export function useExploreEvents() {
  const repository = useRepository();
  return useQuery<EventPage>({
    queryKey: ["explore-events", EXPLORE_EVENTS_LIMIT],
    queryFn: () => repository.listUpcomingEvents({ perPage: EXPLORE_EVENTS_LIMIT }),
    // Events are announced days ahead, not minute by minute.
    staleTime: 5 * 60_000,
  });
}

/**
 * REAL DATA — one event for the «Карточка афиши» detail screen.
 *
 * There is NO single-event endpoint (`GET /events/:id` does not exist — checked
 * the repository, only the cross-venue list does). So a single event is read
 * by SELECTING it out of the same `/events` page the list and Home already
 * fetched: the query key is shared, so opening a card that came from either
 * screen is a cache hit, not a new request.
 *
 * The one honest limitation of this: an event outside that page (e.g. a cold
 * deep link to an id beyond the first `EXPLORE_EVENTS_LIMIT`, or one that has
 * since finished) resolves to `event: null` once loaded, and the screen shows
 * its "not found" state rather than inventing data.
 */
export function useEvent(id: string | undefined): {
  event: EventSummary | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useExploreEvents();
  const event = id ? (query.data?.items.find((item) => item.id === id) ?? null) : null;
  return {
    event,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

/* --------------------------------------------------------------------------
 * PLACEHOLDER SECTIONS — see ./placeholder.ts for the missing endpoint of each.
 * They are exposed as functions with the same shape a query hook's data would
 * have, so replacing one with `useQuery` does not touch the screen. Both return
 * an EMPTY array today, and their sections hide themselves when empty.
 * ----------------------------------------------------------------------- */

/** PLACEHOLDER — no global promotions endpoint. TODO: GET /promotions or
 * /feed?kind=promo. Returns [] ⇒ «Акции» is hidden. */
export function useExplorePromotions(): readonly PromoStripItem[] {
  return PLACEHOLDER_PROMOTIONS;
}

/** PLACEHOLDER — no articles endpoint. TODO: GET /articles. Returns [] ⇒
 * «Статьи» is hidden. */
export function useExploreArticles(): readonly ArticleCardData[] {
  return PLACEHOLDER_ARTICLES;
}

export type { ArticleCardData, PromoStripItem };
