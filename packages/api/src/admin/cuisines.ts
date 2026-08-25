/**
 * Справочник кухонь: чистая логика выбора и порядка, без DOM и без запросов.
 *
 * Почему отдельным модулем: те же правила нужны трём владельцам — форме
 * заведения у суперадмина, карточке «Кухни» в настройках заведения и экрану
 * самого справочника. Держать их в компоненте значит переписать при появлении
 * четвёртого, а проверять — только через рендер.
 *
 * Контракт сервера (прочитан в internal/usecase/cuisines/facade.go и
 * internal/transport/rest/cuisines):
 *   • набор кухонь заведения пишется ЦЕЛИКОМ (PUT /restaurants/:id/cuisines,
 *     `{cuisine_ids: [...]}`), а не по одной;
 *   • ПОРЯДОК значим — нулевая позиция это главная кухня заведения, из неё
 *     собирается строка `cuisine_type` для старых клиентов;
 *   • повторы сервер схлопывает (dedupe), но до пяти считает уже ПОСЛЕ этого —
 *     клиент считает так же, иначе шестая кухня выглядела бы разрешённой;
 *   • скрытую кухню назначить нельзя (ErrValidation) — поэтому в выборе видны
 *     только активные.
 */

import { saveVenueWithDictionaries, type VenueSaveOutcome } from "./venue-save";

/** Потолок набора кухонь у заведения — MaxCuisinesPerVenue на сервере. */
export const MAX_VENUE_CUISINES = 5;

/** Кухня внутри ответа о заведении: справочные поля, без служебных. */
export interface VenueCuisine {
  id: string;
  code: string;
  name: string;
  name_i18n?: Record<string, string>;
  image_url?: string | null;
}

/** Запись справочника целиком — как её видит платформа (GET /admin/cuisines). */
export interface CuisineDictionaryEntry extends VenueCuisine {
  display_order: number;
  is_active: boolean;
}

/** Тело POST/PATCH /admin/cuisines. Все поля необязательны: PATCH меняет только
 * присланные ключи (на сервере они указатели). */
export interface CuisineSaveInput {
  code?: string;
  name?: string;
  name_i18n?: Record<string, string>;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

/** Причина, по которой кухню не добавили. Текст выбирает компонент. */
export type CuisineSelectError = "limit_reached" | "already_selected";

export type CuisineSelectResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: CuisineSelectError };

/** id-шники набора в том порядке, в котором они пришли. */
export function cuisineIdsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

/**
 * Добавляет кухню В КОНЕЦ набора: первая позиция уже занята главной кухней, и
 * молча подвинуть её выбором шестой кухни — не то, о чём просил человек.
 */
export function selectCuisine(selected: readonly string[], id: string): CuisineSelectResult {
  if (selected.includes(id)) return { ok: false, error: "already_selected" };
  if (selected.length >= MAX_VENUE_CUISINES) return { ok: false, error: "limit_reached" };
  return { ok: true, ids: [...selected, id] };
}

/** Убирает кухню из набора. Порядок остальных не меняется. */
export function deselectCuisine(selected: readonly string[], id: string): string[] {
  return selected.filter((item) => item !== id);
}

/** Делает кухню главной — переносит её в начало, остальные сдвигаются, но
 * своего относительного порядка не теряют. */
export function makeMainCuisine(selected: readonly string[], id: string): string[] {
  if (!selected.includes(id)) return [...selected];
  return [id, ...selected.filter((item) => item !== id)];
}

/** Один и тот же набор в одном и том же порядке. Порядок здесь — часть данных,
 * поэтому сравнение позиционное, а не множествами. */
export function sameCuisineSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Порядок справочника: сперва display_order, при равенстве — по названию.
 * Равные значения встречаются (у всех записей 0 до первой сортировки), и без
 * второго ключа список бы прыгал между рендерами. */
export function sortCuisines<T extends { display_order: number; name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ru"),
  );
}

/** Только то, что заведению разрешено выбирать: скрытую кухню сервер отвергнет. */
export function activeCuisines<T extends { is_active: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.is_active);
}

/** Правка display_order одной записи, которую нужно отправить на сервер. */
export interface CuisineOrderPatch {
  id: string;
  display_order: number;
}

/**
 * Перестановка записи справочника на одну позицию.
 *
 * Возвращает ТОЛЬКО те правки, которые действительно меняют значение: у свежего
 * справочника display_order у всех нулевой, и первая же перестановка обязана
 * пронумеровать список целиком (иначе порядок «сохранился», а список не
 * сдвинулся). Дальше правок будет две — ровно переставленная пара.
 */
export function reorderCuisines<T extends { id: string; display_order: number; name: string }>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
): CuisineOrderPatch[] {
  const ordered = sortCuisines(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from < 0) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ordered.length) return [];

  const moved = [...ordered];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);

  const patches: CuisineOrderPatch[] = [];
  moved.forEach((entry, index) => {
    const next = index + 1;
    if (entry.display_order !== next) patches.push({ id: entry.id, display_order: next });
  });
  return patches;
}

/**
 * Чем кончилось сохранение заведения, у которого кухни пишутся ОТДЕЛЬНОЙ
 * ручкой.
 *
 * Тип переехал в `venue-save.ts`, когда таких наборов стало два (к кухням
 * добавились удобства): разбор «какая половина легла» у них общий, и держать
 * две копии одной развилки — это гарантированно разъехавшиеся сообщения.
 * Реэкспорт оставлен, чтобы не переписывать импорты.
 */
export type { VenueSaveOutcome } from "./venue-save";

/**
 * Сохраняет заведение, затем — его кухни.
 *
 * Частный случай `saveVenueWithDictionaries` (см. там же, почему порядок
 * именно такой): у нового заведения id появляется только из ответа на
 * создание, а legacy-строку `cuisine_type` сервер пересобирает именно записью
 * набора кухонь, поэтому набор обязан лечь последним.
 *
 * `cuisineIds === null` значит «набор не трогаем» (не прочитан или не менялся):
 * PUT замещает набор целиком, и отправить его вслепую — стереть заведению
 * кухни, которых форма не показывала.
 */
export function saveVenueWithCuisines<V extends { id: string }>(steps: {
  saveVenue: () => Promise<V>;
  cuisineIds: readonly string[] | null;
  saveCuisines: (venueId: string, ids: readonly string[]) => Promise<unknown>;
}): Promise<VenueSaveOutcome<V>> {
  return saveVenueWithDictionaries(steps);
}
