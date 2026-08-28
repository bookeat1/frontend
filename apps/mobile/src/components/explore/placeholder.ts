/**
 * Формы карточек двух разделов главной («Акции» и «Статьи») и их СТАБИЛЬНЫЕ
 * ПУСТЫЕ значения.
 *
 * Файл заводился как заглушка: у обоих разделов не было ручки, и данные брались
 * отсюда. Сейчас обе ручки живые — `GET /feed?city=` у акций (см.
 * `useExplorePromotionsQuery`) и `GET /articles` у статей (см.
 * `useExploreArticles`, ручка появилась 2026-08-28, когда статьи и подборки
 * гастрогида развели на две сущности). Осталось ровно две вещи:
 *
 *   • ТИПЫ карточек — форма, которую рисуют компоненты разделов;
 *   • ПУСТЫЕ КОНСТАНТЫ — то, что хуки возвращают во время загрузки, при отказе
 *     и на пустом ответе. Массив отдаётся ПО ССЫЛКЕ, иначе главная
 *     перерисовывалась бы на каждый рендер; разделы прячутся именно на нём.
 */

/** One promo tile in the «Акции» strip. Shape the real feed is expected to
 * carry, so wiring it up later is a mapper change, not a component change. */
export interface PromoStripItem {
  id: string;
  /** Discount percentage shown in the red «−N%» badge, or `null` when the feed
   * carries no `discount_percent` for this promo — the card then draws no badge. */
  discountPercent: number | null;
  title: string;
  /** «Mongol Bar · 12:00–18:00» — venue name plus the promo's time window. */
  subtitle: string;
  imageUrl: string | null;
}

/** One editorial card in the «Статьи» strip. */
export interface ArticleCardData {
  id: string;
  title: string;
  /** Byline, e.g. «От BookEat» / «От ресторанного критика». */
  author: string;
  coverImageUrl: string | null;
}

/** Stable empty result for «Акции» while the feed is loading, on error, or
 * when there is nothing to show — the section hides on it. `useExplorePromotions`
 * is now wired to the live `GET /feed?city=…` promo feed; this is only its
 * empty/loading/error fallback, returned by reference so the section does not
 * re-render on every home render. */
export const PLACEHOLDER_PROMOTIONS: readonly PromoStripItem[] = [];

/** Стабильный пустой результат «Статей» на время загрузки, при отказе и когда
 * статей нет: раздел на главной прячется именно на нём. Возвращается ПО ССЫЛКЕ,
 * чтобы не перерисовывать главную на каждый рендер. Живая ручка —
 * `GET /articles` (см. `useExploreArticles`). */
export const PLACEHOLDER_ARTICLES: readonly ArticleCardData[] = [];
