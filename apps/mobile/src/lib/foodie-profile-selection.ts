/**
 * Чистая логика выбора для визарда «Фуди-профиль» (см.
 * `foodie-profile-draft.tsx` — контекст, который держит эти четыре набора
 * между экранами). Вынесена отдельно от контекста и экранов, чтобы решения
 * по неоднозначным местам задачи проверялись юнит-тестами, а не только
 * глазами на симуляторе.
 *
 * ТРИ РЕШЕНИЯ ВЛАДЕЛЬЦА ЗАДАЧИ, ПРИНЯТЫЕ ЭТИМ АГЕНТОМ (задача оставляла их на
 * усмотрение реализации, 2026-09-15):
 *
 *   1. Лимит 5 кухонь — ТАП ПО ШЕСТОЙ БЛОКИРУЕТСЯ, а не вытесняет самую
 *      старую. Молчаливая замена «сняли то, что выбрали первым» выглядела бы
 *      багом: гость нажал на новую плитку, а с экрана исчезла совсем другая.
 *      Блокировка честнее ПРИ УСЛОВИИ, что она видна — экран должен
 *      визуально притушить невыбранные плитки при достигнутом лимите
 *      (см. CuisineScreen), иначе немой запрет тоже читался бы как баг.
 *   2. «Без диеты» ЭКСКЛЮЗИВЕН относительно остальных пунктов: выбор «Без
 *      диеты» снимает всё прочее и наоборот — обычная логика для такого
 *      пункта в визардах (аналог «Не выбрано» в чекбоксах). Остальные девять
 *      пунктов — обычный мультивыбор между собой.
 *   3. Бюджет по умолчанию НЕ ВЫБРАН (`null`). В макете карточка «Средний»
 *      нарисована выбранной, но это демонстрация состояния «есть выбор», не
 *      обязательно дефолт продукта — шаг явно необязательный
 *      («Средний чек на одного (необязательно)»), и подставлять ответ,
 *      которого гость не давал, для необязательного поля нечестно.
 */

export const CUISINE_SELECTION_LIMIT = 5;

/** «Без диеты» — единственный эксклюзивный пункт экрана диет. */
export const DIET_EXCLUSIVE_ID = "no_diet";

export interface CuisineToggleResult {
  next: readonly string[];
  /** `true`, когда тап был по невыбранной плитке при уже набранном лимите —
   * экран должен показать `limitHint` вместо молчаливого игнора. */
  blockedByLimit: boolean;
}

/**
 * Кухни: мультивыбор с жёстким лимитом `CUISINE_SELECTION_LIMIT`. Тап по уже
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

export type BudgetTier = "budget" | "mid" | "premium";

/**
 * Бюджет: одиночный выбор, повторный тап по уже выбранной карточке снимает
 * выбор целиком — шаг необязательный, у гостя должен быть путь вернуться к
 * «ничего не выбрано» без похода назад по визарду.
 */
export function toggleBudgetSelection(
  selected: BudgetTier | null,
  id: BudgetTier,
): BudgetTier | null {
  return selected === id ? null : id;
}
