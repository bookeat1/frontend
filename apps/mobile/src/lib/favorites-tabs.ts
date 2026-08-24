import type { FavoriteCounts, FavoriteItem, FavoriteKind } from "@bookeat/api";

/**
 * Вкладки экрана «Избранное» (макет 602:3630): «Все» плюс по одной на каждый
 * вид сохранённого.
 *
 * Фильтрация — чистая функция над УЖЕ загруженным ответом, а не новый запрос:
 * сервер считает `counts` по всем видам сразу, даже когда `type=` сузил items,
 * поэтому одного ответа хватает и на чипы, и на любую вкладку.
 */
export type FavoriteTab = "all" | FavoriteKind;

export const FAVORITE_TABS: readonly FavoriteTab[] = ["all", "restaurant", "event", "promo"];

/** Элементы одной вкладки. «Все» — это весь список в порядке сервера. */
export function filterFavoriteItems(items: FavoriteItem[], tab: FavoriteTab): FavoriteItem[] {
  if (tab === "all") return items;
  return items.filter((item) => item.kind === tab);
}

/** Счётчик на чипе. Берётся из ответа сервера, а не из длины отфильтрованного
 * массива: это одно и то же ровно потому, что запрос идёт без `type=`, и
 * расхождение означало бы, что список чего-то не показывает. */
export function favoriteTabCount(counts: FavoriteCounts | undefined, tab: FavoriteTab): number {
  if (!counts) return 0;
  switch (tab) {
    case "all":
      return counts.all;
    case "restaurant":
      return counts.restaurants;
    case "event":
      return counts.events;
    case "promo":
      return counts.promos;
  }
}

/** Стабильный ключ строки списка. Виды нумеруются отдельно, поэтому в ключ
 * входит и вид: id события и id акции могут совпасть. */
export function favoriteItemKey(item: FavoriteItem): string {
  switch (item.kind) {
    case "restaurant":
      return `restaurant:${item.restaurant.id}`;
    case "event":
      return `event:${item.event.id}`;
    case "promo":
      return `promo:${item.promo.id}`;
  }
}
