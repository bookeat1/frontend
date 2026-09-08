import type { GuideCategory, GuideCollection, GuideCollectionVenue } from "@bookeat/api/client";

/**
 * Делит ответ `GET /gastroguide/collections` на две секции страницы гастрогида
 * — копия `splitGuideCollections` из
 * `apps/mobile/src/components/articles/guide-collections.ts` (сайт не
 * импортирует из приложения: у того бандла react-native). Правило то же:
 * подборка с рубрикой — плитка «Рубрик», без рубрики — карточка «Выбора
 * редакции»; одна подборка показывается ровно один раз.
 */
export interface GuideSections {
  rubrics: GuideCollection[];
  editorPicks: GuideCollection[];
}

export function splitGuideCollections(collections: readonly GuideCollection[]): GuideSections {
  const rubrics: GuideCollection[] = [];
  const editorPicks: GuideCollection[] = [];
  for (const collection of collections) {
    if (collection.categorySlugs.length > 0) rubrics.push(collection);
    else editorPicks.push(collection);
  }
  return { rubrics, editorPicks };
}

/**
 * Слаг → человеческое название рубрики, из `GET /gastroguide/categories`
 * (`useGuideCategories`). Один справочник на всю страницу, а не запрос на
 * плитку.
 */
export function categoryTitleBySlug(categories: readonly GuideCategory[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const category of categories) {
    if (category.slug) map.set(category.slug, category.title);
  }
  return map;
}

/**
 * Золотая надпись плитки рубрики (узел 5039:10260 — «ЕДА» / «ЛЮДИ» / «МЕСТА»).
 *
 * БЫЛО: слаг подборки заглавными («KAZAKH CUISINE RUBRIC») — в данных нет
 * группировки «еда/люди/места», а печатать технический слаг вместо неё хуже,
 * чем показать настоящее название рубрики. Берём `title` из справочника
 * категорий по первому слагу подборки. Если справочник ещё не приехал или
 * рубрика не нашлась — надписи нет (выдумывать нечем).
 *
 * Когда название рубрики СОВПАДАЕТ с названием подборки без учёта регистра
 * (на стенде это все четыре подборки), надпись дублировала бы заголовок —
 * не рисуем её, название держит нижнюю строку одно.
 */
export function rubricEyebrow(
  collection: GuideCollection,
  categoryTitles: ReadonlyMap<string, string>,
): string {
  const slug = collection.categorySlugs[0]?.trim();
  if (!slug) return "";
  const title = categoryTitles.get(slug)?.trim();
  if (!title) return "";
  if (title.toLocaleLowerCase("ru-RU") === collection.title.trim().toLocaleLowerCase("ru-RU")) return "";
  return title.toUpperCase();
}

/**
 * Заведения всех подборок одной рубрики подряд, БЕЗ повторов — копия
 * `dedupeVenues` из `apps/mobile/app/gastroguide/rubric/[slug].tsx`. Схлопываем
 * по `restaurantId`, а не по названию: два разных заведения с одинаковым
 * именем в разных ТЦ — это два заведения, а одно и то же место в двух
 * подборках рубрики — одна карточка. Побеждает ПЕРВОЕ вхождение — у него
 * редакционный порядок старшей подборки.
 */
export function dedupeGuideVenues(
  details: readonly ({ venues: GuideCollectionVenue[] } | undefined)[],
): GuideCollectionVenue[] {
  const seen = new Set<string>();
  const venues: GuideCollectionVenue[] = [];
  for (const detail of details) {
    for (const venue of detail?.venues ?? []) {
      if (seen.has(venue.restaurantId)) continue;
      seen.add(venue.restaurantId);
      venues.push(venue);
    }
  }
  return venues;
}

/**
 * Подборки одной рубрики (`GuideCategory.slug`), в порядке ответа сервера —
 * зеркало фильтра в `apps/mobile/app/gastroguide/rubric/[slug].tsx`.
 */
export function collectionsForRubric(
  collections: readonly GuideCollection[],
  slug: string,
): GuideCollection[] {
  return collections.filter((collection) => collection.categorySlugs.includes(slug));
}
