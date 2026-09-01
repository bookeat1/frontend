import type { MenuDish } from "@bookeat/api";

/**
 * Поиск по меню заведения — отбор БЛЮД, а не разделов.
 *
 * Поле над списком подписано «Название блюда или ингредиента» (Figma
 * 49Zk9oEV3ZCiCdh6Cz9dE2, node 3563:7055), поэтому и ищем по двум полям
 * блюда: `name` и `description` (состав живёт именно в описании — отдельного
 * поля «ингредиенты» в API нет, см. `MenuDish`).
 *
 * Правила, на которых стоит отбор:
 *
 * 1. **Пустой запрос — это НЕ фильтр.** Строка из одних пробелов возвращает
 *    меню целиком, а не пустой список.
 * 2. **Слова соединяются И, а не ИЛИ.** «стейк рибай» находит блюдо, в
 *    котором есть оба слова; при ИЛИ запрос из двух слов давал бы БОЛЬШЕ
 *    результатов, чем из одного, и выдача читалась бы как сломанная.
 * 3. **Раздел без совпадений исчезает целиком.** Пустой заголовок
 *    («Мангал» без единой строки под ним) читается как потеря данных.
 * 4. Порядок разделов и порядок блюд внутри раздела не трогаем: он приходит с
 *    сервера и означает витрину заведения.
 *
 * Регистр складывается `toLowerCase()` — он корректен и для кириллицы, и для
 * казахских букв (ә, ө, ұ, і). Название раздела в поиск НЕ входит: иначе
 * запрос «мангал» вернул бы весь раздел, включая блюда, где этого слова нет,
 * и гость не понял бы, почему.
 */
export interface MenuSearchSection {
  title: string;
  data: MenuDish[];
}

export function filterMenuSections<S extends MenuSearchSection>(
  sections: readonly S[],
  query: string,
): S[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...sections];

  return sections
    .map((section) => ({
      ...section,
      data: section.data.filter((dish) => matchesDish(dish, terms)),
    }))
    .filter((section) => section.data.length > 0);
}

function matchesDish(dish: MenuDish, terms: readonly string[]): boolean {
  const haystack = `${dish.name} ${dish.description}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
