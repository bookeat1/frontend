import type { RestaurantSummary, MatchReason } from "@bookeat/api";
import type { Dictionary } from "@bookeat/i18n";

/**
 * Чип причин на карточке «Для вас» — персонализация v1
 * (`specs/foodie-personalization-v1-20260916.md`, 5.6/5.7, критерий 21).
 *
 * ПРАВИЛО ОТБОРА: максимум ДВЕ причины, только с `points > 0`. Сервер
 * ОБЯЗАН присылать причины и с нулём («у гостя нет бюджета», критерий 2 —
 * это для объяснения владельцу заведения через `match.reasons`), и
 * `fallback_popular` у добранных карточек (5.5, п.4) — обе категории клиент
 * обязан отфильтровать сам, иначе чип покажет «Популярно» на заведении,
 * которое просто добрали в хвост.
 */
const MAX_MATCH_CHIP_REASONS = 2;

export function visibleMatchReasons(
  reasons: readonly MatchReason[] | undefined,
): MatchReason[] {
  if (!reasons) return [];
  return reasons.filter((reason) => reason.points > 0).slice(0, MAX_MATCH_CHIP_REASONS);
}

/**
 * Название кухни из `params.cuisineCodes` — ищется в СОБСТВЕННОМ наборе
 * кухонь карточки (`restaurant.cuisines`), а не в отдельном справочнике:
 * коды в `params` это ВСЕГДА пересечение с кухнями этого же заведения (5.3),
 * так что название уже лежит на карточке, и отдельного запроса к
 * `GET /cuisines` не нужно.
 */
function cuisineNamesFromParams(
  reason: MatchReason,
  restaurant: RestaurantSummary,
): string[] {
  const codes = reason.params?.cuisineCodes;
  if (!Array.isArray(codes)) return [];
  const names: string[] = [];
  for (const code of codes) {
    if (typeof code !== "string") continue;
    const name = restaurant.cuisines.find((c) => c.id === code)?.name.trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Одна причина → короткая подпись чипа. Два кода (5.6, критерий 21) имеют
 * КОНКРЕТНОЕ требование к тексту — кухня по имени, бюджет знаком яруса; для
 * остальных кодов 5.3 (`diet_match`, `booked_similar`, `editorial_pick`,
 * `venue_rating`, `popular`) сервер не присылает параметров, поэтому подпись
 * общая по коду. Незнакомый будущий код — общий текст «Похоже на ваш вкус»,
 * а не пустая строка: причина уже прошла фильтр `points > 0`, молчать о ней
 * значило бы показать пустой чип.
 */
export function matchReasonLabel(
  reason: MatchReason,
  restaurant: RestaurantSummary,
  t: Dictionary,
): string {
  switch (reason.code) {
    case "cuisine_match":
    case "cuisine_match_implicit": {
      const names = cuisineNamesFromParams(reason, restaurant);
      return names[0] ?? t.explore.matchReasonCuisineFallback;
    }
    case "budget_match":
      // `restaurant.priceLevel` — САМ знак яруса («₸»/«₸₸»/«₸₸₸»), не код,
      // который надо переводить (см. PriceLevel в packages/api).
      return restaurant.priceLevel;
    case "diet_match":
      return t.explore.matchReasonDiet;
    case "booked_similar":
      return t.explore.matchReasonBookedSimilar;
    case "editorial_pick":
      return t.explore.matchReasonEditorial;
    case "venue_rating":
      return t.explore.matchReasonRating;
    case "popular":
      return t.explore.matchReasonPopular;
    default:
      return t.explore.matchReasonGeneric;
  }
}

/** Готовая строка чипа — «Итальянская · ₸₸» (3.1 спеки), пусто, если
 * показывать нечего (нет `match`, все причины нулевые/фолбэк). */
export function matchChipText(
  reasons: readonly MatchReason[] | undefined,
  restaurant: RestaurantSummary,
  t: Dictionary,
): string {
  return visibleMatchReasons(reasons)
    .map((reason) => matchReasonLabel(reason, restaurant, t))
    .join(" · ");
}
