import type { GuideCollection } from "@bookeat/api/client";

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
 * Золотая надпись плитки рубрики — первый слаг рубрики заглавными, как в
 * `rubricLabel` приложения: имён рубрик в ответе подборок нет, а ходить за
 * `GET /gastroguide/categories` ради подписи — лишний запрос на страницу.
 */
export function rubricLabel(categorySlugs: readonly string[]): string {
  const slug = categorySlugs[0]?.trim();
  if (!slug) return "";
  return slug.replace(/[-_]+/g, " ").toUpperCase();
}
