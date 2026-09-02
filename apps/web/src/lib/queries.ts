"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  Amenity,
  Cuisine,
  EventSummary,
  GuideCollection,
  HomePromo,
  Restaurant,
  RestaurantSummary,
  SearchQuery,
  SearchResult,
} from "@bookeat/api/client";

import { isApiConfigured, repository } from "@web/lib/api";
import { useAuth } from "@web/lib/auth";
import { FAVORITES_KEY } from "@web/lib/query-keys";
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

export function useGuideCollections(): UseQueryResult<GuideCollection[]> {
  const { locale } = useLocale();
  return useQuery({
    queryKey: [locale, "guide-collections"],
    queryFn: () => repository.getGuideCollections(),
    enabled: isApiConfigured,
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
