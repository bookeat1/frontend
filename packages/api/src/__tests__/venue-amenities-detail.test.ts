import { describe, expect, it } from "vitest";

import { mapVenueAmenities } from "../http-mapping";

/**
 * Удобства заведения приходят полем `features` ДЕТАЛЬНОГО ответа
 * (`GET /restaurants/:id`) — проверено curl'ом на тестовом бэкенде
 * 31.08.2026. До этой правки поле не мапилось вовсе, и веб считал, что таких
 * данных у модели нет; страница заведения из-за этого не рисовала ряд ярлыков
 * узла 3261:57.
 *
 * Главное, что здесь держится: «ключа нет» и «список пуст» — РАЗНЫЕ ответы.
 * Первый значит «сервер не сказал» (старая сборка), второй — «удобств нет».
 * Экран показывает ряд только во втором случае и обязан их различать.
 */
describe("features детального ответа → amenities", () => {
  it("ключа нет — undefined, а не пустой список", () => {
    expect(mapVenueAmenities(undefined)).toBeUndefined();
    expect(mapVenueAmenities(null)).toBeUndefined();
  });

  it("пустой список остаётся пустым списком", () => {
    expect(mapVenueAmenities([])).toEqual([]);
  });

  it("идентификатором становится КОД записи — это значение фильтра ?features=", () => {
    const amenities = mapVenueAmenities([
      { id: "688fc12d-b985-5eff-9197-f6afc2750750", code: "terrace", name: "Терраса" },
    ]);

    expect(amenities).toEqual([{ id: "terrace", name: "Терраса" }]);
  });

  it("кода нет — остаётся UUID, подпись всё равно показываем", () => {
    const amenities = mapVenueAmenities([{ id: "uuid-1", name: "Wi-Fi" }]);

    expect(amenities).toEqual([{ id: "uuid-1", name: "Wi-Fi" }]);
  });

  it("запись без имени выбрасывается — пустой ярлык это дырка в ряду", () => {
    const amenities = mapVenueAmenities([
      { id: "a", code: "wifi", name: "   " },
      { id: "b", code: "terrace", name: "Терраса" },
    ]);

    expect(amenities).toEqual([{ id: "terrace", name: "Терраса" }]);
  });
});
