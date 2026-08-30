"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
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
