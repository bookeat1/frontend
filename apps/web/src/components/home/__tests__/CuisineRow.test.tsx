import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Cuisine } from "@bookeat/api/client";

import { CuisineRow } from "@web/components/home/CuisineRow";

/** Живой справочник тестового стенда на 01.09.2026 — все четырнадцать. */
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
].map((name, index) => ({ id: `c${index}`, name }));

function row(): HTMLElement {
  return screen.getByRole("list");
}

describe("CuisineRow", () => {
  it("показывает ВСЕ кухни справочника, а не сколько влезло", () => {
    render(<CuisineRow items={CUISINES} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(CUISINES.length);
    expect(screen.getByText("Японская")).toBeTruthy();
  });

  /**
   * Ячейка обязана быть `min-content`: тогда её ширина равна самому длинному
   * СЛОВУ подписи, и рвать слово незачем. Равные колонки (`1fr`), которые
   * стояли здесь раньше, давали при 14 кухнях 71,8 px и делали разрыв слова
   * единственным способом уместить «Средиземноморскую».
   */
  it("ячейка тянется по подписи, а не режет её", () => {
    render(<CuisineRow items={CUISINES} />);

    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("w-min");
      expect(item.className).toContain("shrink-0");
    }
    expect(row().getAttribute("style")).toBeNull();
    expect(row().className).not.toContain("grid");
  });

  it("ряд один: без переноса на вторую строку", () => {
    render(<CuisineRow items={CUISINES} />);

    expect(row().className).not.toContain("flex-wrap");
  });

  /** Тесно или нет — считается из макета (104 + 15), а не порогом от балды. */
  it("десять кухонь ряд не жмут, четырнадцать — жмут", () => {
    const wide = render(<CuisineRow items={CUISINES.slice(0, 10)} />);
    expect(screen.getByText("Европейская").className).not.toContain("compact");
    expect(wide.container.querySelector("ul")?.className).toContain("gap-x-cuisine-row-x");
    expect(wide.container.querySelector("ul")?.className).not.toContain("row-x-compact");
    wide.unmount();

    const tight = render(<CuisineRow items={CUISINES} />);
    expect(screen.getByText("Европейская").className).toContain("xl:text-cuisine-label-compact");
    expect(tight.container.querySelector("ul")?.className).toContain("gap-x-cuisine-row-x-compact");
  });
});
