import type { MenuDish, MenuHighlight } from "@bookeat/api";
import { formatMoneyMinor } from "./format";

/**
 * Одно блюдо в том виде, в каком его показывает карточка блюда
 * (`DishDetailSheet`).
 *
 * Заведено потому, что одно и то же блюдо приезжает к нам ДВУМЯ разными
 * формами: из меню (`MenuDish` — цена числом в тиынах, есть флаг наличия) и из
 * ленты «Популярное в меню» на экране заведения и в брони (`MenuHighlight` —
 * цена уже строкой, флага наличия нет вовсе). Шторка не должна знать про обе;
 * она знает про эту.
 *
 * `priceLabel` — то, что печатается; `priceMinor` — только для арифметики
 * (итог «цена × количество» в кнопке «Добавить»). Разделены намеренно: у
 * блюда из ленты цену пересчитать не из чего, там приходит уже готовая строка
 * вроде «8 990 ₸», и разбирать её обратно в тиыны значило бы придумывать
 * деньги.
 */
export interface DishCardItem {
  id: string;
  name: string;
  description: string;
  /** Готовая строка цены. null — цена у блюда не заполнена. */
  priceLabel: string | null;
  /** Тиыны — только для подсчёта итога. null — считать не из чего. */
  priceMinor: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
}

/** Блюдо из меню заведения (`GET /restaurants/:id/menu`). */
export function dishCardFromMenuDish(dish: MenuDish): DishCardItem {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    priceLabel: dish.priceMinor === null ? null : formatMoneyMinor(dish.priceMinor),
    priceMinor: dish.priceMinor,
    imageUrl: dish.imageUrl,
    isAvailable: dish.isAvailable,
  };
}

/**
 * Блюдо из ленты «Популярное в меню».
 *
 * `isAvailable: true` — не допущение: маппер ленты (`mapMenuHighlights`)
 * оставляет в ней ТОЛЬКО блюда с `is_available`, недоступные туда не попадают.
 * Пустая строка цены с бэка (`formatMenuPrice` возвращает "" для незаполненной
 * цены) превращается в null, то есть в честное «цену уточняйте», а не в
 * пустое место под названием.
 */
export function dishCardFromHighlight(item: MenuHighlight): DishCardItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    priceLabel: item.price.trim() === "" ? null : item.price,
    priceMinor: null,
    imageUrl: item.photo?.uri ?? null,
    isAvailable: true,
  };
}
