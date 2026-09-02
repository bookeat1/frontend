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
 * лишний ключ означал бы второй запрос после переключения языка.
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

/** Ключ избранного. Вынесен: мутация правит ровно этот кэш. */
const FAVORITES_KEY = ["favorites"] as const;

/**
 * Переключатель избранного.
 *
 * Обе ручки на сервере ИДЕМПОТЕНТНЫ (`PUT`/`DELETE /favorites/:id`), поэтому
 * двойное нажатие безвредно, а кнопка на время полёта всё равно заблокирована.
 *
 * Обновление оптимистичное: сердце закрашивается сразу, потому что ждать
 * ответа сети ради галочки — это подвисшая кнопка на плохой связи. Отказ
 * сервера ОТКАТЫВАЕТ состояние, а не оставляет гостя с ложным «сохранено».
 */
export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      next ? repository.addFavorite(id) : repository.removeFavorite(id),
    onMutate: async ({ id, next }) => {
      await client.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = client.getQueryData<Set<string>>(FAVORITES_KEY);
      const optimistic = new Set(previous ?? []);
      if (next) optimistic.add(id);
      else optimistic.delete(id);
      client.setQueryData(FAVORITES_KEY, optimistic);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(FAVORITES_KEY, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });
}
