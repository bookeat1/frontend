"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type InfiniteData,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  Amenity,
  AuthUser,
  Booking,
  BookingPage,
  CreateBookingInput,
  RescheduleBookingInput,
  Cuisine,
  DayAvailability,
  EventPage,
  EventSummary,
  GuideCategory,
  GuideCollection,
  GuideCollectionDetail,
  GuideRoute,
  GuideRouteDetail,
  HomePromo,
  MenuSection,
  PlatformPage,
  PlatformPageSlug,
  Preorder,
  PreorderLineInput,
  ProfileUpdate,
  Promo,
  Restaurant,
  RestaurantSummary,
  SearchQuery,
  SearchResult,
} from "@bookeat/api/client";
import { RepositoryError } from "@bookeat/api/client";

import { authRepository, isApiConfigured, repository } from "@web/lib/api";
import { isNotFound } from "@web/lib/not-found";
import { useAuth } from "@web/lib/auth";
import { BOOKING_KEY, FAVORITES_KEY, MY_BOOKINGS_KEY, PREORDER_KEY } from "@web/lib/query-keys";
import { useLocale } from "@web/lib/locale";

/**
 * Запросы страниц. Все — через `@bookeat/api`; своего слоя HTTP у веба нет.
 *
 * В КАЖДОМ ключе первым элементом стоит локаль. Сервер переводит содержимое по
 * `Accept-Language` (названия кухонь, удобств, описания заведений), поэтому
 * ответы на «тот же» запрос на ru и на en — разные данные. Без локали в ключе
 * переключение языка молча показывало бы прежний перевод из кэша.
 */

/** Сколько карточек в блоке «Выбрали для вас» (сетка 4 колонок, узел 3253:2). */
export const PICKS_LIMIT = 4;
/** Афиша на главной — ряд из трёх карточек (узел 3253:2). */
export const EVENTS_LIMIT = 3;

export function useCuisines(): UseQueryResult<Cuisine[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "cuisines"],
    queryFn: () => repository.getCuisines(),
    enabled: isApiConfigured,
    staleTime: 5 * 60_000,
  });
}

export function useAmenities(): UseQueryResult<Amenity[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "amenities"],
    queryFn: () => repository.getAmenities(),
    enabled: isApiConfigured,
    staleTime: 5 * 60_000,
  });
}

export function usePicks(city: string | undefined): UseQueryResult<RestaurantSummary[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "picks", city],
    // `city!` безопасен: запрос выключен, пока города нет (см. enabled).
    queryFn: () => repository.getRecommendedRestaurants(city, PICKS_LIMIT),
    enabled: isApiConfigured && Boolean(city),
  });
}

export function usePromotions(city: string | undefined): UseQueryResult<HomePromo[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "promotions", city],
    queryFn: () => repository.getPromotions(city as string),
    enabled: isApiConfigured && Boolean(city),
  });
}

export function useEvents(city: string | undefined): UseQueryResult<EventSummary[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "events", city],
    queryFn: () =>
      repository
        .listUpcomingEvents({ city, perPage: EVENTS_LIMIT })
        .then((page) => page.items),
    enabled: isApiConfigured && Boolean(city),
  });
}

/** Страница афиши: сетка 3×2 (узел 5033:6737), «Показать ещё» грузит следующую. */
export const EVENTS_PAGE_SIZE = 6;

/**
 * Полная афиша /events. Бесконечный запрос: страницы накапливаются, кнопка
 * «Показать ещё» дёргает `fetchNextPage`. Сервер отдаёт события по возрастанию
 * даты начала, фильтра по тегу у `GET /events` нет — чипы фильтруют на клиенте
 * то, что уже загружено (см. EventsScreen).
 */
export function useEventsFeed(
  city: string | undefined,
): UseInfiniteQueryResult<InfiniteData<EventPage>> {
  const { locale } = useLocale();
  return useInfiniteQuery({
    queryKey: [locale, "events-feed", city],
    queryFn: ({ pageParam }) =>
      repository.listUpcomingEvents({ city, page: pageParam, perPage: EVENTS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: isApiConfigured && Boolean(city),
  });
}

/**
 * Одно событие для `/events/[id]` (T1). `GET /events/:eventId` — прямая
 * ручка (`internal/transport/rest/events/handler.go:42`), листинг больше не
 * перебирается. Работает и для события платформы (нет `restaurantId`) — это
 * единственная публичная ручка, которая его вообще открывает.
 *
 * 404 не пересылается повтором — тот же приём, что у `useArticle`: отказ
 * (снято с публикации / чужой id) это честное «не найдено», а не сбой связи.
 */
export function useEvent(id: string): UseQueryResult<EventSummary> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "event", id],
    queryFn: () => repository.getEvent(id),
    enabled: isApiConfigured && id.length > 0,
    retry: (failureCount, error) => failureCount < 1 && !isNotFound(error),
  });
}

/**
 * Одна акция для `/promos/[id]` (T1b). `GET /promos/:promoId` — прямая ручка,
 * работает и для акции платформы (нет `restaurantId`). Те же правила отказа,
 * что у `useEvent`.
 */
export function usePromo(id: string): UseQueryResult<Promo> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "promo", id],
    queryFn: () => repository.getPromo(id),
    enabled: isApiConfigured && id.length > 0,
    retry: (failureCount, error) => failureCount < 1 && !isNotFound(error),
  });
}

export function useGuideCollections(): UseQueryResult<GuideCollection[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "guide-collections"],
    queryFn: () => repository.getGuideCollections(),
    enabled: isApiConfigured,
  });
}

/**
 * Справочник рубрик гастрогида — `GET /gastroguide/categories`. Единственный
 * источник ЧЕЛОВЕЧЕСКОГО названия рубрики («Казахская кухня» и т. п.);
 * подборка знает только слаг (`categorySlugs`). Один запрос на страницу
 * (кэш общий у всех плиток), `staleTime` тот же, что у подборок — справочник
 * меняется не чаще редакционного контента. Локаль — в ключе: сервер переводит
 * `title` по `Accept-Language`.
 */
export function useGuideCategories(): UseQueryResult<GuideCategory[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "guide-categories"],
    queryFn: () => repository.getGuideCategories(),
    enabled: isApiConfigured,
    staleTime: 5 * 60_000,
  });
}

/** Раздел «Статьи» — `GET /articles`, только `kind: "article"` (см.
 * `RestaurantRepository.listArticles`). Тот же запрос, что читает приложение. */
export function useArticles(): UseQueryResult<GuideCollection[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "articles"],
    queryFn: () => repository.listArticles(),
    enabled: isApiConfigured,
  });
}

/** Одна статья с блоками заведений — `GET /articles/:slug`. Слаг глобально
 * уникален, поэтому старая ссылка на подборку тоже откроется здесь. */
export function useArticle(slug: string): UseQueryResult<GuideCollectionDetail> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "article", slug],
    queryFn: () => repository.getArticle(slug),
    enabled: isApiConfigured && slug.length > 0,
    retry: (failureCount, error) => failureCount < 1 && !isNotFound(error),
  });
}

/**
 * Одна из семи редактируемых текстовых страниц платформы (T4,
 * `GET /pages/:slug`) — «Как это работает», «Отмена брони», «Оферта»,
 * «Политика данных», «Контакты», «Вакансии», «О BookEat». Неопубликованная
 * страница — 404, повтор запроса на 404 бессмысленен (ровно как у статьи).
 */
export function useSitePage(slug: PlatformPageSlug): UseQueryResult<PlatformPage> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "site-page", slug],
    queryFn: () => repository.getPage(slug),
    enabled: isApiConfigured,
    retry: (failureCount, error) => failureCount < 1 && !isNotFound(error),
  });
}

/**
 * Гастропрогулки `GET /gastroguide/routes?city=` — зеркало
 * `useGuideRoutes` из `apps/mobile/src/components/explore/use-explore-data.ts`:
 * маршруты городские, поэтому город входит в ключ, а без города запрос не
 * уходит (в приложении то же условие `enabled: city.length > 0`).
 */
export function useGuideRoutes(city: string | undefined): UseQueryResult<GuideRoute[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "guide-routes", city],
    queryFn: () => repository.getGuideRoutes(city ?? ""),
    enabled: isApiConfigured && Boolean(city),
  });
}

/**
 * Один маршрут с остановками для `/routes/[slug]` (T — «Маршруты», Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`, узел 5078:5976). `GET /gastroguide/routes/:slug` —
 * зеркало `useGuideRoute` из
 * `apps/mobile/src/components/explore/use-explore-data.ts`. Свой ключ кэша,
 * как у статьи: список и деталка разной формы, общий ключ позволил бы
 * дешёвому списку вытеснить дорогую деталку. 404 не пересылается повтором —
 * неизвестный слаг, черновик и снятый с публикации маршрут дают одинаковый
 * ответ, это честное «не найдено», а не сбой связи.
 */
export function useGuideRoute(slug: string): UseQueryResult<GuideRouteDetail> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "guide-route", slug],
    queryFn: () => repository.getGuideRoute(slug),
    enabled: isApiConfigured && slug.length > 0,
    retry: (failureCount, error) => failureCount < 1 && !isNotFound(error),
  });
}

/**
 * Каталог. Ключ содержит ВЕСЬ запрос: сменился фильтр — сменился ключ, и
 * TanStack Query сам сходит за новой выдачей. Именно это и проверяет тест
 * листинга: клик по фильтру обязан менять аргументы `searchRestaurants`.
 */
export function useCatalog(query: SearchQuery): UseQueryResult<SearchResult> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "catalog", query],
    queryFn: () => repository.searchRestaurants(query),
    enabled: isApiConfigured,
    // Прошлая выдача остаётся на экране, пока едет новая: иначе каждый клик по
    // чипу схлопывал бы список в скелет и страница прыгала бы.
    placeholderData: (previous) => previous,
  });
}

export function useVenue(id: string): UseQueryResult<Restaurant> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "venue", id],
    queryFn: () => repository.getRestaurant(id),
    enabled: isApiConfigured && id.length > 0,
    // 404 — это ответ, а не сбой связи: повторять его бессмысленно.
    retry: (failureCount, error) =>
      failureCount < 1 && !(error instanceof Error && "status" in error && error.status === 404),
  });
}

/**
 * Полное меню заведения (`GET /restaurants/:id/menu`) — страница «Меню
 * {заведение}» (узел 5115:7448), не шесть карточек «Популярное в меню» на
 * самой странице заведения. Тот же запрос и та же форма ответа
 * (`MenuSection[]`), что у мобильного `useMenuSections`
 * (`apps/mobile/src/hooks/useBooking.ts`) — до ~300 блюд, разделы без блюд
 * сервер не отдаёт. Локаль в ключе: названия и описания блюд переводит
 * сервер по `Accept-Language`.
 */
export function useMenuSections(id: string): UseQueryResult<MenuSection[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "menu-sections", id],
    queryFn: () => repository.getMenuSections(id),
    enabled: isApiConfigured && id.length > 0,
  });
}

/**
 * Избранное гостя.
 *
 * Ключ БЕЗ локали: это список идентификаторов, перевод на него не влияет, а
 * лишний ключ означал бы второй запрос после переключения языка. Зато ключ
 * ПРИВЯЗАН К СЕССИИ — его чистит `AuthProvider` при входе и выходе, см.
 * `lib/query-keys.ts`.
 *
 * Запрос уходит только у вошедшего: `GET /favorites` требует сессию и гостю
 * без неё ответит 401. Пока сессия читается из хранилища (`isLoading`), не
 * ходим тоже — иначе первый заход после перезагрузки страницы гарантированно
 * ловит 401.
 */
export function useFavoriteIds(): UseQueryResult<Set<string>> {
  const { signedIn, isLoading } = useAuth();
  return useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: () =>
      repository.getFavorites().then((items) => new Set(items.map((item) => item.id))),
    enabled: isApiConfigured && signedIn && !isLoading,
    staleTime: 60_000,
  });
}

/**
 * Переключатель избранного.
 *
 * Обновление оптимистичное: сердце закрашивается сразу, потому что ждать
 * ответа сети ради галочки — это подвисшая кнопка на плохой связи. Отказ
 * сервера ОТКАТЫВАЕТ состояние, а не оставляет гостя с ложным «сохранено».
 *
 * ОТКАТ ПОШТУЧНЫЙ, А НЕ СНИМКОМ ВСЕГО СПИСКА. Снимок выглядит проще и ломается
 * на двух нажатиях подряд: гость добавляет A, следом B; A успел снять снимок
 * пустого множества, B — снимок `{A}`. Падает A — и его откат кладёт обратно
 * пустое множество, стирая B, хотя запрос B успешен или ещё летит. Гость видит
 * ложь, пока не приедет перезапрос. Поэтому в откате правится РОВНО ТОТ id,
 * который менялся, а остальное множество остаётся таким, каким его сделали
 * соседние мутации.
 *
 * ДАННЫХ МОГЛО НЕ БЫТЬ ВОВСЕ. Если гость нажал сердце раньше, чем ответил
 * `GET /favorites`, оптимистичное множество ПРИДУМАНО клиентом целиком: до
 * него в кэше не было ничего. Возвращать в этом случае «пустое множество»
 * нельзя — это выдало бы за ответ сервера то, чего сервер не говорил (и заодно
 * скрыло бы состояние загрузки). Запрос удаляется, наблюдатель тут же просит
 * его заново. Заметить `setQueryData(key, undefined)` тут не выйдет: в
 * TanStack Query v5 значение `undefined` означает «не менять» и молча
 * игнорируется — поэтому именно `removeQueries`.
 */
export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      next ? repository.addFavorite(id) : repository.removeFavorite(id),
    onMutate: async ({ id, next }) => {
      await client.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = client.getQueryData<Set<string>>(FAVORITES_KEY);
      client.setQueryData<Set<string>>(FAVORITES_KEY, (current) => {
        const optimistic = new Set(current ?? previous ?? []);
        if (next) optimistic.add(id);
        else optimistic.delete(id);
        return optimistic;
      });
      // Хранится не снимок, а ДВА факта: были ли данные вообще и лежал ли в
      // них ЭТОТ id. Больше для отката ничего не нужно.
      return { hadData: previous !== undefined, wasFavorite: previous?.has(id) ?? false };
    },
    onError: (_error, { id }, context) => {
      if (!context) return;
      if (!context.hadData) {
        client.removeQueries({ queryKey: FAVORITES_KEY });
        return;
      }
      client.setQueryData<Set<string>>(FAVORITES_KEY, (current) => {
        if (!current) return current;
        const restored = new Set(current);
        if (context.wasFavorite) restored.add(id);
        else restored.delete(id);
        return restored;
      });
    },
    onSettled: () => {
      // После `removeQueries` запроса в кэше нет, и перезапрос уже начал
      // наблюдатель — второй незачем.
      if (client.getQueryState(FAVORITES_KEY) === undefined) return;
      void client.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });
}

/**
 * Свободное время заведения на один день (`GET /restaurants/:id/availability`).
 *
 * КЛЮЧ БЕЗ ЛОКАЛИ, в отличие от остальных: ответ — это время и машинные
 * причины отказа (`too_soon`, `capacity`, …), переводить в нём нечего, а
 * лишний ключ означал бы повторный запрос после переключения языка.
 *
 * Размер компании — ЧАСТЬ КЛЮЧА, а не деталь запроса: ответ на двоих ничего не
 * говорит о шестерых, и общий кэш показывал бы гостю чужие слоты.
 *
 * `staleTime: 0`: слот перестаёт быть свободным в тот момент, когда его занял
 * кто-то другой, и цена устаревшего ответа здесь — 409 на кнопке.
 *
 * Запрос НЕ уходит, когда заведение не принимает онлайн-брони
 * (`acceptsOnlineBookings === false`): сервер по такому заведению не выдаст
 * слот ни на одну дату. `undefined` (заведение ещё едет) запрос не блокирует
 * — блокирует отсутствие даты, потому что «сегодня» знает только браузер.
 */
export function useAvailability(input: {
  restaurantId: string;
  date: string | null;
  guests: number;
  acceptsOnlineBookings?: boolean;
}): UseQueryResult<DayAvailability> {
  const { restaurantId, date, guests, acceptsOnlineBookings } = input;
  return useQuery({
    queryKey: ["availability", restaurantId, date, guests],
    // `date!` безопасен: без даты запрос выключен (см. enabled).
    queryFn: () =>
      repository.getAvailability({ restaurantId, date: date as string, guests }),
    enabled:
      isApiConfigured &&
      restaurantId.length > 0 &&
      Boolean(date) &&
      acceptsOnlineBookings !== false,
    staleTime: 0,
  });
}

export interface CreateBookingVariables {
  input: CreateBookingInput;
  /**
   * Обязателен: без заголовка `Idempotency-Key` сервер отвечает 422. Один и
   * тот же ключ на повтор ОДНОЙ И ТОЙ ЖЕ брони — иначе второе нажатие или
   * автоматический повтор запроса дают гостю два стола.
   */
  idempotencyKey: string;
  /**
   * Черновик предзаказа гостя, если он есть (A-WEB-4). Отправляется ВТОРЫМ
   * запросом, ПОСЛЕ того как бронь создана: `PUT /bookings/:id/preorder`
   * бронь-скоуп, его нельзя позвать раньше, чем бронь появилась, а
   * `POST /bookings` цену строк берёт от клиента (риск R-A2 спеки
   * `venue-menu-stepper-promo-card`) — веб этим путём не пользуется.
   */
  preorder: PreorderLineInput[];
}

export interface CreateBookingOutcome {
  booking: Booking;
  /**
   * Бронь создана, а прикрепить предзаказ не вышло (после одного повтора).
   * Это НЕ отказ брони — стол за гостем остался, флоу идёт на страницу брони
   * с честным уведомлением (A10).
   */
  preorderFailed: boolean;
}

/** Сетевой сбой или 5xx — стоит попробовать ещё раз; 4xx детерминирован
 * (стоп-лист, минимальная сумма, `preorder_locked`) — второй `PUT` даст тот
 * же ответ, значит достаточно один раз ("A10", 🟡 раздела 6 спеки). */
function isRetryablePreorderFailure(error: unknown): boolean {
  if (!(error instanceof RepositoryError)) return true;
  return error.status === undefined || error.status >= 500;
}

/**
 * Создание брони гостем (`POST /bookings`), затем — если гость набрал
 * предзаказ — `PUT /bookings/:id/preorder` вторым запросом.
 *
 * `POST /bookings` уходит БЕЗ `items`: в макете карточки его нет, цену строк
 * должен посчитать сервер по своему меню, а не принять от клиента (A9).
 *
 * Повторов у `POST /bookings` НЕТ. TanStack Query по умолчанию повторяет
 * неудачную мутацию ноль раз, и менять это нельзя: сеть могла оборваться
 * ПОСЛЕ того, как сервер принял запрос, и слепой повтор — это второй стол на
 * то же имя. От двойного нажатия защищает ключ идемпотентности, а не ретрай.
 *
 * У `PUT /bookings/:id/preorder` повтор ЕСТЬ, и он безопасен ровно потому,
 * что это идемпотентная ЗАМЕНА (не добавление) строк — в отличие от
 * `POST /bookings`.
 */
export function useCreateBooking() {
  const client = useQueryClient();
  return useMutation<CreateBookingOutcome, unknown, CreateBookingVariables>({
    mutationFn: async ({ input, idempotencyKey, preorder }) => {
      const booking = await repository.createBooking(input, idempotencyKey);
      if (preorder.length === 0) {
        return { booking, preorderFailed: false };
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await repository.setPreorder(booking.id, preorder);
          return { booking, preorderFailed: false };
        } catch (error) {
          if (attempt === 0 && isRetryablePreorderFailure(error)) continue;
          return { booking, preorderFailed: true };
        }
      }
      return { booking, preorderFailed: true };
    },
    onSuccess: ({ booking }) => {
      // Слот, который заняла эта бронь, больше не свободен — всё, что лежит в
      // кэше по доступности этого заведения, стало неправдой.
      void client.invalidateQueries({ queryKey: ["availability", booking.restaurantId] });
      // Страница «Бронь подтверждена» читает бронь по этому ключу: с ответом
      // в кэше она открывается без второго запроса и без скелета.
      client.setQueryData([...BOOKING_KEY, booking.id], booking);
    },
  });
}

/**
 * Предзаказ уже созданной брони (`GET /bookings/:id/preorder`) — страница
 * «Бронь подтверждена», блок «Предзаказ» (A13). Сумма в ответе СЕРВЕРНАЯ
 * (`total_minor`), не оценка клиентского черновика.
 *
 * Отказ этого запроса не должен рушить страницу билета (A13) — вызывающий
 * читает `isError`/`data` сам и решает не показывать блок вовсе, билет при
 * этом остаётся на месте.
 */
export function usePreorder(bookingId: string | undefined): UseQueryResult<Preorder> {
  const { signedIn, isLoading } = useAuth();
  return useQuery({
    queryKey: [...PREORDER_KEY, bookingId],
    queryFn: () => {
      if (!bookingId) throw new Error("Missing booking id");
      return repository.getPreorder(bookingId);
    },
    enabled: isApiConfigured && Boolean(bookingId) && signedIn && !isLoading,
    retry: 1,
  });
}

/**
 * Одна бронь гостя (`GET /bookings/:id`) — источник данных страницы
 * «Бронь подтверждена».
 *
 * КЛЮЧ БЕЗ ЛОКАЛИ: в ответе только время, числа и машинный статус, переводить
 * нечего, а лишний ключ означал бы повторный запрос после переключения языка.
 *
 * Ходим ТОЛЬКО у вошедшего: ручка требует сессию и гостю без неё ответит 401.
 * Пока сессия читается из хранилища (`isLoading`), не ходим тоже — иначе
 * первый заход после перезагрузки страницы гарантированно ловит 401.
 *
 * 404 НЕ ПОВТОРЯЕМ: чужая или несуществующая бронь — это ответ, а не сбой
 * связи, и три попытки подряд ничего не изменят.
 */
export function useBooking(bookingId: string): UseQueryResult<Booking> {
  const { signedIn, isLoading } = useAuth();
  return useQuery({
    queryKey: [...BOOKING_KEY, bookingId],
    queryFn: () => repository.getBooking(bookingId),
    enabled: isApiConfigured && bookingId.length > 0 && signedIn && !isLoading,
    retry: (failureCount, error) =>
      failureCount < 1 &&
      !(error instanceof Error && "status" in error && (error as { status?: number }).status === 404),
  });
}

/**
 * Перенос брони — другое время и/или число гостей (`PATCH /bookings/:id`).
 *
 * Это НЕ «отменить и создать заново»: у брони есть история, подтверждение
 * заведения и уведомления, и пересоздание всё это обнуляет.
 *
 * ИДЕМПОТЕНТНОСТИ У ЭТОЙ РУЧКИ НЕТ. `POST /bookings` защищён заголовком
 * `Idempotency-Key`, `PATCH /bookings/:id` — нет (см. `rescheduleBooking` в
 * `packages/api/src/repository.ts`), поэтому единственный запрос в полёте
 * обязан гарантировать ВЫЗЫВАЮЩИЙ. Экран делает это тем же способом, что и при
 * создании: пока `isPending`, кнопка заблокирована, а изменения выбора
 * отбрасываются.
 *
 * Повторов нет по той же причине, что и у создания: сеть могла оборваться
 * ПОСЛЕ того, как сервер применил перенос.
 */
export interface RescheduleBookingVariables {
  bookingId: string;
  input: RescheduleBookingInput;
}

export function useRescheduleBooking() {
  const client = useQueryClient();
  return useMutation<Booking, unknown, RescheduleBookingVariables>({
    mutationFn: ({ bookingId, input }) => repository.rescheduleBooking(bookingId, input),
    onSuccess: (booking) => {
      // Прежнее время освободилось, новое занято — всё, что лежит в кэше по
      // доступности этого заведения, стало неправдой.
      void client.invalidateQueries({ queryKey: ["availability", booking.restaurantId] });
      // И сама бронь в кэше — тоже: страница успеха читает её по ключу ниже.
      client.setQueryData([...BOOKING_KEY, booking.id], booking);
    },
  });
}

/**
 * Сколько броней просим для страницы профиля. `GET /bookings` отдаёт
 * страницами; сегменты «Активные / Прошедшие / Отменённые» считаются на
 * клиенте, поэтому берём одну крупную страницу, а не листаем. Если у гостя
 * броней больше — экран честно пишет «показаны N из M», а не выдумывает счёт.
 */
export const MY_BOOKINGS_PAGE_SIZE = 50;

/**
 * Брони гостя (`GET /bookings`). Ключ без локали — в ответе время, числа и
 * машинный статус. Ходим только у вошедшего, пока сессия читается — нет
 * (иначе гарантированный 401 после перезагрузки). Ключ привязан к сессии:
 * его чистит `AuthProvider`.
 */
export function useMyBookings(): UseQueryResult<BookingPage> {
  const { signedIn, isLoading } = useAuth();
  return useQuery({
    queryKey: MY_BOOKINGS_KEY,
    queryFn: () => repository.listMyBookings({ page: 1, perPage: MY_BOOKINGS_PAGE_SIZE }),
    enabled: isApiConfigured && signedIn && !isLoading,
  });
}

/**
 * Избранные заведения целиком (`GET /favorites`) — для вкладки «Избранное».
 *
 * Ключ — ПОД префиксом `FAVORITES_KEY`: чистка сессии по префиксу снимает и
 * его, а `invalidateQueries` в `useToggleFavorite` после каждого нажатия
 * сердца перезапрашивает список — снятая карточка исчезает сама. Локаль в
 * ключе есть: названия кухонь в ответе переведены сервером.
 */
export function useFavoriteVenues(): UseQueryResult<RestaurantSummary[]> {
  const { locale } = useLocale();
  const { signedIn, isLoading } = useAuth();
  return useQuery({
    queryKey: [...FAVORITES_KEY, "venues", locale],
    queryFn: () => repository.getFavorites(),
    enabled: isApiConfigured && signedIn && !isLoading,
    staleTime: 60_000,
  });
}

/**
 * Отмена брони гостем (`POST /bookings/:id/cancel`). Повторов нет: сеть
 * могла оборваться после того, как сервер уже отменил. После ответа список
 * профиля перезапрашивается, а сама бронь кладётся в кэш по своему ключу.
 */
export function useCancelBooking() {
  const client = useQueryClient();
  return useMutation<Booking, unknown, { bookingId: string }>({
    mutationFn: ({ bookingId }) => repository.cancelBooking(bookingId),
    onSuccess: (booking) => {
      client.setQueryData([...BOOKING_KEY, booking.id], booking);
      void client.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });
      void client.invalidateQueries({ queryKey: ["availability", booking.restaurantId] });
    },
  });
}

/**
 * «Настройки» → «Личные данные» (`PATCH /users/me`). Единственные поля,
 * которые сервер реально принимает, — `fullName`/`city`/`birthDate`
 * (`ProfileUpdate`, `packages/api/src/types.ts`); телефон и почта на этом
 * экране только показываются — их меняют по-другому (код на телефон,
 * мобильное приложение).
 *
 * Кэш не инвалидируется — вызывающая сторона сама кладёт свежего пользователя
 * в `useAuth().applyUser`, это и есть источник правды для карточки гостя.
 */
export function useUpdateProfile() {
  return useMutation<AuthUser, unknown, ProfileUpdate>({
    mutationFn: (input) => authRepository.updateMe(input),
  });
}
