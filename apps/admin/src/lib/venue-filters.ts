import type { CatalogVenue } from "@bookeat/api/admin";

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
 * ПРО КУХНЮ. Сегодня `cuisine_type` — свободный текст: в боевой базе 18
 * написаний, включая составные («Кафе, европейская») и разнобой регистра.
 * Список для выпадающего собирается из данных и этот разнобой показывает —
 * честно, потому что именно так заведения и записаны. Всё знание об этом
 * заперто в двух функциях (`cuisineKey` и `collectCuisineOptions`): когда
 * появится справочник кухонь, меняется их содержимое и ничего больше —
 * компонент знает только про `FilterOption[]` и строку-значение.
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
 * Ключ, по которому два написания кухни считаются одной кухней.
 *
 * Сегодня это нормализованный текст: регистр и лишние пробелы разнобой создают,
 * а разной кухни из них не делают. Составные названия («Кафе, европейская») НЕ
 * разбираются на части: в базе это одно значение, и разложить его на две кухни
 * — уже догадка, а не факт. Здесь же будет маппинг на справочник, когда он
 * появится.
 */
export function cuisineKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Кухни, которые реально встречаются в каталоге, по алфавиту. Подпись —
 * первое встреченное написание: выдумывать «правильное» не из чего. */
export function collectCuisineOptions(venues: readonly CatalogVenue[]): FilterOption[] {
  const byKey = new Map<string, string>();
  for (const venue of venues) {
    const key = cuisineKey(venue.cuisine_type ?? "");
    if (!key || byKey.has(key)) continue;
    byKey.set(key, venue.cuisine_type.trim().replace(/\s+/g, " "));
  }
  return [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
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
  if (filters.cuisine && cuisineKey(venue.cuisine_type ?? "") !== filters.cuisine) return false;
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
