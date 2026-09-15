import { EMPTY_FILTERS, type PriceLevel, type SearchQuery } from "@bookeat/api/client";

/**
 * Состояние листинга живёт в АДРЕСНОЙ СТРОКЕ, а не в useState.
 *
 * Так ссылку на выдачу можно отправить, «назад» возвращает прежние фильтры, а
 * серверный рендер видит ровно то, что видит гость. Здесь — единственное
 * место, где параметры превращаются в запрос к API и обратно, поэтому именно
 * это и покрыто тестами: клик по фильтру обязан менять аргументы
 * `searchRestaurants`, а не только вид чипа.
 */
export type CatalogSort = "recommended" | "rating" | "name";

export interface CatalogState {
  /** Строка поиска (`q` на сервере). */
  text: string;
  /** Коды кухонь (`european`, `kazakh`) — сервер ORит их. */
  cuisines: string[];
  /** Коды удобств (`terrace`, `wifi`) — сервер требует ВСЕ сразу. */
  features: string[];
  price?: PriceLevel;
  /** YYYY-MM-DD. Работает только В ПАРЕ с `guests` — см. buildSearchQuery. */
  date?: string;
  guests?: number;
  /** «HH:MM», начало окна. Без даты и гостей сервер его игнорирует. */
  time?: string;
  openNow: boolean;
  onlineOnly: boolean;
  sort: CatalogSort;
  /** Номер страницы, с единицы. */
  page: number;
}

export const PRICE_LEVELS: readonly PriceLevel[] = ["₸", "₸₸", "₸₸₸", "₸₸₸₸"];

/** Сколько карточек на странице выдачи. В макете (узел 3258:2) блок «Cards»
 * ровно на пять карточек, а нумерация внизу даёт 26 страниц на 128 мест —
 * то есть те же пять. */
export const PAGE_SIZE = 5;

const EMPTY_STATE: CatalogState = {
  text: "",
  cuisines: [],
  features: [],
  openNow: false,
  onlineOnly: false,
  sort: "recommended",
  page: 1,
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrice(value: string | null): PriceLevel | undefined {
  return PRICE_LEVELS.find((level) => level === value);
}

function parseSort(value: string | null): CatalogSort {
  return value === "rating" || value === "name" ? value : "recommended";
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Адресная строка → состояние. Мусор в параметре читается как «не задано»:
 * подделанная ссылка не должна ронять страницу. */
export function parseCatalogParams(params: URLSearchParams): CatalogState {
  return {
    ...EMPTY_STATE,
    text: params.get("q")?.trim() ?? "",
    cuisines: parseList(params.get("cuisine")),
    features: parseList(params.get("features")),
    price: parsePrice(params.get("price")),
    date: /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? (params.get("date") as string) : undefined,
    guests: parsePositiveInt(params.get("guests")),
    time: /^\d{2}:\d{2}$/.test(params.get("time") ?? "") ? (params.get("time") as string) : undefined,
    openNow: params.get("open") === "1",
    onlineOnly: params.get("online") === "1",
    sort: parseSort(params.get("sort")),
    page: parsePositiveInt(params.get("page")) ?? 1,
  };
}

/** Состояние → адресная строка. Значения по умолчанию НЕ пишутся: адрес
 * остаётся коротким и читаемым, а `?page=1&sort=recommended` ничего не
 * добавляет. */
export function serializeCatalogParams(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.text.trim()) params.set("q", state.text.trim());
  if (state.cuisines.length > 0) params.set("cuisine", state.cuisines.join(","));
  if (state.features.length > 0) params.set("features", state.features.join(","));
  if (state.price) params.set("price", state.price);
  if (state.date) params.set("date", state.date);
  if (state.guests) params.set("guests", String(state.guests));
  if (state.time) params.set("time", state.time);
  if (state.openNow) params.set("open", "1");
  if (state.onlineOnly) params.set("online", "1");
  if (state.sort !== "recommended") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

/**
 * Состояние + город → запрос к `@bookeat/api`.
 *
 * Доступность («есть стол на N гостей в этот день») уходит ТОЛЬКО парой
 * дата+гости: сервер игнорирует одно без другого, и отправить половину значило
 * бы показать «фильтр применён», когда он не применён.
 */
export function buildSearchQuery(state: CatalogState, city: string | undefined): SearchQuery {
  const availability =
    state.date && state.guests
      ? { date: state.date, guests: state.guests, timeFrom: state.time }
      : undefined;

  return {
    text: state.text.trim(),
    filters: {
      ...EMPTY_FILTERS,
      cuisineIds: state.cuisines,
      amenityIds: state.features,
      city,
      priceLevel: state.price,
      openNowOnly: state.openNow,
      onlineBookableOnly: state.onlineOnly,
      availability,
    },
  };
}

/** Есть ли хоть один активный фильтр (для кнопки «Сбросить»). */
export function hasActiveFilters(state: CatalogState): boolean {
  return (
    state.text.trim().length > 0 ||
    state.cuisines.length > 0 ||
    state.features.length > 0 ||
    state.price !== undefined ||
    state.date !== undefined ||
    state.time !== undefined ||
    state.openNow ||
    state.onlineOnly
  );
}

/** Снять фильтр — вернуть новое состояние. Страница всегда сбрасывается на
 * первую: после сужения выдачи страницы 7 может уже не быть. */
export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const EMPTY_CATALOG_STATE = EMPTY_STATE;

/**
 * Сортировка и постраничная нарезка — НА КЛИЕНТЕ, и это осознанно.
 *
 * `searchRestaurants` спрашивает у сервера одну страницу на 100 записей, а в
 * живом каталоге заведений два десятка: вся выдача уже здесь, и резать её на
 * страницы по пять (как в макете) можно без единого лишнего запроса. Ни
 * `sort`, ни `page` серверная ручка `/restaurants/search` сегодня не понимает
 * — отправлять их значило бы делать вид, что сортируем.
 *
 * Как только каталог перерастёт сотню, это место придётся переделать на
 * серверную пагинацию: тогда «страница 21» окажется за пределами того, что
 * сервер прислал, и выдача молча кончится.
 */
export function sortVenues<T extends { rating: number; name: string }>(
  items: readonly T[],
  sort: CatalogSort,
  locale: string,
): T[] {
  const copy = [...items];
  if (sort === "rating") return copy.sort((a, b) => b.rating - a.rating);
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, locale));
  return copy;
}

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function paginate<T>(items: readonly T[], page: number, size: number = PAGE_SIZE): T[] {
  const last = pageCount(items.length, size);
  // Страница за пределами выдачи — это не пустой экран, а первая страница:
  // так ссылка `?page=9`, пережившая сужение фильтров, остаётся рабочей.
  const safe = Math.min(Math.max(page, 1), last);
  return items.slice((safe - 1) * size, safe * size);
}
