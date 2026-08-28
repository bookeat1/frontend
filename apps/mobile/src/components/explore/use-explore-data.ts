import type {
  AuthUser,
  Cuisine,
  EventPage,
  EventSummary,
  GuideCategory,
  GuideCollection,
  GuideRoute,
  GuideRouteDetail,
  GuideCollectionDetail,
  HomePromo,
  RestaurantSummary,
} from "@bookeat/api";
import {
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/locale";
import { useCuisines } from "../../hooks/useCuisines";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { usePreferredCity } from "../../lib/preferred-city";
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

/** Сколько заведений показывает «Выбрали для вас». Уходит на сервер как
 * `limit`, а не обрезается на клиенте: обрезка молча выкинула бы хвост
 * РУЧНОГО списка владельца, и он не понял бы, куда делись заведения. */
const RECOMMENDED_LIMIT = 8;

/** How many events «Афиша» asks for. The vertical list stays short on the home
 * screen; a dedicated events screen would paginate. */
const EXPLORE_EVENTS_LIMIT = 12;

/** How many collections the Home «Статьи» strip shows. The list screen shows
 * them all; the strip is capped, like «Выбрали для вас». */
const ARTICLES_LIMIT = 6;

/**
 * РЕАЛЬНЫЕ ДАННЫЕ — «Выбрали для вас».
 * `GET /restaurants/picks?city=<город>` (RestaurantRepository.getRecommendedRestaurants).
 *
 * СОСТАВ БЛОКА ТЕПЕРЬ МОЖЕТ БЫТЬ ЗАДАН РУКАМИ. Ручка сама решает, что
 * ответить: ручной список города → общий ручной список → прежний автоматический
 * подбор. Клиент по ответу не отличает эти ветки и не должен: порядок ответа
 * берётся КАК ЕСТЬ, потому что в ручном списке порядок — это решение владельца.
 *
 * ГОРОД — те же три обязательные части, что и у «Афиши» и «Акций»:
 * параметр запроса, город В КЛЮЧЕ КЭША (иначе после смены города покажется
 * подборка предыдущего) и гейт `isResolving` (иначе на холодном старте в
 * Астане мелькнёт подборка откатного города). Любая одна часть без остальных
 * чинит городской запрос наполовину.
 */
export function useRecommendedRestaurants() {
  const repository = useRepository();
  const { city, isResolving } = useGuestCity();
  return useQuery<RestaurantSummary[]>({
    queryKey: ["home-picks", city, RECOMMENDED_LIMIT],
    queryFn: () => repository.getRecommendedRestaurants(city, RECOMMENDED_LIMIT),
    enabled: !isResolving,
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
 * The city every city-scoped surface asks for, resolved in ONE place — the
 * Home header included (app/index.tsx displays exactly this value).
 *
 * PRECEDENCE — THE DEVICE WINS, and this is the rule to reason from:
 *
 *   1. the city chosen ON THIS DEVICE (`usePreferredCity`, expo-secure-store);
 *   2. otherwise the ACCOUNT's city from the shared `["me"]` cache;
 *   3. otherwise the locale's default (`t.explore.cityFallback` — «Алматы»).
 *
 * WHY THE DEVICE FIRST. The stored value is always the result of an explicit
 * tap on this phone, and it is available before any network answer. That makes
 * the choice instant for a signed-out guest (who has no profile to write to at
 * all — this is the bug that made the picker do nothing) and it means the
 * profile landing a second later can never flip the content under someone who
 * has just chosen.
 *
 * WHAT IF THE TWO DISAGREE. They can, in two ways, and neither is allowed to
 * change the city silently:
 *
 *   • picked a city as a guest, then signed in to a profile that says another
 *     city → the picked city stays, on screen and in the queries. The profile
 *     is NOT copied down. It follows the next explicit pick instead.
 *   • signed in on a second device / a fresh install → nothing is stored
 *     locally, so rule 2 applies and the account's city is used. That IS the
 *     cross-device sync, and there is nothing on this device to flip.
 *
 * So: nothing ever copies the profile into the device, and nothing ever copies
 * the device into the profile behind the guest's back. Both are written only by
 * an explicit pick (the header picker and the profile screens both call
 * `useSetPreferredCity` alongside their `PATCH /users/me`).
 *
 * `isResolving` is the part that is easy to miss: a disabled query is
 * `isPending` too, so "we don't know the city yet" is NOT `me.isPending` —
 * that would gate a signed-out guest forever. It is: the device read has not
 * come back yet, OR auth is still booting, OR we are signed in, the profile
 * request is in flight AND this device has no stored city to answer with.
 * Firing a city-scoped query during that window would fetch the fallback city
 * first and the real one a moment later — a visible flash of another city's
 * content on every cold start in Astana.
 */
export function useGuestCity(): { city: string; isResolving: boolean } {
  const { status, repository: authRepository } = useAuth();
  const { dictionary: t } = useLocale();
  const stored = usePreferredCity();

  // Same query key + fetcher + gate as app/index.tsx, so this shares that
  // cache entry rather than issuing a second GET /users/me.
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => authRepository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  const deviceCity = stored.city?.trim();

  return {
    city: deviceCity || me.data?.city?.trim() || t.explore.cityFallback,
    isResolving:
      stored.isHydrating ||
      (!deviceCity && (status === "loading" || (status === "signed-in" && me.isLoading))),
  };
}

/**
 * REAL DATA — «Афиша».
 * GET /events?city=<city> (RestaurantRepository.listUpcomingEvents).
 *
 * CITY: without it the list showed every city's events on every phone. The
 * server filters by the HOST VENUE's city (`PublicEventFilter.City` — events
 * carry no city of their own), and an unknown value simply matches nothing,
 * so the value sent must be the same city string the rest of Home uses. The
 * city is therefore part of the QUERY KEY as well as the request: without
 * that, switching the city would keep serving the previous city's cached page.
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
  const { city, isResolving } = useGuestCity();
  return useQuery<EventPage>({
    queryKey: ["explore-events", EXPLORE_EVENTS_LIMIT, city],
    queryFn: () => repository.listUpcomingEvents({ perPage: EXPLORE_EVENTS_LIMIT, city }),
    enabled: !isResolving,
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
 * so the query is gated on a resolved city — see useGuestCity, which is the
 * single place the Home queries resolve it (the `["me"]` cache the header
 * reads, falling back to the locale's default city).
 *
 * EMPTY/LOADING/ERROR: returns the stable empty array (PLACEHOLDER_PROMOTIONS)
 * until real promos arrive, so «Акции» stays hidden while loading, on error,
 * and when the feed has no promos for the city — the behaviour PromotionsSection
 * relies on.
 */
export function useExplorePromotionsQuery(): UseQueryResult<HomePromo[]> {
  const repository = useRepository();
  const { city, isResolving } = useGuestCity();

  return useQuery<HomePromo[]>({
    queryKey: ["home-feed", "promos", city],
    queryFn: () => repository.getPromotions(city),
    enabled: city.length > 0 && !isResolving,
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
/**
 * Город для ЭКРАНОВ ГАСТРОГИДА — тот же порядок старшинства, что и у
 * `useGuestCity` (выбор на этом устройстве → город профиля → откат словаря),
 * но БЕЗ `useAuth`.
 *
 * Отдельный хук именно поэтому: гастрогид открыт и гостю, и требовать здесь
 * `AuthProvider` значило бы привязать редакционный раздел к авторизации ради
 * одного слова «Алматы». Профиль читается наблюдателем за тем же ключом
 * `["me"]`, что заполняет главная, но БЕЗ собственного запроса
 * (`enabled: false`) — второго обращения к серверу это не создаёт, а как
 * только профиль появится в кэше, хук перерисуется сам.
 *
 * `isResolving` — «город ещё неизвестен»: пока читается хранилище устройства,
 * городозависимый запрос слать рано, иначе гость увидит вспышку чужого города.
 */
export function useGuideCity(): { city: string; isResolving: boolean } {
  const { dictionary: t } = useLocale();
  const stored = usePreferredCity();
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => Promise.reject(new Error("profile is fetched elsewhere")),
    enabled: false,
  });
  return {
    city: stored.city?.trim() || me.data?.city?.trim() || t.explore.cityFallback,
    isResolving: stored.isHydrating,
  };
}

export function useGuideRoutes(): UseQueryResult<GuideRoute[]> {
  const repository = useRepository();
  const { city, isResolving } = useGuideCity();

  return useQuery<GuideRoute[]>({
    queryKey: ["guide", "routes", city],
    queryFn: () => repository.getGuideRoutes(city),
    // Пока читается город устройства, спрашивать маршруты рано — иначе на
    // холодном старте мелькнут маршруты чужого города.
    enabled: city.length > 0 && !isResolving,
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
 * РЕАЛЬНЫЕ ДАННЫЕ — СТАТЬИ. `GET /articles` (RestaurantRepository.listArticles).
 *
 * ОТДЕЛЬНАЯ РУЧКА, А НЕ ФИЛЬТР ПО `kind` НАД ПОДБОРКАМИ. Владелец развёл
 * статьи и рубрики гастрогида как разные сущности (2026-08-28), и клиентский
 * отбор одного ответа означал бы, что оба раздела делят одну страницу выдачи:
 * четыре подборки вытеснили бы статьи из первой страницы и наоборот. Поэтому
 * и ключ кэша СВОЙ (`["articles","list"]`) — общий с подборками заставил бы
 * один экран показывать данные другого.
 *
 * Пустой ответ — норма («ничего не опубликовали»): на главной раздел прячется,
 * на экране `/articles` показывается спокойное пустое состояние.
 */
export function useArticles(): UseQueryResult<GuideCollection[]> {
  const repository = useRepository();
  return useQuery<GuideCollection[]>({
    queryKey: ["articles", "list"],
    queryFn: () => repository.listArticles(),
    // Редакционный контент меняется медленно — тот же staleTime, что у
    // подборок гастрогида.
    staleTime: 5 * 60_000,
  });
}

/**
 * РЕАЛЬНЫЕ ДАННЫЕ — одна статья с её заведениями, для страницы `/articles/:slug`.
 * GET /articles/:slug (RestaurantRepository.getArticle).
 *
 * Свой ключ кэша (`["articles","item",slug]`), как и у подборки: список и
 * деталка разной формы, и общий ключ позволил бы дешёвому списку вытеснить
 * дорогую деталку.
 */
export function useArticle(slug: string | undefined): UseQueryResult<GuideCollectionDetail> {
  const repository = useRepository();
  return useQuery<GuideCollectionDetail>({
    queryKey: ["articles", "item", slug],
    queryFn: () => {
      if (!slug) throw new Error("Missing article slug");
      return repository.getArticle(slug);
    },
    enabled: Boolean(slug),
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

/**
 * РЕАЛЬНЫЕ ДАННЫЕ — рубрики гастрогида. GET /gastroguide/categories
 * (RestaurantRepository.getGuideCategories).
 *
 * Ручка отдаёт РОВНО `{id, slug, title, position}`: ни обложки, ни описания.
 * Поэтому она источник ОДНОЙ вещи — названия рубрики; всё остальное на экране
 * рубрики приходит от подборок, помеченных этим слагом.
 *
 * Своим запросом это не становится дорого: список рубрик крошечный и меняется
 * не чаще редакционных подборок, поэтому `staleTime` тот же.
 */
export function useGuideCategories(): UseQueryResult<GuideCategory[]> {
  const repository = useRepository();
  return useQuery<GuideCategory[]>({
    queryKey: ["guide", "categories"],
    queryFn: () => repository.getGuideCategories(),
    staleTime: 5 * 60_000,
  });
}

/**
 * НЕСКОЛЬКО подборок с их заведениями — для экрана рубрики, где заведения
 * собираются из ВСЕХ подборок рубрики.
 *
 * `useQueries`, а не цикл из `useGuideCollection`: количество слагов зависит
 * от ответа сервера, а хук в цикле — нарушение правил хуков. На проде
 * 2026-08-28 у рубрики ровно одна подборка, но зашивать это в экран нельзя:
 * вторая подборка в рубрике не должна молча пропасть.
 *
 * КЛЮЧИ КЭША ТЕ ЖЕ, что у `useGuideCollection` (`["guide","collection",slug]`),
 * — открытая до этого страница подборки уже лежит в кэше и лишнего запроса не
 * будет.
 */
export function useGuideCollectionDetails(
  slugs: readonly string[],
): UseQueryResult<GuideCollectionDetail>[] {
  const repository = useRepository();
  return useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["guide", "collection", slug],
      queryFn: () => repository.getGuideCollection(slug),
      staleTime: 5 * 60_000,
    })),
  });
}

/** Maps one article to the Home strip card. The byline is a UI CONSTANT
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
 * «Статьи» на главной — читает `GET /articles`, а НЕ подборки гастрогида.
 *
 * БЫЛО `useGuideCollections()`: раздел кормился той же ручкой, что и гастрогид,
 * и вёл на его экран. Владелец увидел это как баг («Статьи и рубрики гастрогида
 * это разные сущности»), и починка — здесь, в источнике данных: с этой строкой
 * ни одна подборка на главную попасть не может.
 *
 * Возвращает стабильный пустой PLACEHOLDER_ARTICLES (по ссылке) во время
 * загрузки, при отказе и когда статей нет, — так ArticlesSection сохраняет своё
 * поведение «прятаться на пустом». Подпись автора берётся из словаря и следует
 * языку гостя.
 */
export function useExploreArticles(): readonly ArticleCardData[] {
  const { dictionary: t } = useLocale();
  const query = useArticles();
  const author = t.explore.articleAuthorDefault;
  return useMemo(() => {
    if (!query.data || query.data.length === 0) return PLACEHOLDER_ARTICLES;
    return query.data.slice(0, ARTICLES_LIMIT).map((c) => toArticleCardData(c, author));
  }, [query.data, author]);
}

export type { ArticleCardData, PromoStripItem };

/* --------------------------------------------------------------------------
 * ОБНОВЛЕНИЕ ГЛАВНОЙ ЖЕСТОМ
 * ----------------------------------------------------------------------- */

/**
 * Корни ключей запросов, из которых сложена ГЛАВНАЯ.
 *
 * Это список того, что гость ВИДИТ на этом экране, и он нужен буквально:
 * `refetchQueries` без фильтра перезапросил бы весь кэш приложения — брони,
 * профиль заведения, справочник городов, — то есть жест на главной незаметно
 * тратил бы сеть на чужие экраны.
 *
 * Города в ключах нет намеренно: `["explore-events", 12, "Астана"]` и
 * `["home-feed","promos","Астана"]` различаются хвостом, а какой именно город
 * сейчас показан — знает не этот список, а активность самого запроса (см.
 * `refetchHomeQueries`). Так обновление не промахивается мимо ключа после
 * смены города.
 */
const HOME_QUERY_ROOTS: ReadonlySet<string> = new Set([
  "home-picks", // «Выбрали для вас» (GET /restaurants/picks)
  "catalog-preview", // фотографии кругов «Выберите кухню»
  "cuisines", // справочник кухонь (CUISINES_QUERY_KEY)
  "explore-events", // «Афиша»
  "home-feed", // «Акции»
  "me", // имя и город в шапке
]);

/** Ключ этого запроса рисует что-то на главной? */
export function isHomeQueryKey(key: readonly unknown[]): boolean {
  const root = key[0];
  if (typeof root !== "string") return false;
  // «Статьи» — общий корень у СПИСКА статей (он на главной) и у деталки одной
  // статьи (её на главной нет). Совпадение по одному корню `articles` тянуло
  // бы за собой чужой экран.
  if (root === "articles") return key[1] === "list";
  // Гастрогида на главной больше НЕТ вовсе: раздел «Статьи» переехал на
  // `GET /articles`, а подборки живут на своей вкладке. Поэтому корень
  // `guide` сюда не попадает ни в каком виде — обновление главной не должно
  // ходить за данными другого раздела.
  return HOME_QUERY_ROOTS.has(root);
}

/**
 * Обновление главной жестом.
 *
 * ПОЧЕМУ `refetchQueries`, А НЕ СПИСОК `refetch()`. Блоки главной ходят за
 * данными сами — экран не держит их запросов в руках и, чтобы собрать шесть
 * `refetch`, ему пришлось бы смонтировать те же шесть хуков ВТОРОЙ раз ради
 * одного жеста. `refetchQueries` спрашивает у кэша ровно то, что сейчас
 * смонтировано, и возвращает ОДИН промис, который завершается, когда улеглись
 * все ответы, — именно то, что должно гасить кружок.
 *
 * ПОЧЕМУ НЕ `invalidateQueries`. Пометка «устарело» перезапрашивает то же
 * самое, но её промис говорит про пометку, а не про ответы; кружок гас бы
 * сразу. Плюс инвалидация оставляет мину замедленного действия на запросах,
 * которых на экране нет.
 *
 * ФИЛЬТР `type: "active"` — вторая половина точности: перезапрашивается только
 * то, у чего есть живой наблюдатель, то есть буквально видимые блоки. Кэш
 * главной, оставшийся от прошлого города или от прошлого визита, не трогается,
 * и выключенный запрос профиля у гостя без сессии — тоже.
 *
 * ЖЕСТ МОЛЧИТ, ПОКА НЕ ИЗВЕСТЕН ГОРОД (`isResolving`): городские запросы в это
 * время ещё не стартовали, и обновление либо не сделало бы ничего, либо
 * успело бы сходить за откатным городом.
 */
export function useHomeRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const queryClient = useQueryClient();
  const { isResolving } = useGuestCity();

  const refresh = useCallback(
    () =>
      queryClient.refetchQueries({
        type: "active",
        predicate: (query) => isHomeQueryKey(query.queryKey),
      }),
    [queryClient],
  );

  return usePullToRefresh(refresh, { enabled: !isResolving });
}
