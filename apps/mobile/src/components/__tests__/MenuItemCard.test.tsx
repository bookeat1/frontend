import type { MenuHighlight } from "@bookeat/api";
import { typography } from "@bookeat/design-tokens";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { atomicStyle } from "../../../test/atomic-style";
import { MenuItemCard } from "../MenuItemCard";

/**
 * Цена в карточке блюда весит МЕНЬШЕ названия.
 *
 * Жалоба владельца (2026-09-01): «в карточке ресторана цена на блюдо всё ещё
 * жирным шрифтом». На экране меню это поправили в PR #102 (`labelSemiBold` +
 * `text.strong` → `typography.body` + `text.primary`), а лента «Лучшие
 * позиции» на карточке заведения осталась прежней: цена набиралась ТЕМ ЖЕ
 * стилем, что и название блюда над ней.
 *
 * Граница, которую держит тест, — не «цена красивая», а «цена и название
 * набраны РАЗНЫМ начертанием, и цена — регулярным 14». Вернёшь `itemName` —
 * оба утверждения падают.
 */

/** Цена печатается с неразрывным пробелом — в тестах только escape-последовательностью. */
const RIBEYE: MenuHighlight = {
  id: "ribeye",
  name: "Стейк Рибай",
  description: "Говядина, овощи гриль",
  price: "8 990 ₸",
  priceMinor: 899_000,
  isTopPick: true,
  photo: {
    id: "ribeye-photo",
    uri: "https://cdn.example/ribeye.jpg",
    width: 1200,
    height: 800,
    alt: "Стейк Рибай",
    category: "food",
  },
};

/**
 * Ищем ЛИСТ с этой строкой. `getAllByText` возвращает и обёртки (у них тот же
 * `textContent`), а стиль текста лежит на самом `<Text>`, то есть на элементе
 * без детей-элементов. Сравнение по `textContent` — потому что в цене
 * неразрывный пробел, который нормализатор Testing Library схлопывает.
 */
function leafWithText(text: string): HTMLElement {
  const leaf = screen
    .getAllByText((_content, element) => element?.textContent === text)
    .find((element) => element.childElementCount === 0);
  expect(leaf).toBeTruthy();
  return leaf as HTMLElement;
}

describe("карточка блюда в ленте «Лучшие позиции»", () => {
  it("набирает цену регулярным начертанием, а не тем же, что и название", () => {
    render(<MenuItemCard item={RIBEYE} />);

    const price = atomicStyle(leafWithText("8 990 ₸"));
    const name = atomicStyle(leafWithText("Стейк Рибай"));

    expect(price["font-family"]).toBe(typography.body.fontFamily);
    expect(price["font-size"]).toBe(`${typography.body.fontSize}px`);
    // Название остаётся полужирным 16 — «облегчили цену» не значит «убрали
    // иерархию»: раньше эти две строки были неразличимы, в этом и была жалоба.
    expect(name["font-family"]).toBe(typography.itemName.fontFamily);
    expect(name["font-size"]).toBe(`${typography.itemName.fontSize}px`);
  });

  it("печатает цену цветом основного текста, а не чистым чёрным", () => {
    render(<MenuItemCard item={RIBEYE} />);

    expect(atomicStyle(leafWithText("8 990 ₸"))["color"]).toBe("rgba(27,27,27,1.00)");
  });
});
