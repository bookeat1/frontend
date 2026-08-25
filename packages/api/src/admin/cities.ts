/**
 * Справочник городов: типы и чистая логика, без DOM и без запросов.
 *
 * Контракт сервера прочитан в `internal/transport/rest/cities/{dto,handler}.go`,
 * `internal/usecase/cities/facade.go` и миграции `0081_cities.sql`. Три факта
 * оттуда определяют всё, что здесь написано:
 *
 *   1. `GET /cities` БЕЗ параметров отдаёт голый массив названий
 *      (`{"data":["Астана","Алматы"]}`) — это замороженный контракт для сборки
 *      в магазине. Справочник целиком живёт на том же адресе под
 *      `?format=full`. Панель ходит только за полным видом.
 *   2. `value` в ответе — ЕДИНСТВЕННОЕ, что можно слать обратно как `?city=` и
 *      писать заведению в поле `city`. Это базовое русское название, а не
 *      переведённое `name`: каталог сравнивает строку точно (`r.city = $1`),
 *      и локализованное название не нашло бы ничего.
 *   3. Удаления города нет. `DELETE /admin/cities/:id` снимает флаг
 *      активности: на город ссылаются заведения (FK RESTRICT), а его название
 *      лежит строкой у живых строк каталога.
 */

/** Запись справочника — ровно поля `cityResponse` на сервере. */
export interface CityDictionaryEntry {
  id: string;
  code: string;
  /** Название на языке запроса. Показывать — да, отправлять обратно — нет. */
  name: string;
  name_i18n?: Record<string, string>;
  /**
   * Базовое русское название. ЭТО и есть значение фильтра `?city=` и строка,
   * которая пишется заведению в поле `city`. Сервер отдаёт его отдельным
   * полем именно чтобы клиенту не приходилось знать про разницу с `name`.
   */
  value: string;
  display_order: number;
  is_active: boolean;
}

/**
 * Тело POST/PATCH `/admin/cities`. Все поля необязательны: на сервере они
 * указатели, и PATCH меняет только присланные ключи.
 */
export interface CitySaveInput {
  code?: string;
  name?: string;
  name_i18n?: Record<string, string>;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Нормализация написания города — та же, что `city_key()` в SQL и
 * `domain.NormalizeCityKey` в Go: обрезать края, схлопнуть внутренние пробелы,
 * привести к нижнему регистру.
 *
 * Нужна клиенту ровно для одного: понять, покрыто ли написание, встреченное в
 * каталоге, записью справочника. Без неё «алматы» из старых данных добавилось
 * бы в фильтр вторым пунктом рядом с «Алматы» из справочника.
 */
export function normalizeCityKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Порядок справочника: сперва `display_order`, при равенстве — по названию.
 * Второй ключ обязателен: у свежих записей порядок нулевой у всех, и без него
 * список прыгал бы между рендерами.
 */
export function sortCities<T extends { display_order: number; name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ru"),
  );
}

/** Только активные записи — те, что можно предлагать к выбору. */
export function activeCities<T extends { is_active: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.is_active);
}

/**
 * Новый порядок справочника после перестановки записи на одну позицию —
 * ПОЛНОЙ последовательностью id, как её ждёт `PUT /admin/cities/order`.
 *
 * У городов, в отличие от кухонь, есть отдельная ручка порядка, и она принимает
 * весь список целиком. Это не каприз сервера: два администратора, двигающие
 * строки одновременно, при пошаговых правках получили бы порядок, которого не
 * просил ни один из них.
 *
 * Пустой массив = двигать некуда (запись не нашлась или уже с краю); вызывающий
 * по нему понимает, что запрос слать не нужно.
 */
export function reorderCityIds<T extends { id: string; display_order: number; name: string }>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
): string[] {
  const ordered = sortCities(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from < 0) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ordered.length) return [];

  const moved = [...ordered];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  return moved.map((entry) => entry.id);
}

/** Почему написание-синоним не приняли. Текст выбирает компонент. */
export type CityAliasError = "empty" | "same_as_name";

export type CityAliasResult =
  | { ok: true; alias: string }
  | { ok: false; error: CityAliasError };

/**
 * Проверка написания-синонима перед отправкой.
 *
 * Сервер нормализует его сам (`city_key`), поэтому клиент отправляет строку как
 * есть и отсекает только два случая, на которые не стоит тратить запрос:
 * пустое написание и написание, совпадающее с собственным названием города —
 * такой синоним справочник заводит сам при каждом сохранении.
 */
export function validateCityAlias(alias: string, city: { name: string; value: string }): CityAliasResult {
  const trimmed = alias.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "empty" };
  const key = normalizeCityKey(trimmed);
  if (key === normalizeCityKey(city.value) || key === normalizeCityKey(city.name)) {
    return { ok: false, error: "same_as_name" };
  }
  return { ok: true, alias: trimmed };
}
