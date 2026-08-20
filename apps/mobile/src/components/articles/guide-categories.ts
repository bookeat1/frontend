import type { GuideCategory, GuideCollection } from "@bookeat/api";

/**
 * Правила сетки рубрик гастрогида — отдельно от вёрстки, потому что именно они
 * решают, что гость увидит, и именно их надо держать тестом.
 *
 * Главное правило: мёртвых плиток нет. Рубрика показывается только если за ней
 * стоит хотя бы одна подборка; плитка, отбирающая пустоту, ничем не лучше
 * инертного сердечка, которое из этого приложения уже убирали.
 */

/** Колонок в сетке (макет 1099:6837 — две плитки в ряд с просветом 8). */
export const GUIDE_GRID_COLUMNS = 2;

/**
 * Рубрики, за которыми реально что-то стоит: слаг рубрики встречается в
 * `categorySlugs` хотя бы одной подборки. Порядок рубрик сохраняется — он
 * задан редакцией.
 */
export function categoriesWithCollections(
  categories: readonly GuideCategory[],
  collections: readonly GuideCollection[],
): GuideCategory[] {
  const tagged = new Set<string>();
  for (const collection of collections) {
    for (const slug of collection.categorySlugs) {
      tagged.add(slug);
    }
  }
  return categories.filter((category) => tagged.has(category.slug));
}

/**
 * Список подборок с учётом выбранной рубрики. `null` — рубрика не выбрана,
 * показываем всё. Порядок подборок не трогаем: он приходит с сервера.
 */
export function filterCollectionsByCategory(
  collections: readonly GuideCollection[],
  categorySlug: string | null,
): GuideCollection[] {
  if (!categorySlug) return [...collections];
  return collections.filter((collection) => collection.categorySlugs.includes(categorySlug));
}

/**
 * Разбивка на ряды по `columns` штук. Сетка собирается рядами, а не переносом
 * строк: у RN нет процентов с вычитанием просвета, а ряд из элементов `flex: 1`
 * даёт ровно ту же геометрию, что макет. Неполный последний ряд экран
 * дополняет пустышкой, иначе одинокая плитка растянулась бы во всю ширину.
 */
export function toGridRows<T>(items: readonly T[], columns: number = GUIDE_GRID_COLUMNS): T[][] {
  if (columns < 1) return items.length > 0 ? [[...items]] : [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
