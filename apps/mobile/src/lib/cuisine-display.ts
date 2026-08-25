import type { Cuisine } from "@bookeat/api";

/**
 * Сколько кухонь помещается на карточку заведения.
 *
 * У заведения их до пяти (потолок сервера, MaxCuisinesPerVenue), а в карточке
 * рядом с кухнями стоят ещё статус и средний чек. Три длинных русских названия
 * («Средиземноморская», «Паназиатская») на экране 360 занимают два ряда сами
 * по себе, и карточки в списке начинают заметно разъезжаться по высоте.
 * Поэтому показываем главную кухню и одну следующую, а остаток сворачиваем в
 * «+N».
 *
 * Порядок НЕ трогаем: он пришёл с сервера, и нулевая позиция — это главная
 * кухня заведения, а не первая попавшаяся.
 */
export const CARD_CUISINE_LIMIT = 2;

export interface CuisineDisplay {
  /** Кухни, которые рисуются чипами, в порядке заведения. */
  visible: Cuisine[];
  /** Сколько кухонь спрятано под «+N». 0 — метки «+N» нет. */
  hiddenCount: number;
  /** Названия спрятанных — через запятую, для скринридера. Пустая строка,
   * когда прятать нечего. */
  hiddenNames: string;
}

/**
 * Делит набор кухонь на видимую часть и остаток.
 *
 * Заведение без кухонь — законное состояние (на бою такое есть: «Agora wine and
 * deli»), и ответ на него — пустой `visible` и ноль спрятанных, то есть
 * карточка не рисует ни чипа, ни «+0».
 */
export function splitCuisines(
  cuisines: readonly Cuisine[],
  limit: number = CARD_CUISINE_LIMIT,
): CuisineDisplay {
  const named = cuisines.filter((cuisine) => cuisine.name.trim() !== "");
  const visible = named.slice(0, Math.max(0, limit));
  const hidden = named.slice(visible.length);
  return {
    visible,
    hiddenCount: hidden.length,
    hiddenNames: hidden.map((cuisine) => cuisine.name).join(", "),
  };
}

/** Все кухни одной строкой — для accessibilityLabel карточки и для узких
 * мест, где чипы не помещаются вовсе (например, карточка «Выбрали для вас»
 * шириной в 160). Пустая строка, если кухонь нет. */
export function cuisineLine(cuisines: readonly Cuisine[]): string {
  return cuisines
    .map((cuisine) => cuisine.name.trim())
    .filter(Boolean)
    .join(", ");
}
