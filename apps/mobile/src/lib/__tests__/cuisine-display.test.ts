import { describe, expect, it } from "vitest";
import { CARD_CUISINE_LIMIT, cuisineLine, splitCuisines } from "../cuisine-display";

/**
 * Сколько кухонь помещается на карточку заведения.
 *
 * До справочника кухня была одной строкой, и вопроса не стояло. Теперь у
 * заведения их до пяти, порядок значим (нулевая — главная), и правило «две и
 * +N» живёт отдельно от разметки: сломать его можно молча, а видно это будет
 * только глазами на телефоне.
 */

const cuisine = (id: string, name: string) => ({ id, name });

describe("кухни на карточке", () => {
  it("до предела показывает все и ничего не прячет", () => {
    const result = splitCuisines([cuisine("a", "Европейская"), cuisine("b", "Грузинская")]);

    expect(result.visible).toHaveLength(CARD_CUISINE_LIMIT);
    expect(result.hiddenCount).toBe(0);
    expect(result.hiddenNames).toBe("");
  });

  it("остальные сворачивает, НЕ трогая порядок: главная остаётся первой", () => {
    const result = splitCuisines([
      cuisine("main", "Грузинская"),
      cuisine("b", "Европейская"),
      cuisine("c", "Казахская"),
      cuisine("d", "Японская"),
    ]);

    expect(result.visible.map((c) => c.name)).toEqual(["Грузинская", "Европейская"]);
    expect(result.hiddenCount).toBe(2);
    // Спрятанные достаются скринридеру — иначе их не узнать нигде.
    expect(result.hiddenNames).toBe("Казахская, Японская");
  });

  it("заведение без кухонь — пусто и без «+0»", () => {
    // На бою такое есть: «Agora wine and deli» (2026-08-25).
    const result = splitCuisines([]);

    expect(result.visible).toEqual([]);
    expect(result.hiddenCount).toBe(0);
    expect(cuisineLine([])).toBe("");
  });

  it("кухня с пустым названием не превращается в пустой чип", () => {
    const result = splitCuisines([cuisine("a", "  "), cuisine("b", "Казахская")]);

    expect(result.visible.map((c) => c.name)).toEqual(["Казахская"]);
  });

  it("строка для скринридера перечисляет набор целиком и в порядке заведения", () => {
    expect(cuisineLine([cuisine("a", "Грузинская"), cuisine("b", "Европейская")])).toBe(
      "Грузинская, Европейская",
    );
  });
});
