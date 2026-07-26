import type { EventPage, RestaurantSummary } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../../lib/repository";
import { toDateKey } from "../../lib/format";
import {
  PLACEHOLDER_CHEFS_PICKS,
  PLACEHOLDER_GASTROGUIDE,
  PLACEHOLDER_HERO_BANNERS,
  type DishCardData,
  type HeroBanner,
} from "./placeholder";

/**
 * Data seam of the Explore screen. Every section reads from here, so it is
 * visible at a glance which ones are live and which are still placeholders —
 * and switching a placeholder to a real query means editing ONE function here,
 * never a component.
 *
 * NOTE ON PLACEMENT: hooks normally live in `src/hooks/`. These sit next to
 * their components because this task was scoped to `components/explore/**`;
 * move them to `src/hooks/useExplore.ts` when the shared folders are free.
 */

/** Party size the Explore cards preview availability for. Matches the design's
 * "Today · 2 guests" line and the booking draft's own default of 2. */
export const EXPLORE_DEFAULT_GUESTS = 2;

/** How many venues the strip shows. The endpoint returns up to 20; each card
 * costs one availability request, so the strip is capped rather than letting
 * a long list quietly fire twenty. */
const POPULAR_LIMIT = 8;

/** How many events the strip asks for. Same reasoning as POPULAR_LIMIT: the
 * user swipes a horizontal rail by hand and never reaches card twenty. */
const EXPLORE_EVENTS_LIMIT = 12;

/** REAL DATA — GET /restaurants?is_popular=true (RestaurantRepository.getPopularRestaurants). */
export function usePopularRestaurants() {
  const repository = useRepository();
  return useQuery<RestaurantSummary[]>({
    queryKey: ["popular-restaurants"],
    queryFn: async () => (await repository.getPopularRestaurants()).slice(0, POPULAR_LIMIT),
    // The catalog changes on an editorial timescale, not a per-minute one, and
    // this is the first screen after a cold start on a phone connection.
    staleTime: 5 * 60_000,
  });
}

/**
 * REAL DATA — GET /restaurants/:id/availability for today.
 *
 * One query per visible card, deliberately: there is no batch availability
 * endpoint. `enabled` is what keeps the cost bounded — the caller passes
 * `false` for cards that are not on screen yet, and the horizontal list only
 * mounts a couple of cards ahead of the viewport.
 *
 * `guests` is the parameter name the backend actually reads (`party_size` is
 * silently ignored — see bugs/bookeat-frontend-availability-guests-param);
 * the repository already sends the right one.
 */
export function useTodaySlots(restaurantId: string, enabled: boolean) {
  const repository = useRepository();
  const date = toDateKey(new Date());

  return useQuery({
    queryKey: ["availability", restaurantId, date, EXPLORE_DEFAULT_GUESTS],
    queryFn: () =>
      repository.getAvailability({
        restaurantId,
        date,
        guests: EXPLORE_DEFAULT_GUESTS,
      }),
    enabled,
    // Slots go stale the moment somebody else books one; the same rule the
    // reservation screen follows.
    staleTime: 0,
    // A venue with no working hours answers with an empty list — that is a
    // legitimate answer, not a failure worth retrying twice on mobile data.
    retry: 1,
  });
}

/**
 * REAL DATA — GET /events (RestaurantRepository.listUpcomingEvents).
 *
 * One page is all a horizontal strip can show, so there is no pagination here
 * — `total` on the answer is what would drive a future «смотреть все» screen.
 *
 * `from` is deliberately NOT sent: the server already excludes events that
 * have finished, and pinning a client clock into the filter would drop events
 * that started earlier today and are still running on a device whose time is
 * off.
 *
 * An empty page is a legitimate answer (nothing is scheduled), so it must not
 * be retried harder than any other read — the section renders its empty state.
 */
export function useExploreEvents() {
  const repository = useRepository();
  return useQuery<EventPage>({
    queryKey: ["explore-events", EXPLORE_EVENTS_LIMIT],
    queryFn: () => repository.listUpcomingEvents({ perPage: EXPLORE_EVENTS_LIMIT }),
    // Events are announced days ahead, not minute by minute; the same
    // editorial timescale the popular strip assumes.
    staleTime: 5 * 60_000,
  });
}

/** The date the Explore cards preview, as the availability endpoint keys it. */
export function exploreDateKey(): string {
  return toDateKey(new Date());
}

/* --------------------------------------------------------------------------
 * PLACEHOLDER SECTIONS — see ./placeholder.ts for the missing endpoint of each.
 * They are exposed as functions with the same shape a query hook would have,
 * so replacing one with `useQuery` does not touch the screen.
 * ----------------------------------------------------------------------- */

/** PLACEHOLDER — no GET /promo-banners endpoint. */
export function useHeroBanners(): HeroBanner[] {
  return PLACEHOLDER_HERO_BANNERS;
}

/** PLACEHOLDER — no GET /menu-items/featured endpoint. */
export function useChefsPicks(): DishCardData[] {
  return PLACEHOLDER_CHEFS_PICKS;
}

/** PLACEHOLDER — no GET /gastroguide endpoint. */
export function useGastroguide(): DishCardData[] {
  return PLACEHOLDER_GASTROGUIDE;
}
