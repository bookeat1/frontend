import type { MenuDish, MenuSection } from "@bookeat/api/client";

/**
 * Поиск по меню заведения на странице «Меню {заведение}» (узел 5115:7448) —
 * зеркало `apps/mobile/src/lib/menu-search.ts`. Отдельная копия, а не общий
 * пакет: логика — двадцать строк без внешних зависимостей, а `apps/mobile` не
 * подключается из `apps/web` (каждое приложение — свой визуальный язык, общий
 * код живёт в `packages/*`, см. корневой `CLAUDE.md`).
 *
 * Правила ТЕ ЖЕ, что в приложении:
 *   1. Пустой запрос — не фильтр, меню целиком.
 *   2. Слова запроса соединяются И, а не ИЛИ.
 *   3. Раздел без совпадений исчезает целиком (пустой заголовок читается как
 *      потеря данных).
 *   4. Порядок разделов и блюд внутри — серверный, не трогаем.
 *   5. Ё и Е — одна буква, регистр складывается `ru-RU`.
 *
 * Ищем по `name` и `description` (состав живёт в описании — отдельного поля
 * «ингредиенты» у `MenuDish` нет), название раздела в поиск не входит.
 */
export function filterMenuSections(sections: readonly MenuSection[], query: string): MenuSection[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...sections];

  return sections
    .map((section) => ({
      ...section,
      dishes: section.dishes.filter((dish) => matchesDish(dish, terms)),
    }))
    .filter((section) => section.dishes.length > 0);
}

function matchesDish(dish: MenuDish, terms: readonly string[]): boolean {
  const haystack = fold(`${dish.name} ${dish.description}`);
  return terms.every((term) => haystack.includes(term));
}

function fold(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}
