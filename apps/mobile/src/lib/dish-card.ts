import type { MenuDish, MenuHighlight } from "@bookeat/api";
import { formatMoneyMinor } from "./format";

/**
 * Одно блюдо в том виде, в каком его показывает карточка блюда
 * (`DishDetailSheet`).
 *
 * Заведено потому, что одно и то же блюдо приезжает к нам ДВУМЯ разными
 * формами: из меню (`MenuDish`) и из ленты «Лучшие позиции» (`MenuHighlight` —
 * цена ещё и готовой строкой, флага наличия нет вовсе). Шторка не должна знать
 * про обе; она знает про эту.
 *
 * `priceLabel` — то, что печатается; `priceMinor` — только для арифметики
 * (итог «цена × количество» в кнопке «Добавить»). Разделены намеренно: печатать
 * надо ровно ту строку, что пришла, а считать — только по числу.
 *
 * С 2026-08-27 число есть у ОБЕИХ форм: сервер отдаёт `price_minor` рядом с
 * `price` (миграция 0087 / PR #106). До этого у блюда из ленты его не было, и
 * кнопка «Добавить» там была выключена — считать было не из чего. Правило само
 * не изменилось: нет числа — нет действия, ничего не восстанавливаем разбором
 * строки «8 990 ₸» обратно в деньги.
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
 * Блюдо из ленты «Лучшие позиции» (`GET /restaurants/:id/menu-highlights`).
 *
 * `isAvailable: true` — не допущение: сервер собирает ленту только из блюд с
 * `is_available` (`usecase/menu.resolveHighlights`), недоступные туда не
 * попадают вовсе. Пустая строка цены с бэка (`formatMenuPrice` возвращает ""
 * для незаполненной цены) превращается в null, то есть в честное «цену
 * уточняйте», а не в пустое место под названием.
 *
 * `priceMinor` — то самое `price_minor` с сервера, БЕЗ восстановления из
 * строки: `null` остаётся `null`, и карточка просто не покажет «Добавить».
 */
export function dishCardFromHighlight(item: MenuHighlight): DishCardItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    priceLabel: item.price.trim() === "" ? null : item.price,
    priceMinor: item.priceMinor,
    imageUrl: item.photo?.uri ?? null,
    isAvailable: true,
  };
}
