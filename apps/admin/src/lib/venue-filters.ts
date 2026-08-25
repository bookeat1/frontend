import { sortCuisines, type CatalogVenue, type CuisineDictionaryEntry } from "@bookeat/api/admin";

/**
 * Отбор заведений в каталоге суперадмина: город, кухня, показывается/скрыто и
 * поиск по названию.
 *
 * ЧТО УМЕЕТ СЕРВЕР, а что нет (прочитано, не угадано). `GET /admin/restaurants`
 * → handler.adminList читает ровно `search`, `city`, `page`, `per_page` и
 * жёстко ставит IncludeInactive=true. В `domain.RestaurantFilter` есть ещё
 * category/is_popular/is_new, но НЕТ ни кухни, ни «только активные». Поэтому
 * город и поиск уходят в запрос, а кухня и статус считаются здесь, по уже
 * загруженной странице каталога (45 заведений при потолке per_page=100).
 * Правила ниже повторяют серверные буква в букву (`name ILIKE '%…%'`,
 * `r.city = $1`), чтобы один и тот же набор фильтров давал один и тот же ответ
 * независимо от того, кто его применил.
 *
 * ПРО КУХНЮ. Источников два, и они сосуществуют.
 *   1. СПРАВОЧНИК (`GET /cuisines`, миграции 0079/0080). Если он ответил,
 *      список кухонь берётся из него: значение фильтра — `code` записи
 *      (латиница), подпись — её название. Заведение матчится по своему набору
 *      `venue.cuisines[]`.
 *   2. СТАРЫЙ СПОСОБ — свободный текст `cuisine_type` (в боевой базе 18
 *      написаний, включая составные «Кафе, европейская»). Значение фильтра —
 *      нормализованный текст (кириллица), поэтому с кодами справочника оно не
 *      пересекается и перепутать их нельзя.
 *
 * Пока сервер со справочником не выложен, ручки нет — запрос отвечает ошибкой,
 * в `collectCuisineOptions` приезжает пустой справочник, и фильтр работает
 * ровно как раньше. Заведения, у которых набор кухонь ещё не проставлен,
 * остаются отбираемыми по своему тексту даже когда справочник уже есть: их
 * написания добавляются к списку, иначе такое заведение стало бы не найти.
 */

export type VenueStatusFilter = "all" | "active" | "hidden";

export interface VenueFilters {
  /** Подстрока названия. Регистр не важен — как в серверном ILIKE. */
  search: string;
  /** Точное значение города («Алматы»/«Астана»); "" — любой. */
  city: string;
  /** Ключ кухни (см. cuisineKey); "" — любая. */
  cuisine: string;
  status: VenueStatusFilter;
}

export const EMPTY_VENUE_FILTERS: VenueFilters = {
  search: "",
  city: "",
  cuisine: "",
  status: "all",
};

/** Один пункт выпадающего списка: значение для сравнения и подпись для глаза. */
export interface FilterOption {
  value: string;
  label: string;
}

/** Есть ли хоть один действующий фильтр — от этого зависит и кнопка «Сбросить»,
 * и текст пустой выдачи («ничего не нашлось» ≠ «заведений нет»). */
export function hasActiveVenueFilters(filters: VenueFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.city !== "" ||
    filters.cuisine !== "" ||
    filters.status !== "all"
  );
}

/**
 * Ключ, по которому два написания ТЕКСТОВОЙ кухни считаются одной кухней.
 *
 * Это нормализованный текст: регистр и лишние пробелы разнобой создают, а
 * разной кухни из них не делают. Составные названия («Кафе, европейская») НЕ
 * разбираются на части: в базе это одно значение, и разложить его на две кухни
 * — уже догадка, а не факт.
 */
export function cuisineKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Все значения фильтра, под которые подходит заведение.
 *
 * Есть набор из справочника — отвечают коды набора (их может быть до пяти, и
 * заведение обязано находиться по любой своей кухне, а не только по главной).
 * Набора нет — отвечает нормализованный текст, как раньше.
 */
export function venueCuisineKeys(venue: CatalogVenue): string[] {
  if (venue.cuisines?.length) return venue.cuisines.map((cuisine) => cuisine.code);
  const key = cuisineKey(venue.cuisine_type ?? "");
  return key ? [key] : [];
}

/**
 * Кухни для выпадающего списка.
 *
 * @param venues каталог целиком (не отфильтрованный)
 * @param dictionary справочник; пустой массив = ручки нет или она не ответила —
 *   тогда работает прежний способ, по текстам из данных
 */
export function collectCuisineOptions(
  venues: readonly CatalogVenue[],
  dictionary: readonly CuisineDictionaryEntry[] = [],
): FilterOption[] {
  const fromDictionary = sortCuisines(dictionary.filter((entry) => entry.is_active)).map(
    (entry) => ({ value: entry.code, label: entry.name }),
  );

  // Тексты остаются нужны, пока не все заведения переведены на справочник:
  // берём их только у тех, у кого набора кухонь нет вовсе.
  const byKey = new Map<string, string>();
  for (const venue of venues) {
    if (venue.cuisines?.length) continue;
    const key = cuisineKey(venue.cuisine_type ?? "");
    if (!key || byKey.has(key)) continue;
    byKey.set(key, venue.cuisine_type.trim().replace(/\s+/g, " "));
  }
  const fromText = [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  return [...fromDictionary, ...fromText];
}

/** Города, которые реально встречаются в каталоге. Значение = то, что лежит в
 * колонке: с ним же сервер сравнивает `r.city = $1`. */
export function collectCityOptions(venues: readonly CatalogVenue[]): FilterOption[] {
  const seen = new Map<string, string>();
  for (const venue of venues) {
    const city = (venue.city ?? "").trim();
    if (!city || seen.has(city)) continue;
    seen.set(city, city);
  }
  return [...seen.values()]
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((city) => ({ value: city, label: city }));
}

/** Подходит ли заведение под ВЕСЬ набор фильтров сразу (И, не ИЛИ). */
export function matchesVenueFilters(venue: CatalogVenue, filters: VenueFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !(venue.name ?? "").toLowerCase().includes(search)) return false;
  if (filters.city && (venue.city ?? "").trim() !== filters.city) return false;
  if (filters.cuisine && !venueCuisineKeys(venue).includes(filters.cuisine)) return false;
  if (filters.status === "active" && !venue.is_active) return false;
  if (filters.status === "hidden" && venue.is_active) return false;
  return true;
}

/** Порядок исходного списка сохраняется: его задаёт сервер. */
export function filterVenues(
  venues: readonly CatalogVenue[],
  filters: VenueFilters,
): CatalogVenue[] {
  return venues.filter((venue) => matchesVenueFilters(venue, filters));
}
