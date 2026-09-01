import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Cuisine } from "@bookeat/api/client";
import { webCuisineTile, webLayout } from "@bookeat/design-tokens";

import { CuisineRow, CuisineRowSkeleton } from "@web/components/home/CuisineRow";

/**
 * Живой справочник тестового стенда на 01.09.2026 — все ПЯТНАДЦАТЬ.
 * «Индийская» добавлена редакцией в этот же день; ряд обязан переживать
 * пополнение справочника, а не ломаться на нём.
 */
const CUISINES: readonly Cuisine[] = [
  "Европейская",
  "Средиземноморская",
  "Морепродукты",
  "Казахская",
  "Паназиатская",
  "Итальянская",
  "Французская",
  "Грузинская",
  "Турецкая",
  "Греческая",
  "Восточная",
  "Веганская",
  "Авторская",
  "Японская",
  "Индийская",
].map((name, index) => ({ id: `c${index}`, name }));

function row(): HTMLElement {
  return screen.getByRole("list");
}

describe("CuisineRow", () => {
  it("показывает ВСЕ кухни справочника, а не сколько влезло", () => {
    render(<CuisineRow items={CUISINES} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(15);
    expect(screen.getByText("Индийская")).toBeTruthy();
  });

  /**
   * Требование владельца 01.09.2026: «в мобильном приложении они скроллятся,
   * на вебе надо сделать так же». Прокрутка — режим ряда, а не аварийный
   * выход, поэтому она не спрятана за брейкпоинт.
   */
  it("прокручивается вбок на любой ширине и не переносится на вторую строку", () => {
    render(<CuisineRow items={CUISINES} />);

    expect(row().className).toContain("overflow-x-auto");
    expect(row().className).toContain("flex-nowrap");
    expect(row().className).not.toContain("flex-wrap");
    expect(row().className).not.toContain("grid");
    // Прокрутка не должна доводиться до жеста «назад» в браузере.
    expect(row().className).toContain("overscroll-x-contain");
    // Полоса тонкая, а не системная в 15 px.
    expect(row().className).toContain("row-scrollbar");
    // Ни один класс прокрутки не навешан брейкпоинтом.
    expect(row().className).not.toMatch(/(md|lg|xl|2xl):overflow/);
  });

  /**
   * Ячейка обязана быть `min-content`: тогда её ширина равна самому длинному
   * СЛОВУ подписи, и рвать слово незачем. Равные колонки (`1fr`), которые
   * стояли здесь раньше, давали при 14 кухнях 71,8 px и делали разрыв слова
   * единственным способом уместить «Средиземноморскую».
   */
  it("ячейка тянется по подписи и не сжимается", () => {
    render(<CuisineRow items={CUISINES} />);

    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("w-min");
      expect(item.className).toContain("shrink-0");
    }
    expect(row().getAttribute("style")).toBeNull();
  });

  /**
   * Размеры вернулись к макету 01.09.2026, когда владелец разрешил прокрутку.
   * Уменьшенный вариант (круг 64, подпись 11) был компромиссом ради «всё в
   * одну строку» — этого требования больше нет, и ни одного его следа в
   * разметке остаться не должно.
   */
  it("размер один на все ширины — тот, что в макете", () => {
    const { container } = render(<CuisineRow items={CUISINES} />);

    expect(container.innerHTML).not.toContain("compact");
    for (const label of CUISINES.map((c) => screen.getByText(c.name))) {
      expect(label.className).toContain("text-cuisine-label");
    }
  });

  /**
   * Скелетон и ряд обязаны быть одной высоты и одной раскладки, иначе
   * страница прыгает в момент появления данных. Проверяем именно СОВПАДЕНИЕ
   * классов контейнера, а не наличие «какого-нибудь» overflow: до 01.09.2026
   * заглушка рисовала сетку из десяти равных колонок, а ряд — флекс с
   * прокруткой, и круги менялись местами и размером на глазах у гостя.
   */
  it("заглушка совпадает с рядом по раскладке и по размеру круга", () => {
    const real = render(<CuisineRow items={CUISINES} />);
    const rowClass = real.container.querySelector("ul")?.className;
    real.unmount();

    const { container } = render(<CuisineRowSkeleton />);
    expect(container.querySelector("ul")?.className).toBe(rowClass);

    const cells = container.querySelectorAll("li");
    // Заглушка обязана переполнять контейнер 1200 — иначе полоса прокрутки
    // появляется только у настоящего ряда, и в браузерах с классической
    // (отнимающей высоту) полосой страница дёргается на приходе данных.
    const skeletonWidth =
      cells.length * webCuisineTile.size + (cells.length - 1) * webCuisineTile.rowGapX;
    expect(skeletonWidth).toBeGreaterThan(webLayout.containerWidth);
    for (const cell of cells) {
      expect(cell.className).toContain("w-cuisine");
      expect(cell.className).toContain("gap-cuisine-gap");
      expect(cell.querySelector("div")?.className).toContain("h-cuisine");
    }
    // Строка подписи — той же высоты, что настоящая (18 px из токена).
    expect(container.innerHTML).toContain("h-cuisine-label");
  });
});
