/**
 * Чистая логика выбора раздела «Фуди-профиль» на сайте — осознанная копия
 * `apps/mobile/src/lib/foodie-profile-selection.ts` (сайт не импортирует из
 * приложения: у того бандла react-native, прецедент `guide-collections.ts`).
 * Лимит 5 кухонь и правила диет/бюджета живут в трёх местах (Go, мобилка,
 * веб, спека `foodie-profile-web-desktop-20260930.md` §6.8) — при смене
 * менять все три, начиная с оригинала выше.
 *
 * ТРИ РЕШЕНИЯ ВЛАДЕЛЬЦА ЗАДАЧИ (унаследованы от мобильного визарда,
 * 2026-09-15):
 *
 *   1. Лимит 5 кухонь — тап по шестой БЛОКИРУЕТСЯ, а не вытесняет самую
 *      старую выбранную.
 *   2. «Без диеты» ЭКСКЛЮЗИВЕН относительно остальных диет: выбор «Без
 *      диеты» снимает всё прочее и наоборот. Остальные пункты — обычный
 *      мультивыбор.
 *   3. Бюджет — одиночный выбор, повторный клик по выбранной карточке
 *      снимает её (`budget: null`). Шаг необязательный.
 */

export const CUISINE_SELECTION_LIMIT = 5;

/** «Без диеты» — единственный эксклюзивный пункт карточки диет. */
export const DIET_EXCLUSIVE_ID = "no_diet";

export interface CuisineToggleResult {
  next: readonly string[];
  /** `true`, когда клик был по невыбранной плитке при уже набранном лимите —
   * форма должна показать `limitHint` вместо молчаливого игнора. */
  blockedByLimit: boolean;
}

/**
 * Кухни: мультивыбор с жёстким лимитом `CUISINE_SELECTION_LIMIT`. Клик по уже
 * выбранной плитке всегда снимает её — лимит ограничивает только рост
 * набора, никогда не мешает его уменьшить.
 */
export function toggleCuisineSelection(
  selected: readonly string[],
  id: string,
): CuisineToggleResult {
  if (selected.includes(id)) {
    return { next: selected.filter((s) => s !== id), blockedByLimit: false };
  }
  if (selected.length >= CUISINE_SELECTION_LIMIT) {
    return { next: selected, blockedByLimit: true };
  }
  return { next: [...selected, id], blockedByLimit: false };
}

/**
 * Диеты: мультивыбор без лимита, кроме одного эксклюзивного пункта —
 * `DIET_EXCLUSIVE_ID` («Без диеты»). Выбор эксклюзивного пункта снимает всё
 * остальное; выбор любого другого снимает эксклюзивный.
 */
export function toggleDietSelection(selected: readonly string[], id: string): readonly string[] {
  if (id === DIET_EXCLUSIVE_ID) {
    return selected.includes(DIET_EXCLUSIVE_ID) ? [] : [DIET_EXCLUSIVE_ID];
  }
  const withoutExclusive = selected.filter((s) => s !== DIET_EXCLUSIVE_ID);
  return withoutExclusive.includes(id)
    ? withoutExclusive.filter((s) => s !== id)
    : [...withoutExclusive, id];
}

/** Аллергии: обычный мультивыбор без лимита и без эксклюзивных пунктов. */
export function toggleAllergySelection(selected: readonly string[], id: string): readonly string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/**
 * Ярус бюджета — `code` из живого справочника (`FoodieProfileOptions.budgets`,
 * `GET /foodie-profile/options`), обычная строка, а не фиксированный union из
 * трёх значений: платформенный админ может завести новый ярус без релиза
 * клиента (спека `foodie-profile-admin-dictionaries-20260916`, §3.10).
 */
export type BudgetTier = string;

/**
 * Бюджет: одиночный выбор, повторный клик по уже выбранной карточке снимает
 * выбор целиком — шаг необязательный.
 */
export function toggleBudgetSelection(
  selected: BudgetTier | null,
  id: BudgetTier,
): BudgetTier | null {
  return selected === id ? null : id;
}
