import type {
  AuthUser,
  Cuisine,
  EventPage,
  EventSummary,
  GuideCollection,
  GuideRoute,
  GuideRouteDetail,
  GuideCollectionDetail,
  HomePromo,
  RestaurantSummary,
} from "@bookeat/api";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/locale";
import { useCuisines } from "../../hooks/useCuisines";
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

/** How many collections the Home «Статьи» strip shows. The list screen shows
 * them all; the strip is capped, like «Выбрали для вас». */
const ARTICLES_LIMIT = 6;

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
 * Фотографии для ряда «Выберите кухню».
 *
 * ТРЕТИЙ, последний источник картинки для круга — после ссылки из справочника
 * и снимка, вшитого в сборку (см. CuisineChip). Нужен, пока у части кухонь
 * `image_url` в справочнике не проставлен, а своего снимка в приложении нет:
 * без него такая кухня выпадает из ряда целиком.
 *
 * Фотография берётся у реального заведения этой кухни: она всегда есть, права
 * на неё наши, и новая кухня появляется в ряду сама, без досылки сборки.
 *
 * Берём ПЕРВОЕ заведение каждой кухни в порядке каталога: там уже задан
 * `display_order`, то есть выбор редакции, а не случайность.
 */
export function useCuisinePhotos(): Map<string, string> {
  const repository = useRepository();
  const query = useQuery<RestaurantSummary[]>({
    queryKey: ["catalog-preview"],
    queryFn: () => repository.getCatalogPreview(),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const byCuisine = new Map<string, string>();
    for (const venue of query.data ?? []) {
      const uri = venue.coverPhoto?.uri;
      if (!uri) continue;
      for (const cuisine of venue.cuisines) {
        if (!byCuisine.has(cuisine.id)) byCuisine.set(cuisine.id, uri);
      }
    }
    return byCuisine;
  }, [query.data]);
}

/**
 * REAL DATA — «Выберите кухню».
 *
 * Справочник кухонь `GET /cuisines`: состав и порядок задаёт сервер. Сам
 * запрос и его кэш живут в одном месте на всё приложение (useCuisines) —
 * поиск читает тот же самый. Здесь остаётся имя, под которым его знает
 * главная.
 */
export function useExploreCuisines(): UseQueryResult<Cuisine[]> {
  return useCuisines();
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

/** Maps one home-feed promo to the strip-card shape. The subtitle is the host
 * venue name alone: the promo's `startsAt`/`endsAt` are a CAMPAIGN date range,
 * not a daily open window, so rendering a «12:00–18:00» time from them would be
 * fabricated — the venue name is the one honest secondary line. */
function toPromoStripItem(promo: HomePromo): PromoStripItem {
  return {
    id: promo.id,
    discountPercent: promo.discountPercent,
    title: promo.title,
    subtitle: promo.restaurantName,
    imageUrl: promo.coverImageUrl,
  };
}

/**
 * REAL DATA — «Акции».
 * GET /feed?city=<city> (RestaurantRepository.getPromotions), filtered to
 * `kind: "promo"` in the mapper.
 *
 * CITY: the feed's `city` param is required (422 `city_required` without it),
 * so the query is gated on a resolved city. The city is read from the SAME
 * `["me"]` query the Home header uses (GET /users/me), falling back to the
 * locale's default city (`t.explore.cityFallback` — «Алматы») exactly as
 * app/index.tsx resolves it, so both views agree on one city with no extra
 * request (the two `["me"]` queries share a cache key).
 *
 * EMPTY/LOADING/ERROR: returns the stable empty array (PLACEHOLDER_PROMOTIONS)
 * until real promos arrive, so «Акции» stays hidden while loading, on error,
 * and when the feed has no promos for the city — the behaviour PromotionsSection
 * relies on.
 */
export function useExplorePromotionsQuery(): UseQueryResult<HomePromo[]> {
  const repository = useRepository();
  const { status, repository: authRepository } = useAuth();
  const { dictionary: t } = useLocale();

  // Same query key + fetcher + gate as app/index.tsx, so this shares that
  // cache entry rather than issuing a second GET /users/me.
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => authRepository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
  const city = me.data?.city?.trim() || t.explore.cityFallback;

  return useQuery<HomePromo[]>({
    queryKey: ["home-feed", "promos", city],
    queryFn: () => repository.getPromotions(city),
    enabled: city.length > 0,
    // Promos change on an editorial timescale, like the rest of the home feed.
    staleTime: 5 * 60_000,
  });
}

/** The Home strip's view of the same query — see useExplorePromotionsQuery. */
export function useExplorePromotions(): readonly PromoStripItem[] {
  const query = useExplorePromotionsQuery();
  return useMemo(
    () => query.data?.map(toPromoStripItem) ?? PLACEHOLDER_PROMOTIONS,
    [query.data],
  );
}

/**
 * One promo out of the same cached feed. There is no `GET /promotions/:id` on
 * this backend — the feed item already carries everything the detail screen
 * shows — so the screen reads the list it came from instead of refetching, and
 * a promo that is no longer in the feed simply resolves to undefined (the
 * screen then shows its "not found" state).
 */
export function useExplorePromotion(promoId: string | undefined): {
  promo: HomePromo | undefined;
  query: UseQueryResult<HomePromo[]>;
} {
  const query = useExplorePromotionsQuery();
  const promo = useMemo(
    () => (promoId ? query.data?.find((item) => item.id === promoId) : undefined),
    [query.data, promoId],
  );
  return { promo, query };
}

/**
 * REAL DATA — «Статьи» (GASTROGUIDE).
 * GET /gastroguide/collections (RestaurantRepository.getGuideCollections).
 *
 * The editorial collections list, shared by the Home strip and the `/articles`
 * screen. Public, no session. An empty answer is the normal "nothing published"
 * — the section hides on it (see useExploreArticles).
 */
/**
 * РЕАЛЬНЫЕ ДАННЫЕ — гастропрогулки для экрана гастрогида.
 * GET /gastroguide/routes?city=<город> (RestaurantRepository.getGuideRoutes).
 *
 * ГОРОД: ручка требует город (без него 422 `city_required`), поэтому запрос
 * гейтится на разрешённом городе ровно так же, как лента акций: город берётся
 * из того же кэша `["me"]`, что и шапка главной, с откатом на город по
 * умолчанию из словаря. Второго запроса профиля это не создаёт.
 */
export function useGuideRoutes(): UseQueryResult<GuideRoute[]> {
  const repository = useRepository();
  const { dictionary: t } = useLocale();

  // Наблюдатель за тем же ключом `["me"]`, что заполняет главная, но БЕЗ
  // собственного запроса (`enabled: false`) и без useAuth: гастрогид открыт и
  // гостю, и требовать здесь AuthProvider значило бы привязать редакционный
  // раздел к авторизации ради одного слова «Алматы». Как только профиль
  // появится в кэше, хук перерисуется сам и переспросит маршруты для его
  // города.
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => Promise.reject(new Error("profile is fetched elsewhere")),
    enabled: false,
  });
  const city = me.data?.city?.trim() || t.explore.cityFallback;

  return useQuery<GuideRoute[]>({
    queryKey: ["guide", "routes", city],
    queryFn: () => repository.getGuideRoutes(city),
    enabled: city.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * РЕАЛЬНЫЕ ДАННЫЕ — один маршрут с остановками, для экрана гастропрогулки.
 * GET /gastroguide/routes/:slug (RestaurantRepository.getGuideRoute).
 *
 * Свой ключ кэша, как и у подборки: список и деталка разной формы, и общий
 * ключ позволил бы дешёвому списку вытеснить дорогую деталку.
 */
export function useGuideRoute(slug: string | undefined): UseQueryResult<GuideRouteDetail> {
  const repository = useRepository();
  return useQuery<GuideRouteDetail>({
    queryKey: ["guide", "route", slug],
    queryFn: () => {
      if (!slug) throw new Error("route slug is required");
      return repository.getGuideRoute(slug);
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

export function useGuideCollections(): UseQueryResult<GuideCollection[]> {
  const repository = useRepository();
  return useQuery<GuideCollection[]>({
    queryKey: ["guide", "collections"],
    queryFn: () => repository.getGuideCollections(),
    // Editorial content changes on a slow timescale, like the rest of Home.
    staleTime: 5 * 60_000,
  });
}

/**
 * REAL DATA — one collection with its venues, for the «Статья» detail screen.
 * GET /gastroguide/collections/:slug (RestaurantRepository.getGuideCollection).
 *
 * Its OWN cache key (`["guide","collection",slug]`) — the list and the detail
 * have different shapes (the detail carries venues), so sharing a key would let
 * the cheap list read evict the expensive detail. Gated on the slug, like
 * useRestaurant.
 */
export function useGuideCollection(
  slug: string | undefined,
): UseQueryResult<GuideCollectionDetail> {
  const repository = useRepository();
  return useQuery<GuideCollectionDetail>({
    queryKey: ["guide", "collection", slug],
    queryFn: () => {
      if (!slug) throw new Error("Missing collection slug");
      return repository.getGuideCollection(slug);
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

/** Maps one collection to the Home strip card. The byline is a UI CONSTANT
 * («От BookEat») — the payload has no author, this is editorial content — and
 * the card's `id` is the slug so a tap can route to `/articles/:slug`. */
function toArticleCardData(collection: GuideCollection, author: string): ArticleCardData {
  return {
    id: collection.slug,
    title: collection.title,
    author,
    coverImageUrl: collection.coverImageUrl,
  };
}

/**
 * «Статьи» on Home — now wired to the live GASTROGUIDE collections.
 *
 * Returns the stable empty PLACEHOLDER_ARTICLES (by reference) while loading, on
 * error, and when there are no collections — so ArticlesSection keeps its
 * hide-on-empty/error behaviour unchanged (its code did not change). The byline
 * comes from the dictionary so it follows the guest's language.
 */
export function useExploreArticles(): readonly ArticleCardData[] {
  const { dictionary: t } = useLocale();
  const query = useGuideCollections();
  const author = t.explore.articleAuthorDefault;
  return useMemo(() => {
    if (!query.data || query.data.length === 0) return PLACEHOLDER_ARTICLES;
    return query.data.slice(0, ARTICLES_LIMIT).map((c) => toArticleCardData(c, author));
  }, [query.data, author]);
}

export type { ArticleCardData, PromoStripItem };
