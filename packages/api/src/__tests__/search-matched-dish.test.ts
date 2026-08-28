import { describe, expect, it } from "vitest";
import { mapRestaurantSummary, type ApiRestaurant } from "../http-mapping";

/**
 * `matched_dish` — блюдо, из-за которого заведение попало в выдачу поиска.
 *
 * Поле приходит ТОЛЬКО от `GET /restaurants/search` и только при совпадении по
 * меню. Проверено живым запросом к тестовому бэкенду 28.08.2026: «паста» →
 * 8 заведений, у каждого своё блюдо (Social Coffee — «Паста с митболами из
 * ягненка»), а поиск по названию заведения поля не присылает вовсе.
 *
 * Ломается тихо в обе стороны: пропавшее поле — гость снова не понимает,
 * почему в выдаче заведение без его слова в названии; блюдо с пустым именем —
 * подпись «В меню: » ни о чём.
 */

const API: ApiRestaurant = {
  id: "r-1",
  category_id: null,
  name: "Social Coffee",
  description: "",
  cuisine_type: "Европейская",
  address: "Сатпаева, 10",
  opening_hours: "",
  city: "Алматы",
  price_category: "₸₸",
  email: "",
  phone: "",
  latitude: null,
  longitude: null,
  is_active: true,
  is_new: null,
  is_popular: null,
  is_premium: null,
  display_order: null,
};

describe("блюдо, по которому нашлось заведение", () => {
  it("переносит id и название блюда из ответа поиска", () => {
    const summary = mapRestaurantSummary({
      ...API,
      matched_dish: { id: "d-1", name: "Паста с митболами из ягненка" },
    });

    expect(summary.matchedDish).toEqual({
      id: "d-1",
      name: "Паста с митболами из ягненка",
    });
  });

  it("оставляет поле пустым, когда сервер его не прислал", () => {
    // Ровно так выглядит ответ на поиск по названию заведения.
    expect(mapRestaurantSummary(API).matchedDish).toBeUndefined();
  });

  it("оставляет поле пустым на null и на блюдо без названия", () => {
    expect(mapRestaurantSummary({ ...API, matched_dish: null }).matchedDish).toBeUndefined();
    expect(
      mapRestaurantSummary({ ...API, matched_dish: { id: "d-1", name: "  " } }).matchedDish,
    ).toBeUndefined();
  });
});
